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
