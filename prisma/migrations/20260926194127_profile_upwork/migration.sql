-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "reviews" JSONB NOT NULL DEFAULT '[]';
