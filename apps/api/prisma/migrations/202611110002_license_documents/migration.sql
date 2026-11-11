CREATE TABLE "LicenseDocument" (
id UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "licenseId" UUID NOT NULL,
"mimeType" TEXT NOT NULL, "byteLength" INTEGER NOT NULL CHECK ("byteLength" BETWEEN 1 AND 49152),
sha256 TEXT NOT NULL, "contentEncrypted" TEXT NOT NULL, "uploadedBy" UUID NOT NULL,
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY ("tenantId","licenseId") REFERENCES "ContentLicense"("tenantId",id));
CREATE INDEX "LicenseDocument_lookup" ON "LicenseDocument"("tenantId","licenseId","createdAt");
ALTER TABLE "LicenseDocument" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "LicenseDocument" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "LicenseDocument" FROM anon; END IF; IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "LicenseDocument" FROM authenticated; END IF; END $$;
