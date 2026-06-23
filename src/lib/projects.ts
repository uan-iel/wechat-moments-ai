import { cookies } from "next/headers";
import type { BrandProject } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ACTIVE_PROJECT_COOKIE = "activeProjectId";
export const DEFAULT_PROJECT_SLUG = "default-project";
export const DEFAULT_PROJECT_NAME = "默认项目";

export async function ensureDefaultProject() {
  return prisma.brandProject.upsert({
    where: {
      slug: DEFAULT_PROJECT_SLUG
    },
    update: {},
    create: {
      id: "brand_default_project",
      name: DEFAULT_PROJECT_NAME,
      slug: DEFAULT_PROJECT_SLUG,
      description: "默认本地项目，用于承接升级前已有的本地内容数据。"
    }
  });
}

async function projectContentScore(projectId: string) {
  const [contentFormats, contentTasks, researchCollections] = await Promise.all([
    prisma.contentFormat.count({
      where: {
        projectId
      }
    }),
    prisma.contentTask.count({
      where: {
        projectId
      }
    }),
    prisma.researchCollection.count({
      where: {
        projectId
      }
    })
  ]);

  return contentFormats + contentTasks + researchCollections;
}

async function findMostPopulatedProject() {
  const projects = await prisma.brandProject.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      momentsStyleMemory: true,
      xiaohongshuStyleMemory: true,
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
  const ranked = projects
    .map((project) => ({
      ...project,
      score: project._count.contentFormats + project._count.contentTasks + project._count.researchCollections
    }))
    .filter((project) => project.score > 0)
    .sort((left, right) => right.score - left.score || right.updatedAt.getTime() - left.updatedAt.getTime());

  if (!ranked[0]) {
    return null;
  }

  const { _count, score, ...project } = ranked[0];
  void _count;
  void score;
  return project;
}

export async function getActiveProjectFromRequest(request?: Request): Promise<BrandProject> {
  const url = request ? new URL(request.url) : null;
  const queryProjectId = url?.searchParams.get("projectId")?.trim();
  const queryProjectSlug = url?.searchParams.get("projectSlug")?.trim();
  const cookieProjectId = cookies().get(ACTIVE_PROJECT_COOKIE)?.value?.trim();

  if (queryProjectId) {
    const project = await prisma.brandProject.findUnique({
      where: {
        id: queryProjectId
      }
    });

    if (project) {
      return project;
    }
  }

  if (queryProjectSlug) {
    const project = await prisma.brandProject.findUnique({
      where: {
        slug: queryProjectSlug
      }
    });

    if (project) {
      return project;
    }
  }

  if (cookieProjectId) {
    const project = await prisma.brandProject.findUnique({
      where: {
        id: cookieProjectId
      }
    });

    if (project) {
      const shouldPreferPopulatedProject =
        project.slug === DEFAULT_PROJECT_SLUG && (await projectContentScore(project.id)) === 0;
      const preferredProject = shouldPreferPopulatedProject ? await findMostPopulatedProject() : null;

      return preferredProject ?? project;
    }
  }

  return (await findMostPopulatedProject()) ?? ensureDefaultProject();
}

export function projectCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365
  };
}
