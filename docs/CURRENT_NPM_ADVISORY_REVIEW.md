# Current npm advisory review

This review supersedes historical dependency counts in SECURITY_AUDIT.md, not its application-security limitations. Findings are dependency nodes, not 18 independent vulnerabilities. No force fix, suppression or ignored advisory is used.

**Full workspace:** 18 open (8 low, 10 moderate, zero high/critical). **Production-only:** zero npm findings. This excludes OS images, downloaded MinIO/MC binaries, mobile’s separate dependency graph and legal/source compliance.

## Root causes and disposition

- **deepmerge 4.3.1:** prototype poisoning in mergeObject; latest published version is still 4.3.1. Used by Jest configuration and Nest CLI type checking, not a runtime request handler. A suggested Jest 25 downgrade is not a secure compatible update. Keep configuration trusted; open pending upstream patch/replacement review.
- **glob 10.5.0:** cancellation does not bound traversal; also inherits minimatch. The latest 10.x is 10.5.0. Patched glob 14.0.5 requires a multi-major migration, not an honest same-major fix. Existing CLI-scoped override retains earlier command-injection remediation. Keep build patterns/files trusted and bound CI execution.
- **minimatch 9.0.9 / 10.2.6:** globparts amplification DoS. Patched 11.0.8 requires a major across parser/CLI transitive consumers. Latest typescript-eslint 8.72.2 is still included in the advisory range. Do not pretend a parser downgrade to 6.15.0 or eslint-config-next downgrade to 15.x is a compatible remedy. No user-supplied lint patterns are accepted by HTTP handlers.

These are development-tool boundaries, not a claim that untrusted pull requests or malicious config are safe. Use isolated CI without production credentials; do not execute unreviewed third-party build configuration. A separately tested upstream migration/patch is required to close the findings.

## All current affected dependency nodes

| Package | Severity | Root/inherited path | Status |
|---|---|---|---|
| @jest/core | low | jest-config | OPEN — above compatibility/exposure review |
| @nestjs/cli | moderate | fork-ts-checker-webpack-plugin, glob | OPEN — above compatibility/exposure review |
| @typescript-eslint/eslint-plugin | moderate | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils | OPEN — above compatibility/exposure review |
| @typescript-eslint/parser | moderate | @typescript-eslint/typescript-estree | OPEN — above compatibility/exposure review |
| @typescript-eslint/type-utils | moderate | @typescript-eslint/typescript-estree, @typescript-eslint/utils | OPEN — above compatibility/exposure review |
| @typescript-eslint/typescript-estree | moderate | minimatch | OPEN — above compatibility/exposure review |
| @typescript-eslint/utils | moderate | @typescript-eslint/typescript-estree | OPEN — above compatibility/exposure review |
| create-jest | low | jest-config | OPEN — above compatibility/exposure review |
| deepmerge | low | deepmerge | OPEN — above compatibility/exposure review |
| eslint-config-next | moderate | typescript-eslint | OPEN — above compatibility/exposure review |
| fork-ts-checker-webpack-plugin | low | deepmerge | OPEN — above compatibility/exposure review |
| glob | moderate | glob, minimatch | OPEN — above compatibility/exposure review |
| jest | low | @jest/core, jest-cli | OPEN — above compatibility/exposure review |
| jest-cli | low | @jest/core, create-jest, jest-config | OPEN — above compatibility/exposure review |
| jest-config | low | deepmerge | OPEN — above compatibility/exposure review |
| minimatch | moderate | minimatch | OPEN — above compatibility/exposure review |
| ts-jest | low | jest | OPEN — above compatibility/exposure review |
| typescript-eslint | moderate | @typescript-eslint/eslint-plugin, @typescript-eslint/parser, @typescript-eslint/typescript-estree, @typescript-eslint/utils | OPEN — above compatibility/exposure review |

## Reproduction

```sh
npm audit --json
npm audit --omit=dev --json
npm ls deepmerge glob minimatch --all
npm view deepmerge version
npm view glob@10 version
npm view @typescript-eslint/parser version
```

Local full builds, API suites, lint and contract tests are recorded separately; native/browser/Auth/Compose proof must be tied to a specific CI SHA. A zero npm runtime audit does not certify distribution readiness.
