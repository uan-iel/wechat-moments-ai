CREATE TABLE "ResearchCollection" (
    "id" TEXT NOT NULL,
    "platform" "ContentPlatform" NOT NULL DEFAULT 'xiaohongshu',
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceQuery" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNote" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "authorName" TEXT,
    "authorHandle" TEXT,
    "noteUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "collectCount" INTEGER,
    "shareCount" INTEGER,
    "viewCount" INTEGER,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchInsight" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "platform" "ContentPlatform" NOT NULL DEFAULT 'xiaohongshu',
    "scopeKey" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendations" TEXT,
    "topKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchCollection_platform_idx" ON "ResearchCollection"("platform");
CREATE INDEX "ResearchNote_collectionId_idx" ON "ResearchNote"("collectionId");
CREATE INDEX "ResearchNote_externalId_idx" ON "ResearchNote"("externalId");
CREATE INDEX "ResearchNote_publishedAt_idx" ON "ResearchNote"("publishedAt");
CREATE INDEX "ResearchInsight_platform_idx" ON "ResearchInsight"("platform");
CREATE INDEX "ResearchInsight_scopeKey_idx" ON "ResearchInsight"("scopeKey");

ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchInsight" ADD CONSTRAINT "ResearchInsight_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
