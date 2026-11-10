# Phase 2 security audit

Fresh npm audit on the starting lockfile: **31 findings: 11 low, 16 moderate, 4 high, 0 critical**. After focused same-major updates: **21 findings: 8 low, 13 moderate, 0 high, 0 critical**. Findings are audit dependency nodes, not necessarily 31 independent exploitable defects. No suppressions, forced fix or framework major upgrade.

## Changes

Scoped overrides: CLI glob 10.4.5 → 10.5.0 (fixes command injection, not all cancellation/minimatch advisories); inquirer 8.2.6 → 8.2.7 and schematics CLI inquirer 9.2.15 → 9.3.8 (remove old external-editor/tmp path); Angular core picomatch 4.0.1 → 4.0.7 and ajv 8.12.0 → 8.20.0; CLI webpack 5.97.1 → 5.112.2. No arbitrary major versions forced. Root overrides intentionally scope pinned upstream tool dependencies.

Verification after updates: API build/lint/Jest; real PostgreSQL test runner; Web/Admin lint/build succeeded. A clean npm ci and final regression run are still required for the final snapshot. Remaining moderate runtime Nest core/platform advisories require a separately reviewed upgrade; do NOT declare zero runtime vulnerabilities.

## Starting findings and disposition

Installed versions below refer to the starting lockfile. Runtime/dev derives from lock metadata; mixed graphs can contain both. Exploitability is a preliminary reachability assessment, not a penetration-test result. Advisory details include inherited vulnerable dependencies. Breaking-risk for package-level suggested fixes may differ from the focused transitive overrides above.

| Package | Installed | Vulnerable range | Severity | Direct? | Exposure / application | Suggested fix / risk | Remaining? |
|---|---|---|---|---|---|---|---|
| @angular-devkit/core | 17.3.11 | 12.0.0-next.0 - 19.2.22 || 20.0.0-next.0 - 20.3.21 || 21.0.0-next.0 - 21.2.4 || 22.0.0-next.0 - 22.0.0-rc.3 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @nestjs/schematics@12.0.13; MAJOR / review required | no |
| @angular-devkit/schematics | 17.3.11 | 12.0.0-next.0 - 19.2.21 || 20.0.0-next.0 - 20.3.17 || 21.0.0-next.0 - 21.1.4 || 21.2.0-next.0 - 21.2.0-rc.2 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |
| @angular-devkit/schematics-cli | 17.3.11 | 0.12.0-beta.0 - 19.2.21 || 20.0.0-next.0 - 20.3.17 || 21.0.0-next.0 - 21.1.4 || 21.2.0-next.0 - 21.2.0-rc.2 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |
| @jest/core | 29.7.0 | >=25.2.0-alpha.86 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | yes |
| @nestjs/cli | 10.4.9 | >=2.0.0-rc.1 | high | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | yes |
| @nestjs/core | 10.4.22 | <=11.1.17 | moderate | yes | API runtime or mixed; inspect node paths; runtime reachable surface requires review | @nestjs/core@12.4.2; MAJOR / review required | yes |
| @nestjs/platform-express | 10.4.22 | <=11.0.0-next.4 | moderate | yes | API runtime or mixed; inspect node paths; runtime reachable surface requires review | @nestjs/platform-express@12.4.2; MAJOR / review required | yes |
| @nestjs/schematics | 10.2.3 | 8.0.0 - 11.0.9 | moderate | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @nestjs/schematics@12.0.13; MAJOR / review required | no |
| @nestjs/testing | 10.4.22 | <=11.0.0-next.4 | moderate | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @nestjs/testing@12.4.2; MAJOR / review required | yes |
| @typescript-eslint/eslint-plugin | 7.18.0, 8.72.1 | 6.16.0 - 8.72.2 | moderate | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @typescript-eslint/eslint-plugin@6.15.0; MAJOR / review required | yes |
| @typescript-eslint/parser | 7.18.0, 8.72.1 | 6.16.0 - 8.72.2 | moderate | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @typescript-eslint/parser@6.15.0; MAJOR / review required | yes |
| @typescript-eslint/type-utils | 7.18.0, 8.72.1 | 6.16.0 - 8.72.2 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | yes |
| @typescript-eslint/typescript-estree | 8.72.1, 7.18.0 | 6.16.0 - 8.72.2 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @typescript-eslint/parser@6.15.0; MAJOR / review required | yes |
| @typescript-eslint/utils | 7.18.0, 8.72.1 | 6.16.0 - 8.72.2 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | eslint-config-next@15.5.29; MAJOR / review required | yes |
| ajv | 8.12.0 | 7.0.0-alpha.0 - 8.17.1 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @nestjs/schematics@12.0.13; MAJOR / review required | no |
| create-jest | 29.7.0 | >=29.7.0 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | jest@25.1.0; MAJOR / review required | yes |
| deepmerge | 4.3.1 | >=4.2.0 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | jest@25.1.0; MAJOR / review required | yes |
| eslint-config-next | 16.4.3 | >=15.6.0-canary.0 | moderate | yes | Web/Admin lint; not an exposed production request handler; untrusted local patterns/files can still matter | eslint-config-next@15.5.29; MAJOR / review required | yes |
| external-editor | 3.1.0 | >=1.1.1 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |
| fork-ts-checker-webpack-plugin | 9.0.2 | >=5.0.0-alpha.1 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | yes |
| glob | 10.4.5 | 9.0.0 - 14.0.1 | high | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | yes |
| inquirer | 9.2.15, 8.2.6 | 3.0.0 - 8.2.6 || 9.0.0 - 9.3.7 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |
| jest | 29.7.0 | >=25.2.0-alpha.86 | low | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | jest@25.1.0; MAJOR / review required | yes |
| jest-cli | 29.7.0 | >=25.2.0-alpha.86 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | jest@25.1.0; MAJOR / review required | yes |
| jest-config | 29.7.0 | >=25.2.0-alpha.86 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | jest@25.1.0; MAJOR / review required | yes |
| minimatch | 10.2.6, 9.0.9 | 7.0.0 - 11.0.0 | moderate | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @typescript-eslint/parser@6.15.0; MAJOR / review required | yes |
| picomatch | 4.0.1 | 4.0.0 - 4.0.3 | high | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | @nestjs/schematics@12.0.13; MAJOR / review required | no |
| tmp | 0.0.33 | <=0.2.5 | high | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |
| ts-jest | 29.4.15 | >=25.10.0-alpha.1 | low | yes | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | ts-jest@25.5.1; MAJOR / review required | yes |
| typescript-eslint | 8.72.1 | <=8.72.2 | moderate | no | Web/Admin lint; not an exposed production request handler; untrusted local patterns/files can still matter | eslint-config-next@15.5.29; MAJOR / review required | yes |
| webpack | 5.97.1 | 5.49.0 - 5.104.0 | low | no | API build/test tooling (some shared lint); not an exposed production request handler; untrusted local patterns/files can still matter | compatible resolution available | no |

## Application security findings

- Legacy JWT systems remain; only hybrid profiles uses Supabase. Matrix lists all 88 declared controller routes. This is not full D1 completion.
- New legacy guard tests use real JWT signature/expiry with fixture database records. Invalid subject shapes are now rejected before database lookups; forged token tenant/permissions do not override database context.
- RLS checked-in SQL is exercised on real isolated PostgreSQL with local auth.uid/users/roles fixtures. This is not hosted Supabase verification.
- Native Prisma remains blocked by official engine download network restriction.
- IPTV health URL validation has incomplete DNS/private IPv6/rebinding coverage; no claim of a complete SSRF audit. Existing response-size checking buffers before checking; should be bounded at transport level.
- Existing IPTV HTTP opt-in remains for compatibility; it is NOT a secure transport substitute or approval to transmit credentials. No new HTTP path or provider probe was introduced.
- Bearer bridges reject redirects, bound bodies/timeouts, use no-store and fixed targets. Existing CSP/HSTS tests remain required in regression.
- Legacy cookie fallback needs explicit CSRF review before browser cookie-based business operations are adopted; new hybrid endpoint is bearer-only.
- Staff disablement is not modeled; direct permission decorators are absent on some admin read routes (see matrix). Admin authentication alone is not fine-grained authorization certification.
- Production RLS/auth/secret metadata not freshly fetched in this phase. Previous sensitive classification is historical evidence, not proof of rotation or runtime availability. No credentials were read/decrypted, modified or logged.
- SMTP/full recovery and real-provider playback remain unverified.
