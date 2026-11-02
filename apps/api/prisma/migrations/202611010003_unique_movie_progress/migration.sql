-- Fails rather than silently dropping legacy duplicates. Deduplicate deliberately before deploying.
CREATE UNIQUE INDEX "WatchProgress_movie_profile_title_key"
ON "WatchProgress" ("profileId", "titleId") WHERE "episodeId" IS NULL;
