-- Previously stored evidence must be scanned; never grandfathered as clean.
ALTER TABLE "LicenseDocument" ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'quarantine', ADD COLUMN "scannedAt" TIMESTAMPTZ, ADD COLUMN "deletedAt" TIMESTAMPTZ;
ALTER TABLE "LicenseDocument" ADD CHECK ("scanStatus" IN ('quarantine','clean','infected','deleted'));
