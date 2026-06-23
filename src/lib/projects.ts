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

export async function getActiveProjectFromRequest(request?: Request): Promise<BrandProject> {
  const url = request ? new URL(request.url) : null;
  const queryProjectId = url?.searchParams.get("projectId")?.trim();
  const queryProjectSlug = url?.searchParams.get("projectSlug")?.trim();
  const cookieProjectId = cookies().get(ACTIVE_PROJECT_COOKIE)?.value?.trim();

  const project =
    (queryProjectId
      ? await prisma.brandProject.findUnique({
          where: {
            id: queryProjectId
          }
        })
      : null) ||
    (queryProjectSlug
      ? await prisma.brandProject.findUnique({
          where: {
            slug: queryProjectSlug
          }
        })
      : null) ||
    (cookieProjectId
      ? await prisma.brandProject.findUnique({
          where: {
            id: cookieProjectId
          }
        })
      : null);

  return project ?? ensureDefaultProject();
}

export function projectCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365
  };
}
