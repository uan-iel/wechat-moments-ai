-- CreateEnum
CREATE TYPE "PublishCalendarStatus" AS ENUM ('planned', 'posted');

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revisionInstruction" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishCalendarEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "versionId" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "status" "PublishCalendarStatus" NOT NULL DEFAULT 'planned',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- Preserve existing generated copy as the first version under each task.
INSERT INTO "ContentVersion" (
    "id",
    "taskId",
    "label",
    "content",
    "isFinal",
    "createdAt",
    "updatedAt"
)
SELECT
    'migrated_' || md5("id" || COALESCE("generatedContent", '') || now()::text),
    "id",
    '历史稿',
    "generatedContent",
    CASE WHEN "status"::text = 'published' THEN true ELSE false END,
    "createdAt",
    "updatedAt"
FROM "ContentTask"
WHERE "generatedContent" IS NOT NULL AND length(trim("generatedContent")) > 0;

-- AlterEnum and map removed workflow states into the simplified local workflow.
BEGIN;
CREATE TYPE "ContentTaskStatus_new" AS ENUM ('draft', 'finalized', 'failed');
ALTER TABLE "ContentTask" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ContentTask" ALTER COLUMN "status" TYPE "ContentTaskStatus_new" USING (
    CASE
        WHEN "status"::text = 'published' THEN 'finalized'
        WHEN "status"::text = 'failed' THEN 'failed'
        ELSE 'draft'
    END::"ContentTaskStatus_new"
);
ALTER TYPE "ContentTaskStatus" RENAME TO "ContentTaskStatus_old";
ALTER TYPE "ContentTaskStatus_new" RENAME TO "ContentTaskStatus";
DROP TYPE "ContentTaskStatus_old";
ALTER TABLE "ContentTask" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- DropForeignKey
ALTER TABLE "KnowledgeItem" DROP CONSTRAINT "KnowledgeItem_accountId_fkey";
ALTER TABLE "StyleProfile" DROP CONSTRAINT "StyleProfile_accountId_fkey";

-- DropIndex
DROP INDEX "ContentTask_status_scheduledAt_idx";
DROP INDEX "KnowledgeItem_accountId_idx";
DROP INDEX "StyleProfile_accountId_idx";

-- AlterTable
ALTER TABLE "ContentTask" ADD COLUMN "campaignGoal" TEXT;
UPDATE "ContentTask" SET "campaignGoal" = "title" WHERE "campaignGoal" IS NULL;
ALTER TABLE "ContentTask" ALTER COLUMN "campaignGoal" SET NOT NULL;
ALTER TABLE "ContentTask" DROP COLUMN "generatedContent",
DROP COLUMN "publishError",
DROP COLUMN "publishedAt",
DROP COLUMN "scheduledAt",
DROP COLUMN "selectedAccountIds";

-- AlterTable
ALTER TABLE "KnowledgeItem" DROP COLUMN "accountId",
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "title" TEXT;

-- AlterTable
ALTER TABLE "StyleProfile" DROP COLUMN "accountId",
ADD COLUMN "sourceText" TEXT;

-- DropTable
DROP TABLE "Account";

-- CreateIndex
CREATE INDEX "ContentVersion_taskId_idx" ON "ContentVersion"("taskId");
CREATE INDEX "ContentVersion_isFinal_idx" ON "ContentVersion"("isFinal");
CREATE INDEX "PublishCalendarEntry_plannedDate_idx" ON "PublishCalendarEntry"("plannedDate");
CREATE INDEX "PublishCalendarEntry_taskId_idx" ON "PublishCalendarEntry"("taskId");
CREATE INDEX "ContentTask_status_idx" ON "ContentTask"("status");

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublishCalendarEntry" ADD CONSTRAINT "PublishCalendarEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ContentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
