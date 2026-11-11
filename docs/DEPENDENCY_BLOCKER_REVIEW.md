# Remaining dependency findings — fresh audit

`npm audit --json` after clean npm ci:21 entries,8low13moderate,0high0critical. These are package-tree findings, not21independent vulnerabilities. No suppressions/force upgrades.

| Package | Severity | Exposure | Remediation decision |
|---|---|---|---|
| @jest/core | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @nestjs/cli | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @nestjs/core | moderate | Runtime API | Runtime Nest injection advisory. Installed major10; audit suggests major12. Requires coordinated framework migration + compatibility tests, not a safe patch. Unresolved. |
| @nestjs/platform-express | moderate | Runtime API | Runtime Nest injection advisory. Installed major10; audit suggests major12. Requires coordinated framework migration + compatibility tests, not a safe patch. Unresolved. |
| @nestjs/testing | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @typescript-eslint/eslint-plugin | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @typescript-eslint/parser | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @typescript-eslint/type-utils | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @typescript-eslint/typescript-estree | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| @typescript-eslint/utils | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| create-jest | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| deepmerge | low | Development/build/test | Latest published4.3.1 remains vulnerable; no patched same-major version. Tooling config merge inputs only; do not consume untrusted config. Await upstream patch. |
| eslint-config-next | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| fork-ts-checker-webpack-plugin | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| glob | moderate | Development/build/test | Pinned10.5.0 is latest10.x; advisory spans9–14.0.1. Tooling filesystem cancellation, not a public request parser. Requires reviewed major migration. |
| jest | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| jest-cli | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| jest-config | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| minimatch | moderate | Development/build/test | Fixed>=11.0.1 requires major jump from nested9.x. Build/lint patterns only, not user route input. Await compatible upstream/coordinate tooling update. |
| ts-jest | low | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |
| typescript-eslint | moderate | Development/build/test | Transitive tooling finding; fix underlying deepmerge/minimatch or coordinated upstream tooling release. No blind major downgrade suggested by audit. |

Exposure assessment is source/package-path review, not an exploit proof. Nest runtime finding remains a release risk; no claim of non-exploitability. Existing guards do not remediate framework injection. All21findings remain open; safe same-major patched versions for underlying advisory packages were not found in registry checks (`npm view deepmerge version`, `glob@10`, `minimatch@9`).

## Superseding runtime remediation (master execution)

Controlled security-driven migration: API and worker Nest core/common11.2.9, API platform-express/testing11.2.9, config4.0.4, jwt11.0.2, Express5types. Removed obsolete platform body-parser1override (Nest11usesExpress5); preserved other scoped security overrides. This is an explicit coordinated major migration to fix GHSA-36xv-jgw5-4q75, not audit --force. Both workspace runtime versions were migrated; leaving worker Nest10 initially retained the advisory, which was detected and corrected.

Fresh clean npmci, API36suites499tests, all-workspace production builds and API lint passed. Worker build passed; actual Redis/S3/transcoding job runtime is not newly verified. Audit21 ->18(8low10moderate,0high0critical); `npm audit --omit=dev --json` reports ZERO production findings. Remaining18are development/build/test dependency paths; original Nest core/platform/testing rows above are historical, now resolved. Remaining glob/minimatch/deepmerge tooling remediation still requires supported upstream changes; no suppressed findings or arbitrary downgrade.
