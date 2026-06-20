-- CreateEnum
CREATE TYPE "ProductAssetType" AS ENUM ('text', 'image');

-- DropForeignKey
ALTER TABLE "ContentTask" DROP CONSTRAINT "ContentTask_selectedStyleId_fkey";

-- DropIndex
DROP INDEX "ContentTask_selectedStyleId_idx";

-- AlterTable
ALTER TABLE "ContentTask" DROP COLUMN "selectedKnowledgeIds",
DROP COLUMN "selectedStyleId",
ADD COLUMN     "contentFormatId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "selectedAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "KnowledgeItem";

-- DropTable
DROP TABLE "StyleProfile";

-- DropEnum
DROP TYPE "KnowledgeItemType";

-- CreateTable
CREATE TABLE "ContentFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "writingGuide" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "contentFormatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sellingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ProductAssetType" NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "imageUrl" TEXT,
    "imageAnalysis" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_contentFormatId_idx" ON "Product"("contentFormatId");

-- CreateIndex
CREATE INDEX "ProductAsset_productId_idx" ON "ProductAsset"("productId");

-- CreateIndex
CREATE INDEX "ProductAsset_type_idx" ON "ProductAsset"("type");

-- CreateIndex
CREATE INDEX "ContentTask_contentFormatId_idx" ON "ContentTask"("contentFormatId");

-- CreateIndex
CREATE INDEX "ContentTask_productId_idx" ON "ContentTask"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_contentFormatId_fkey" FOREIGN KEY ("contentFormatId") REFERENCES "ContentFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAsset" ADD CONSTRAINT "ProductAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_contentFormatId_fkey" FOREIGN KEY ("contentFormatId") REFERENCES "ContentFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTask" ADD CONSTRAINT "ContentTask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

