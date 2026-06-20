import { KnowledgeItemType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const knowledgeItemSchema = z.object({
  type: z.nativeEnum(KnowledgeItemType).default(KnowledgeItemType.TEXT),
  title: z.string().optional(),
  content: z.string().min(1),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).default([])
});

const selectKnowledgeItem = {
  id: true,
  type: true,
  title: true,
  content: true,
  imageUrl: true,
  tags: true,
  createdAt: true,
  updatedAt: true
};

export async function GET() {
  const knowledgeItems = await prisma.knowledgeItem.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: selectKnowledgeItem
  });

  return NextResponse.json({ knowledgeItems });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = knowledgeItemSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid knowledge item payload" }, { status: 400 });
  }

  const knowledgeItem = await prisma.knowledgeItem.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
      imageUrl: parsed.data.imageUrl?.trim() || null,
      tags: parsed.data.tags.map((tag) => tag.trim()).filter(Boolean)
    },
    select: selectKnowledgeItem
  });

  return NextResponse.json({ knowledgeItem }, { status: 201 });
}
