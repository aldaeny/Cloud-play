# Autonomous launch execution — acceptance gates remain mandatory

Baseline discovered: repo aldaeny/Cloud-play, branch arena/d4593efb-cloud-play,
HEAD4553ad83d3f4dc59899adb3c4978f0ee69caeacd, clean and remote-synchronized.
No open PRs. PR24 and23 merged; no main change or merge performed here.

## Root cause and engineering actions

Run43055041508 at9d1bbef: native22/24/26 and Docker PASS; Application/Auth FAIL.
Installer excerpts prove APT repeatedly reported `Temporary failure resolving
'azure.archive.ubuntu.com'`, before Chromium installation. Earlier `download`
classification did not establish browser-CDN failure. This is now corrected by
configuring the disposable Ubuntu24.04 GitHub runner's mirror list to Ubuntu's
official HTTPS archive, preserving signed-package verification. APT update errors
are fatal, network timeouts bounded. No skipped browser/dependency installation,
no certificate bypass, no production infrastructure changed. Full CI required.

Shared quota fixture now includes a real round-robin HTTP reverse-proxy hop to
two independent native Prisma processes (15 requests routed to each,10 total
sensitive admissions). Remaining outage/retry/restart/window assertions retained.
This is not evidence of a deployed production load balancer or per-user fairness.

Security audit executed: runtime dependencies0 vulnerabilities; full tooling
audit18 (8low,10moderate,0high,0critical). No forced/major upgrades, suppressed
findings or dependency checks. Dependency audit alone is not OWASP certification.

## Read-only infrastructure discovery

- Vercel production: dpl_GJSzZV3GuZwnsorS559CR8gSjr79, metadataREADY/PROMOTED,
  main f4a405c4db6daf4eb2ef73e8b09c59cd3679a828. Existing URL
  https://cloud-play-iraq-b5gutqnn2-aldaeny60-1073.vercel.app . Not this candidate,
  not smoke-test proof, no promotion executed. Previous SSO protection retained.
- Supabase: one accessible project, syscezbzxgnfxftfzaqa, cloud-play-iraq,
  eu-central-1, PostgreSQL17.11. Auth/db/Storage health all ACTIVE_HEALTHY via
  management health read. No standalone Staging or restore destination listed.
  Branch list empty. Managed migration history only20261105015202,
  cloudplay_free_account_sync: NOT proof that API Prisma migration chain is
  applied to hosted production. No production DATABASE_URL read/used, no query
  against user records, no migration applied.
- Available connector has no PITR/Storage recovery, DNS/ingress WAF, secure browser
  SSO-session provisioning, monitoring billing/entitlement or alert-delivery tool.
  General deployment metadata permission is not an authenticated SSO browser.
  Creating managed resources with unknown entitlement/cost is not assumed free;
  existing production is not reused as destructive Staging.

## Launch block conditions

Direct Supabase Auth remains reachable independently of Next/Nest; resource-server
middleware cannot enforce all Auth issuance/refresh geography. Need authorized
managed ingress/Auth policy with trusted request Geo and actual hosted proof.
No proxy-only "fix" or feature disablement is accepted as closure.

Managed PITR, independent Storage restore and hosted rollback require provisioned
non-production resources, service entitlement and cost/scope approval. Templates
in validation/ are NOT executed recovery evidence. Physical six-target device
results remain NOT RUN. No release tag, production deployment or live readiness
claim while these acceptance gates are unmet.

Final exactHEAD/fullCI and weighted acceptance are supplied in final handoff,
not inferred from prior green commits. Existing readiness/closure documents retain
historical evidence and do not override this run's actual results.

## Follow-up installer evidence

Run43057439070 (cd677f1): native tests including real round-robin quota hop and
Docker PASS; Application/Auth FAIL at APT, now official archive.ubuntu.com also
fails DNS. Changing the Azure mirror alone did not solve network availability.

The next candidate downloads the lockfile-matched Chromium normally (never skip,
never system-browser substitute), then uses Playwright's normal host validation
and actual headless launch/DOM test to establish runtime dependencies. Only a
diagnosed missing-library failure invokes signed APT dependency installation;
that installation must succeed or the step fails. This removes unconditional
network installation of optional font packages on an already capable runner,
without disabling host requirements or any actual application/browser tests.
Missing dependencies, unavailable browser download or failed launch remain fatal.
