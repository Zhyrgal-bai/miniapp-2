-- Catalog P1: product lifecycle + category ordering

CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Product_businessId_status_idx" ON "Product"("businessId", "status");
CREATE INDEX "Product_businessId_categoryId_status_idx" ON "Product"("businessId", "categoryId", "status");
CREATE INDEX "Category_businessId_parentId_sortOrder_idx" ON "Category"("businessId", "parentId", "sortOrder");
