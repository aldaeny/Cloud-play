CREATE TABLE "ExternalPlaybackLease" (
 id uuid PRIMARY KEY, "userId" uuid NOT NULL REFERENCES "AppUser"(id),
 "tenantId" uuid NOT NULL REFERENCES "Tenant"(id), "channelId" uuid NOT NULL,
 "authBinding" text NOT NULL, country text NOT NULL, platform text NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(), "expiresAt" timestamptz NOT NULL,
 "absoluteExpiresAt" timestamptz NOT NULL, "revokedAt" timestamptz,
 CONSTRAINT "playback_lease_country" CHECK (country ~ '^[A-Z]{2}$'),
 CONSTRAINT "playback_lease_platform" CHECK (platform IN ('web','android','ios','tv')),
 CONSTRAINT "playback_lease_lifetime" CHECK ("expiresAt" <= "absoluteExpiresAt"),
 FOREIGN KEY ("tenantId","channelId") REFERENCES "ExternalChannel"("tenantId",id)
);
CREATE INDEX "ExternalPlaybackLease_userId_expiresAt_idx" ON "ExternalPlaybackLease"("userId","expiresAt");
CREATE TABLE "ExternalGeoNonce" (id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL);
ALTER TABLE "ExternalPlaybackLease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalGeoNonce" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ExternalPlaybackLease", "ExternalGeoNonce" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON "ExternalPlaybackLease", "ExternalGeoNonce" FROM anon;
 END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON "ExternalPlaybackLease", "ExternalGeoNonce" FROM authenticated;
 END IF;
END $$;
