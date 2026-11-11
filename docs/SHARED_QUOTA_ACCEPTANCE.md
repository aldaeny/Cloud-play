# Shared quota acceptance — pending native CI, not a production readiness claim

Candidate implementation uses existing backend-only PostgreSQL expiring ledger,
not Redis, no new database schema and no automatic DDL. Production configuration
is unchanged. Explicit rollout: `RATE_LIMIT_STORE=postgres`; unset preserves the
existing local safety net and is **not distributed quota enforcement**.

## Consistency/security contract

- One PostgreSQL transaction acquires an advisory transaction lock on peer identity,
  reads authoritative DB time, checks 100 general / 10 sensitive grants in the
  fixed minute, and creates allowance records for both scopes atomically. Denial
  commits no allowance. Independent processes use the same lock and ledger.
- No in-memory fallback after authority error. A failed or ambiguous DB transaction
  returns **503 RATE_LIMIT_AUTHORITY_UNAVAILABLE**, never allows the request. A
  confirmed exhaustion returns **429** with `Retry-After`.
- Retries are **new attempts**, not idempotent request replay. A lost HTTP response
  after a committed allowance may conservatively consume that allowance again on
  retry; no refund/reset is inferred. This cannot grant over the limit. Business
  operations still require their own idempotency policy. Exactly-once client
  allowance accounting is NOT claimed. The policy needs owner approval for rollout.
- Identity is the socket peer, never arbitrary XFF/X-Country/admin claims. Behind
  a proxy this groups traffic by proxy until separately proven ingress identity is
  configured; this does not certify fair per-user or trusted end-user-IP quotas.
- Prunes at most 500 expired `quota:` records, without touching live Geo anchors.
  One record per admitted scope, not a high-throughput counter service. Cardinality,
  DB sizing, proxy fairness and throughput remain production acceptance gates.

## Required evidence / statuses

| Case | Before CI result | Evidence path |
|---|---|---|
| Atomic check/consume and racing requests | NOT RUN | `test-shared-quota.mjs`, native check annotations |
| Two independent processes/pools, 30 concurrent sensitive requests, exactly10 admitted | NOT RUN | Same harness, actual HTTP + native PG |
| Forged forwarding headers cannot reset allowance | NOT RUN | Same competing requests |
| Restart one process while other stays live, allowance retained | NOT RUN | Replacement child must receive429 |
| General and auth budgets compose atomically | NOT RUN | 100 further general requests admit90, reject10 |
| Actual PG outage, both processes fail closed | NOT RUN | Cluster stop; both must return503 |
| Recovery/retry cannot reset already consumed budget | NOT RUN | Restart DB; both must still return429 |
| Next DB-time window resets across both processes | NOT RUN | Wait real boundary, both admit again |
| Expired quota cleanup | NOT RUN | Disposable records only, native DB count |
| Error contract and spoofed identity unit checks | PASS | Local targeted Jest 3/3, real native behavior not inferred |

The final handoff supplies exact-HEAD CI results; never interpret this pre-run table
as successful execution. Harness runs automatically in native Node22/24/26 jobs of
`native-prisma.yml`. Each uses its own freshly created loopback embedded PostgreSQL
cluster, generated native client, two child processes and independent pools. No
production DATABASE_URL is accepted. Worker routes isolate production quota
middleware with controlled204 handlers; business Auth handlers, load balancer and
hosted ingress are not part of this proof. Existing full application CI remains.

### Execution history

Run `43041733949`, commit `d196abf9a421e8384f5582fe647d722b9f95124b`:
shared-quota native checks FAIL (all three Node jobs), observed503 rather than429.
The post-restart assertion incorrectly assumed the first native stale-pool query
must recover immediately. The corrected test allows503 only while retrying for
at most15s after DB restart; it must reach429, and **never204**. No exhausted
allowance is reset and no error is treated as an admission. Browser tooling
installation also failed in both application/Auth jobs before playback execution;
raw logs could not be fetched from restricted results hosts. Docker passed.
No production readiness/Shared Quota PASS is inferred from this failed run.
