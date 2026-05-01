-- AlterTable
ALTER TABLE "Business" ADD COLUMN "themeConfig" JSONB NOT NULL DEFAULT '{}'::jsonb;
