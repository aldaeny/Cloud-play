-- Additive, isolated-tested only. Production apply requires approval and backup.
CREATE TABLE "XtreamCatalogSnapshot" (
  "serverId" UUID PRIMARY KEY REFERENCES "XtreamServer"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0),
  "catalog" JSONB NOT NULL DEFAULT '[]',
  "history" JSONB NOT NULL DEFAULT '[]',
  "lastSuccessAt" TIMESTAMPTZ,
  "lastFailureAt" TIMESTAMPTZ,
  CONSTRAINT "XtreamCatalogSnapshot_catalog_array" CHECK (jsonb_typeof("catalog") = 'array'),
  CONSTRAINT "XtreamCatalogSnapshot_history_array" CHECK (jsonb_typeof("history") = 'array' AND jsonb_array_length("history") <= 20)
);
-- Backend-only staging metadata: no direct browser/PostgREST access.
ALTER TABLE "XtreamCatalogSnapshot" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "XtreamCatalogSnapshot" FROM PUBLIC;
