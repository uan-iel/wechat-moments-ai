CREATE TABLE "BrandProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "momentsStyleMemory" TEXT,
    "xiaohongshuStyleMemory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandProject_slug_key" ON "BrandProject"("slug");

INSERT INTO "BrandProject" ("id", "name", "slug", "description", "updatedAt")
VALUES ('brand_default_project', '默认项目', 'default-project', '默认本地项目，用于承接升级前已有的本地内容数据。', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "ContentFormat" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ContentTask" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ResearchCollection" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ResearchInsight" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ResearchCrawlJob" ADD COLUMN "projectId" TEXT;

UPDATE "ContentFormat" SET "projectId" = 'brand_default_project' WHERE "projectId" IS NULL;
UPDATE "ContentTask" SET "projectId" = 'brand_default_project' WHERE "projectId" IS NULL;
UPDATE "ResearchCollection" SET "projectId" = 'brand_default_project' WHERE "projectId" IS NULL;
UPDATE "ResearchInsight" SET "projectId" = 'brand_default_project' WHERE "projectId" IS NULL;
UPDATE "ResearchCrawlJob" SET "projectId" = 'brand_default_project' WHERE "projectId" IS NULL;

ALTER TABLE "ContentFormat" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ContentTask" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ResearchCollection" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ResearchInsight" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ResearchCrawlJob" ALTER COLUMN "projectId" SET NOT NULL;

CREATE INDEX "ContentFormat_projectId_idx" ON "ContentFormat"("projectId");
CREATE INDEX "ContentTask_projectId_idx" ON "ContentTask"("projectId");
CREATE INDEX "ResearchCollection_projectId_idx" ON "ResearchCollection"("projectId");
CREATE INDEX "ResearchInsight_projectId_idx" ON "ResearchInsight"("projectId");
CREATE INDEX "ResearchCrawlJob_projectId_idx" ON "ResearchCrawlJob"("projectId");

ALTER TABLE "ContentFormat" ADD CONSTRAINT "ContentFormat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCollection" ADD CONSTRAINT "ResearchCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchInsight" ADD CONSTRAINT "ResearchInsight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCrawlJob" ADD CONSTRAINT "ResearchCrawlJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BrandProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
