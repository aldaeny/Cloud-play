# DR execution gates — BLOCKED, no restoration performed

The user confirmed the isolated staging environment is **not yet identified**.
`dr-staging-acceptance.json` is an unfilled acceptance manifest, NOT test evidence.
Do not execute managed recovery, create paid resources, or repoint deployments.

Required approval: non-production source project reference, independent restore
project/region, PITR entitlement and available restore window, synthetic Storage
bucket, rollback versions/migrations, outage/maintenance scope, retention and
cleanup approval, explicit cost ceiling. Access belongs in platform permission
mechanisms, never this manifest/chat/repository. SSO stays enabled.

Once approved, the operator must collect sanitized UTC event timestamps and:

1. Before backup: create synthetic versioned markers in approved DB and Storage;
   record checksums, lengths/content types, ownership, tenant scope and ACLs.
   Include a committed marker after the chosen restore time to distinguish PITR
   from restoring the newest snapshot. No real provider content or user data.
2. Restore managed PITR to the **independent approved destination**, not production.
   Confirm marker before point exists, marker after point does not, then verify
   Auth session behavior, table RLS, tenant/owner denial and application queries.
3. Recover Storage independently: object bytes/checksums, versions, metadata,
   ACLs and signed access behavior. Database backup alone does not back up bytes.
4. Roll back the explicitly approved application version against the isolated
   destination; test schema compatibility and required fixture migration rollback
   in isolation, then forward recovery. No destructive production migration.
5. RPO = incident reference time minus newest restored committed synthetic marker
   time. RTO = verified end-to-end service recovery time minus declared incident
   time. Record source timestamps, clock alignment and verification criteria;
   report measured values only. Logical restore timings are NOT managed PITR RTO.
6. Capture actual command/action references, sanitized output, target identifiers,
   check results and deviations. Each case remains BLOCKED until permissions;
   use FAIL if executed and acceptance fails, NOT RUN if authorized but unexecuted,
   PASS only with reproducible evidence. Cleanup needs approved scope too.

The prior logical and cold physical backup tests remain valid for their own
isolated scope, but do not close any managed PITR/Storage acceptance case here.
