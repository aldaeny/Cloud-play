# End-user authority compatibility bridge

`API_END_USER_AUTHORITY=supabase` makes existing `JwtAuthGuard` delegate to the existing Supabase guard, so protected legacy end-user URLs can accept Supabase identities without duplicating accounts or trusting client claims. There is **no legacy fallback** on denial, auth outage or missing provider. Unrecognized authority values fail closed. The unset default remains `legacy` for compatibility: this is an opt-in migration bridge, **not a completed Supabase-only cutover**. No production setting was changed. Admin identity endpoints/guard are unchanged and still require a separately verified migration path.

Before enabling outside an isolated environment, verify all client contracts/profile mappings and real Supabase session lifecycle. Do not remove legacy endpoints yet.

## Fresh HTTP evidence

`protected-endpoints.http.spec.ts` reads the same AST inventory as documentation. It creates actual Nest HTTP routes with fixture DB/auth providers, not a production DB or real Supabase instance:

- 90 declared routes inventoried, 85 protected routes each reject missing credentials before database access.
- 31 end-user guarded routes each reject invalid Supabase identity without legacy fallback.
- Those same31 routes each reject a disabled account; owner ID is selected from verified identity, not body.
- 147 route-level denial checks. These do **not** establish successful route-specific authorization, ownership writes/deletes, staff escalation resistance, immediate session revocation, issuer/audience cryptography or live Supabase verification. Existing guard/crypto/tenant tests cover only their explicitly documented subsets.

Full API after addition:32suites466tests passed, lint/build passed. No production Supabase/SMTP lifecycle result is claimed.
