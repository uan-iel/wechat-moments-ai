import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const styleProfileSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  analysisPrompt: z.string().min(1)
});

const selectStyleProfile = {
  id: true,
  name: true,
  description: true,
  analysisPrompt: true,
  sourceText: true,
  createdAt: true,
  updatedAt: true
};

export async function GET() {
  const styleProfiles = await prisma.styleProfile.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: selectStyleProfile
  });

  return NextResponse.json({ styleProfiles });
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = styleProfileSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid style profile payload" }, { status: 400 });
  }

  const styleProfile = await prisma.styleProfile.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      analysisPrompt: parsed.data.analysisPrompt.trim()
    },
    select: selectStyleProfile
  });

  return NextResponse.json({ styleProfile }, { status: 201 });
}

export async function PATCH(request: Request) {
  const json = await request.json();
  const parsed = styleProfileSchema.required({ id: true }).safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid style profile payload" }, { status: 400 });
  }

  const styleProfile = await prisma.styleProfile.update({
    where: {
      id: parsed.data.id
    },
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      analysisPrompt: parsed.data.analysisPrompt.trim()
    },
    select: selectStyleProfile
  });

  return NextResponse.json({ styleProfile });
}
