ALTER TABLE "PlaybackSession" ADD COLUMN "vodCountry" text, ADD COLUMN "vodAssetId" uuid REFERENCES "MediaAsset"(id), ADD COLUMN "authBinding" text, ADD COLUMN "vodExpiresAt" timestamptz;
CREATE INDEX "PlaybackSession_vodExpiresAt_idx" ON "PlaybackSession"("vodExpiresAt") WHERE "vodAssetId" IS NOT NULL;
