# Native Prisma verification — BLOCKED in this sandbox

## Actual production code

- `prisma` / `@prisma/client`: 5.22.0, locked together.
- `schema.prisma`: PostgreSQL datasource, prisma-client-js generator, no driver adapter configured.
- `src/prisma.service.ts`: extends the normal PrismaClient and calls $connect on module initialization, $disconnect on teardown.
- Native default on this Linux x64 / OpenSSL 3 host: library engine `debian-openssl-3.0.x`, engine commit `605197351a3c8bdd595af2d2a9bc3025bca48ea2`.
- Test runtime: Node v22.22.3. A deployed NestJS runtime/OS has not been identified: the existing Vercel project deploys the web workspace, not proof of a deployed backend. Prior Vercel metadata reported Node 26 for that web project. Do not equate local Node22 tests with Node26 deployment compatibility.

## Native-only verification command

```sh
npm ci --no-audit --no-fund
npm run test:postgres:native --workspace aether-api
```

The new native mode generates a temporary client from the production schema with only its output directory changed. It does NOT enable driverAdapters, does NOT use the WASM client, and does NOT silently fall back. On success it runs the same real PostgreSQL17 suite (now 20 checks, 33 model delegates, CRUD, relationships, defaults, constraint errors, transaction rollback, HTTP business read and actual outage/recovery) using the native client. Supabase verification in the HTTP subtest is a fixture, not real Supabase.

The runner creates its own random-password loopback PostgreSQL cluster and supplies its URL explicitly to the temporary native client. It never reads/reuses production DATABASE_URL. It deletes only its own temporary cluster/client.

## Executed result

Native generation exited **1** before database operations. Exact failure: TLS connection to `binaries.prisma.sh` disconnected before handshake while downloading the `libquery_engine.so.node` checksum. This host is not in the sandbox outbound allowlist. No native query engine exists locally. No checksum bypass or alternative untrusted binary was used.

Therefore **native runtime verification remains BLOCKED**. To complete: run the command on a trusted CI/staging host that can download the official Prisma engine (or provision the matching verified native library/schema engine through supported Prisma environment variables). Repeat using the exact approved backend Node/OS/container image. A successful types-only build is not sufficient.

The existing `test:postgres` command separately passed all 20 current checks using the real WASM query engine against real PostgreSQL. That evidence is preserved and clearly labeled WASM, not substituted for the blocked native gate.

## Follow-up: trusted CI gate (execution still blocked)

Commit92f9cff adds `.github/workflows/native-prisma.yml`: Ubuntu24.04, Node22/24, clean npm ci, native-only runner, fail-propagating pipe and uploaded logs, no production secrets/URL. Native runner additionally instantiates the actual production PrismaService through AppModule without overriding that service and checks lifecycle/query before teardown. This additional native-only check has NOT executed locally.

GitHub API attempts from this session: workflow dispatch returned404 (new workflow is not registered on the default branch); Actions permissions endpoint returned403 `Resource not accessible by integration`; branch run list returned[]. No run or native pass is claimed. An authorized repository operator must enable/approve PR workflow execution as required by repository policy, then inspect the native-postgres jobs/logs for this PR SHA. Do not merge just to register workflow and do not accept the default WASM runner as a replacement. No repository Actions settings were modified.
