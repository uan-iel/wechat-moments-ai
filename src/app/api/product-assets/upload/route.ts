import { ProductAssetType } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getActiveProjectFromRequest } from "@/lib/projects";
import { getFolderTag, saveProductAssetFile } from "@/lib/server/product-asset-files";

export const dynamic = "force-dynamic";

type UploadMeta = {
  name?: string;
  relativePath?: string;
};

export async function POST(request: Request) {
  const project = await getActiveProjectFromRequest(request);
  const formData = await request.formData();
  const productId = String(formData.get("productId") || "").trim();
  const baseTitle = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const rawTags = String(formData.get("tags") || "").trim();
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);
  const fileMeta = JSON.parse(String(formData.get("fileMeta") || "[]")) as UploadMeta[];

  if (!productId) {
    return NextResponse.json({ error: "缺少产品 ID" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "请至少上传一张图片" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: {
      id: productId
    },
    select: {
      id: true,
      contentFormat: {
        select: {
          projectId: true
        }
      }
    }
  });

  if (!product || product.contentFormat.projectId !== project.id) {
    return NextResponse.json({ error: "产品不存在" }, { status: 404 });
  }

  const tags = rawTags.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
  const createdAssets = await Promise.all(
    files.map(async (file, index) => {
      const meta = fileMeta[index] || {};
      const folderTag = getFolderTag(meta.relativePath);
      const savedFile = await saveProductAssetFile({
        file,
        productId,
        relativePath: meta.relativePath
      });
      const fileTitle = file.name.replace(/\.[^.]+$/, "");
      const title = baseTitle || fileTitle;
      const mergedTags = Array.from(new Set([...tags, folderTag, savedFile.folderTag].filter(Boolean)));

      return prisma.productAsset.create({
        data: {
          productId,
          type: ProductAssetType.IMAGE,
          title,
          content: content || (folderTag ? `图片组：${folderTag}` : null),
          imageUrl: savedFile.imageUrl,
          tags: mergedTags
        }
      });
    })
  );

  return NextResponse.json({ productAssets: createdAssets }, { status: 201 });
}
