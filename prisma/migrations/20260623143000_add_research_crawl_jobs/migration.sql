CREATE TYPE "ResearchCrawlerType" AS ENUM ('search', 'creator');
CREATE TYPE "ResearchCrawlStatus" AS ENUM ('pending', 'running', 'importing', 'completed', 'failed');

CREATE TABLE "ResearchCrawlJob" (
    "id" TEXT NOT NULL,
    "platform" "ContentPlatform" NOT NULL DEFAULT 'xiaohongshu',
    "collectionName" TEXT NOT NULL,
    "query" TEXT,
    "creatorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crawlerType" "ResearchCrawlerType" NOT NULL DEFAULT 'search',
    "status" "ResearchCrawlStatus" NOT NULL DEFAULT 'pending',
    "notesImported" INTEGER,
    "sourceFilePath" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCrawlJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchCrawlJob_platform_idx" ON "ResearchCrawlJob"("platform");
CREATE INDEX "ResearchCrawlJob_status_idx" ON "ResearchCrawlJob"("status");
CREATE INDEX "ResearchCrawlJob_createdAt_idx" ON "ResearchCrawlJob"("createdAt");
