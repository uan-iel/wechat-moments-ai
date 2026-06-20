-- CreateEnum
CREATE TYPE "KnowledgeItemType" AS ENUM ('text', 'image');

-- CreateEnum
CREATE TYPE "ContentTaskStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'failed');

-- CreateTable
CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "corpId" TEXT NOT NULL,
  "corpIdHash" TEXT NOT NULL,
  "corpSecret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "analysisPrompt" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
  "id" TEXT NOT NULL,
  "type" "KnowledgeItemType" NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTask" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "selectedAccountIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectedStyleId" TEXT,
  "selectedKnowledgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "generatedContent" TEXT,
  "status" "ContentTaskStatus" NOT NULL DEFAULT 'draft',
  "scheduledAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_corpIdHash_key" ON "Account"("corpIdHash");

-- CreateIndex
CREATE INDEX "Account_createdAt_idx" ON "Account"("createdAt");

-- CreateIndex
CREATE INDEX "StyleProfile_accountId_idx" ON "StyleProfile"("accountId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_accountId_idx" ON "KnowledgeItem"("accountId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_type_idx" ON "KnowledgeItem"("type");

-- CreateIndex
CREATE INDEX "ContentTask_selectedStyleId_idx" ON "ContentTask"("selectedStyleId");

-- CreateIndex
CREATE INDEX "ContentTask_status_scheduledAt_idx" ON "ContentTask"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "StyleProfile" ADD CONSTRAINT "StyleProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_selectedStyleId_fkey" FOREIGN KEY ("selectedStyleId") REFERENCES "StyleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
