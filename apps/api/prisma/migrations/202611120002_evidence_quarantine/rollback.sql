-- Explicit approval required: removes scan metadata. Do not deploy old download code without rescanning.
ALTER TABLE "LicenseDocument" DROP COLUMN "scanStatus", DROP COLUMN "scannedAt", DROP COLUMN "deletedAt";
