# Dependency audit review — no warnings hidden

Baseline at 997fcd1: runtime 0; full 18 (8 low, 10 moderate). Re-reviewed using
`npm audit --json` and `npm ls deepmerge minimatch glob --all`. All 18 findings are
**development/build-tool graph**; this does not mean harmless or suppressed.

Three root advisories account for the propagated affected-package entries:

| Root advisory | Installed affected range | Action |
|---|---|---|
| GHSA-gcqx-w48m-w2h4, deepmerge prototype poisoning |4.3.1; affected >=4.2.0 <=4.3.1|Registry latest remains4.3.1; no patched same-major release. Retain warning; only trusted build/test inputs; no arbitrary merge from customer objects in runtime.|
| GHSA-3g3m-2fjr-6pw4, glob cancellation bypass |10.5.0; affected9..14.0.1|No patched10.x version available. Moving to a new major changes CLI/Node contracts; do not force an override or pretend downgrade is a safe patch. Retain warning.|
| GHSA-g3hv-75wg-m249, minimatch amplification |9.0.9 and10.2.6; affected7..<11.0.1|No9.x/10.x patched release.11.x is a major migration, not an authorized random audit fix. Retain warning and trusted fixed build globs.|

Every affected entry reviewed:
- Low: @jest/core, create-jest, deepmerge, fork-ts-checker-webpack-plugin,
  jest, jest-cli, jest-config, ts-jest.
- Moderate: @nestjs/cli, @typescript-eslint/eslint-plugin,
  @typescript-eslint/parser, @typescript-eslint/type-utils,
  @typescript-eslint/typescript-estree, @typescript-eslint/utils,
  eslint-config-next, glob, minimatch, typescript-eslint.

The audit's suggested changes include Jest25, ts-jest25, TypeScript-ESLint6 and
Next ESLint15, i.e. breaking **downgrades**, not verified security upgrades for this
Nest11/Next16/Node22+ repository. No `audit fix --force`, warning suppression,
assertion removal, arbitrary major override or dependency deletion was used.
No same-major actionable patch was available at review time. Remaining 18 are
explicitly OPEN, not FIXED or accepted production risk. Re-evaluate registry patches
before release, and review a separately authorized major toolchain migration with
all native/build/browser tests if upstream does not provide compatible fixes.
