// Official GoTrue migration 20240612123726 grants SELECT to role "postgres".
// The package's database owner is "aether", so provide the compatibility role
// without login, membership, superuser or RLS bypass. Never alter an existing role.
module.exports = `DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres') THEN
    CREATE ROLE postgres NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;`;
