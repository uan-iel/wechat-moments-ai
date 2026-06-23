import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACTIVE_PROJECT_COOKIE,
  ensureDefaultProject,
  getActiveProjectFromRequest,
  projectCookieOptions
} from "@/lib/projects";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional()
});

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `project-${Date.now()}`;
}

export async function GET(request: Request) {
  await ensureDefaultProject();
  const activeProject = await getActiveProjectFromRequest(request);
  const projects = await prisma.brandProject.findMany({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          contentFormats: true,
          contentTasks: true,
          researchCollections: true
        }
      }
    }
  });
  const activeProjectForClient = projects.find((project) => project.id === activeProject.id) ?? {
    id: activeProject.id,
    name: activeProject.name,
    slug: activeProject.slug,
    description: activeProject.description,
    createdAt: activeProject.createdAt,
    updatedAt: activeProject.updatedAt,
    _count: {
      contentFormats: 0,
      contentTasks: 0,
      researchCollections: 0
    }
  };

  const response = NextResponse.json({
    activeProject: activeProjectForClient,
    projects
  });
  response.cookies.set(ACTIVE_PROJECT_COOKIE, activeProject.id, projectCookieOptions());

  return response;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = createProjectSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const baseSlug = slugify(parsed.data.slug || name);
  let slug = baseSlug;
  let index = 2;

  while (await prisma.brandProject.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${index}`;
    index += 1;
  }

  const project = await prisma.brandProject.create({
    data: {
      name,
      slug,
      description: parsed.data.description?.trim() || null
    }
  });
  const response = NextResponse.json({ project }, { status: 201 });
  response.cookies.set(ACTIVE_PROJECT_COOKIE, project.id, projectCookieOptions());

  return response;
}

export async function PATCH(request: Request) {
  const json = await request.json().catch(() => ({}));
  const projectId = typeof json.projectId === "string" ? json.projectId.trim() : "";

  if (!projectId) {
    return NextResponse.json({ error: "Project id is required" }, { status: 400 });
  }

  const project = await prisma.brandProject.findUnique({
    where: {
      id: projectId
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const response = NextResponse.json({ project });
  response.cookies.set(ACTIVE_PROJECT_COOKIE, project.id, projectCookieOptions());

  return response;
}
