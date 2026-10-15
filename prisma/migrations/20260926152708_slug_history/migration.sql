-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
