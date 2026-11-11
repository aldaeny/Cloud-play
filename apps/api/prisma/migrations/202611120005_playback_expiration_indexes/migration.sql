-- Additive housekeeping indexes; no cleanup/data deletion/production application.
CREATE INDEX "ExternalPlaybackLease_expiresAt_idx" ON "ExternalPlaybackLease"("expiresAt");
CREATE INDEX "ExternalGeoNonce_expiresAt_idx" ON "ExternalGeoNonce"("expiresAt");
