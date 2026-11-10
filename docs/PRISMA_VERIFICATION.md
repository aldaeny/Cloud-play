> Historical evidence subset. Current routes108/models40/backend tables42. See EXTERNAL_SERVER_MANAGER.md for added routes, tests and scope. Earlier counts are retained with their run context.

# Prisma and database verification

## VERIFIED

Native-only Prisma5.22 generator/engine and actual production PrismaService passed Node22/24 on trusted CI. Master suite27checks includes33model parity/relations/constraints/indexes/transactions, all-table RLS/ACL checks, real catalog/provider locks/failure isolation, migration rollback/reapply, same-PG17 cold backup restoration and two real outage/recovery paths. No production connection and no WASM substitution. See master-native27-node22.json and node24 counterpart plus workflow42870237804.

Expanded coverage exposed genuine native P1017 after restart with multiple stale pooled sockets. Fixed explicit lifecycle recovery and bounded production readiness reconnect; non-idempotent business writes are never retried blindly. Earlier failing runs42866477697/42867056416 are retained as regression evidence, not hidden. Later native runs passed. Local default PostgreSQL25checks uses WASM and remains separately labeled.

## IMPLEMENTED BUT UNVERIFIED

Production pooling budget, measured query latency/N+1/load limits, managed Supabase schema drift/PITR and recovery under production traffic are not verified. No speculative indexes added, no production migrations run. Additive backend RLS migration needs explicit deployment approval. Prisma native downloads are still unavailable in local egress, but trusted CI execution is available and passed.
