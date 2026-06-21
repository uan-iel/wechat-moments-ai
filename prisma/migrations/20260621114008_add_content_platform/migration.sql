-- CreateEnum
CREATE TYPE "ContentPlatform" AS ENUM ('moments', 'xiaohongshu');

-- AlterTable
ALTER TABLE "ContentFormat" ADD COLUMN     "platform" "ContentPlatform" NOT NULL DEFAULT 'moments';

-- AlterTable
ALTER TABLE "ContentTask" ADD COLUMN     "platform" "ContentPlatform" NOT NULL DEFAULT 'moments';

-- CreateIndex
CREATE INDEX "ContentTask_platform_idx" ON "ContentTask"("platform");
