-- DropForeignKey
ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAssetTitleFK";

-- DropForeignKey
ALTER TABLE "MediaAsset" DROP CONSTRAINT "MediaAssetEpisodeFK";

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "episodeId" UUID,
ADD COLUMN     "titleId" UUID;

-- Preserve existing polymorphic owner links; invalid legacy data will fail the migration.
UPDATE "MediaAsset" SET "titleId" = "ownerId" WHERE "ownerType" = 'title';
UPDATE "MediaAsset" SET "episodeId" = "ownerId" WHERE "ownerType" = 'episode';
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_owner_check" CHECK (
  ("ownerType" = 'title' AND "titleId" = "ownerId" AND "titleId" IS NOT NULL AND "episodeId" IS NULL) OR
  ("ownerType" = 'episode' AND "episodeId" = "ownerId" AND "episodeId" IS NOT NULL AND "titleId" IS NULL)
);

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAssetTitleFK" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAssetEpisodeFK" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

