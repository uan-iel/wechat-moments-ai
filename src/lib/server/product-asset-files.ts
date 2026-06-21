import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const uploadRoot = path.join(process.cwd(), "public", "uploads", "product-assets");

function sanitizeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "file";
}

export function getFolderTag(relativePath?: string | null) {
  if (!relativePath) {
    return "";
  }

  const [firstSegment] = relativePath.split("/").filter(Boolean);
  return firstSegment?.trim() || "";
}

export async function saveProductAssetFile(input: {
  file: File;
  productId: string;
  relativePath?: string | null;
}) {
  const originalName = input.file.name || "image";
  const extension = path.extname(originalName) || ".bin";
  const folderTag = getFolderTag(input.relativePath);
  const productDir = sanitizeSegment(input.productId);
  const folderDir = sanitizeSegment(folderTag || "single");
  const targetDir = path.join(uploadRoot, productDir, folderDir);

  await mkdir(targetDir, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(targetDir, filename);
  const arrayBuffer = await input.file.arrayBuffer();

  await writeFile(filePath, Buffer.from(arrayBuffer));

  return {
    imageUrl: `/uploads/product-assets/${productDir}/${folderDir}/${filename}`,
    folderTag
  };
}

export async function removeProductAssetFile(imageUrl?: string | null) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/product-assets/")) {
    return;
  }

  const relativePath = imageUrl.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relativePath);

  try {
    await unlink(filePath);
  } catch {
    // Ignore missing files so deleting DB records remains reliable.
  }
}
