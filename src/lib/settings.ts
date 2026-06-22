import { prisma } from "@/lib/prisma";

export const SETTINGS_KEYS = {
  aiModelConfig: "ai.modelConfig",
  aiModelEndpoints: "ai.modelEndpoints",
  aiApiKey: "ai.apiKey",
  researchXhsMediaCrawlerPath: "research.xhs.mediaCrawler.path",
  researchXhsMediaCrawlerBaseUrl: "research.xhs.mediaCrawler.baseUrl",
  researchXhsMediaCrawlerStartCommand: "research.xhs.mediaCrawler.startCommand"
} as const;

export async function getAppSetting(key: string) {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key
    },
    select: {
      value: true
    }
  });

  return setting?.value ?? null;
}

export async function setAppSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: {
      key
    },
    update: {
      value
    },
    create: {
      key,
      value
    }
  });
}

export async function hasAppSetting(key: string) {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key
    },
    select: {
      key: true
    }
  });

  return Boolean(setting);
}
