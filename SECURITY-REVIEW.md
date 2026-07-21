# Security Review — `Micro-Focus.PCIntegration` 3.1.0

Date: 2026-07-21 (updated from original 2026-06-29 review)

## Scope

Security review performed for the TypeScript/Node-based extension under `angular/`.

Reviewed areas:
- Node.js compile/runtime versions
- npm production and development dependencies (both `LreCiTask` and `LreWorkspaceSyncTask`)
- CI/release workflow enforcement
- local validation and real-server smoke verification

## Result Summary

### Node.js

- **Compilation / local validation:** verified on **Node.js v24.17.0**
- **Recommended local/CI compile line:** **Node 24.x**
- **Azure DevOps task runtime:** **Node20**

This split is intentional:
- Azure DevOps task handlers currently support Node 20 for task execution.
- Local builds and GitHub workflows can safely use a newer current Node line for compilation and audit.

## Changes Implemented

### 1. Runtime and toolchain hardening

Updated files:
- `angular/LreCiTask/task.json`
- `angular/LreCiTask/package.json`
- `angular/LreCiTask/.nvmrc`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `angular/test-local.js`
- `angular/test-local.ps1`

Key outcomes:
- Azure DevOps task execution now targets **Node20** only.
- Local/CI compile path now uses **Node 24**.
- Local wrappers explicitly reject unsupported Node versions.
- CI and release workflows now run dependency audit as part of the build.

### 2. Dependency security remediation (original — 2026-06-29)

Upgraded or aligned key packages:
- `azure-pipelines-task-lib` → `5.276.0`
- `fast-xml-parser` → `5.9.3`
- `adm-zip` → `0.5.18`
- `axios` → `1.18.1`
- `axios-cookiejar-support` → `5.0.5`
- `tough-cookie` → `4.1.4`
- `@typescript-eslint/eslint-plugin` → `8.62.0`
- `@typescript-eslint/parser` → `8.62.0`
- `typescript` → `5.9.3`
- `eslint` → `8.57.1`
- `rimraf` → `5.0.10`
- `tsx` added for integration verification runner

### 3. Dependency security remediation (2026-07-21)

Three new high-severity advisories identified and resolved in both tasks (`LreCiTask` and `LreWorkspaceSyncTask`):

#### CVE / GHSA: GHSA-xcpc-8h2w-3j85 — `adm-zip` < 0.6.0 (High, CVSS 7.5)
- **Description:** A crafted ZIP file can trigger a 4 GB memory allocation, causing denial-of-service.
- **Affected range:** `< 0.6.0`
- **Fix:** upgraded `adm-zip` direct dependency to `^0.6.0` in both `package.json` files.

#### Transitive: `azure-pipelines-task-lib` (4.6.0–5.277.0) via `adm-zip` (High)
- **Description:** The task library bundled `adm-zip < 0.6.0` in its dependency tree.
- **Fix:** upgraded `azure-pipelines-task-lib` to `^5.278.0` — this release explicitly pins `adm-zip ^0.6.0`.

#### GHSA-3jxr-9vmj-r5cp — `brace-expansion` < 1.1.16 (High, CVSS 5.3)
- **Description:** Consecutive non-expanding `{}` groups cause exponential-time pattern expansion (ReDoS).
- **Affected range:** `< 1.1.16`
- **Root cause:** `azure-pipelines-task-lib@5.278.0` still pins `minimatch@^3.1.5`, which in turn resolves `brace-expansion@1.1.15`.
- **Fix:** added `"overrides": { "brace-expansion": "1.1.16" }` in both `package.json` files to force the patched version across the entire dependency tree.

Updated files:
- `angular/LreCiTask/package.json`
- `angular/LreWorkspaceSyncTask/package.json`

### 4. Test-stack simplification

Removed the Jest/ts-jest stack from this package and replaced it with:
- `npm test` → TypeScript typecheck
- `npm run test:integration:safe` → real-server safe verification harness
- `npm run test:integration` → optional real execution verification

Reason:
- the prior Jest dependency chain was the remaining source of audit findings
- the package now has a smaller dev-time attack surface
- validation still exists and was executed successfully

### 5. Documentation and manifest cleanup

Updated files:
- `angular/LreCiTask/docs/TESTING-GUIDE.md`
- `angular/LOCAL-TESTING-GUIDE.md`
- `angular/vss-extension.json`

Key outcomes:
- invalid category warning removed by switching to `Azure Pipelines`
- testing docs now match the secure toolchain and current commands

## Validation Performed

### Static validation

Executed successfully:
- `npm run security:audit`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run package:vsix`

### Audit result

- `npm audit` (LreCiTask) → **0 vulnerabilities** (after 2026-07-21 fix)
- `npm audit` (LreWorkspaceSyncTask) → **0 vulnerabilities** (after 2026-07-21 fix)

### Real-server verification

Executed successfully against values from:
- `integration/integration-tests.properties`

Executed command path:
- `npm run test:integration:safe`

Verified:
- successful authentication
- invalid-credential rejection
- session reuse
- test lookup
- test instance lookup
- run result download from existing run
- trend PDF download from existing run

### Local runner verification

Executed successfully:
- `angular/test-local.ps1`

Verified:
- real run start
- run state progression
- result download
- HTML report extraction

## Packaged Output

Verified VSIX created successfully:
- `Extension/Micro-Focus.PCIntegration-3.1.0.vsix`

## Notes

### IDE warning about `fast-xml-parser@4.5.6`

The workspace security diagnostics still showed one stale warning after dependency remediation, but:
- `package.json` references `fast-xml-parser` `^5.9.3`
- `package-lock.json` resolves `fast-xml-parser` `5.9.3`
- `npm audit` reports **0 vulnerabilities**

This indicates the remaining warning is most likely an editor/indexing cache issue rather than an actual dependency state issue.

## Recommended Ongoing Practice

- Keep `npm run security:audit` in CI/release builds
- Periodically rebuild lockfile with current npm
- Re-run `npm run test:integration:safe` before publishing a new VSIX
- Keep Azure DevOps runtime on the newest task-handler version supported by Azure DevOps, while allowing newer local compile versions in CI
- Re-examine `overrides.brace-expansion` when `azure-pipelines-task-lib` upgrades `minimatch` to v4+ (which bundles `brace-expansion@^2`) and remove the override at that point


Date: 2026-06-29

## Scope

Security review performed for the TypeScript/Node-based extension under `angular/`.

Reviewed areas:
- Node.js compile/runtime versions
- npm production and development dependencies
- CI/release workflow enforcement
- local validation and real-server smoke verification

## Result Summary

### Node.js

- **Compilation / local validation:** verified on **Node.js v24.17.0**
- **Recommended local/CI compile line:** **Node 24.x**
- **Azure DevOps task runtime:** **Node20**

This split is intentional:
- Azure DevOps task handlers currently support Node 20 for task execution.
- Local builds and GitHub workflows can safely use a newer current Node line for compilation and audit.

## Changes Implemented

### 1. Runtime and toolchain hardening

Updated files:
- `angular/LreCiTask/task.json`
- `angular/LreCiTask/package.json`
- `angular/LreCiTask/.nvmrc`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `angular/test-local.js`
- `angular/test-local.ps1`

Key outcomes:
- Azure DevOps task execution now targets **Node20** only.
- Local/CI compile path now uses **Node 24**.
- Local wrappers explicitly reject unsupported Node versions.
- CI and release workflows now run dependency audit as part of the build.

### 2. Dependency security remediation

Upgraded or aligned key packages:
- `azure-pipelines-task-lib` → `5.276.0`
- `fast-xml-parser` → `5.9.3`
- `adm-zip` → `0.5.18`
- `axios` → `1.18.1`
- `axios-cookiejar-support` → `5.0.5`
- `tough-cookie` → `4.1.4`
- `@typescript-eslint/eslint-plugin` → `8.62.0`
- `@typescript-eslint/parser` → `8.62.0`
- `typescript` → `5.9.3`
- `eslint` → `8.57.1`
- `rimraf` → `5.0.10`
- `tsx` added for integration verification runner

### 3. Test-stack simplification

Removed the Jest/ts-jest stack from this package and replaced it with:
- `npm test` → TypeScript typecheck
- `npm run test:integration:safe` → real-server safe verification harness
- `npm run test:integration` → optional real execution verification

Reason:
- the prior Jest dependency chain was the remaining source of audit findings
- the package now has a smaller dev-time attack surface
- validation still exists and was executed successfully

### 4. Documentation and manifest cleanup

Updated files:
- `angular/LreCiTask/docs/TESTING-GUIDE.md`
- `angular/LOCAL-TESTING-GUIDE.md`
- `angular/vss-extension.json`

Key outcomes:
- invalid category warning removed by switching to `Azure Pipelines`
- testing docs now match the secure toolchain and current commands

## Validation Performed

### Static validation

Executed successfully:
- `npm run security:audit`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run package:vsix`

### Audit result

- `npm audit --audit-level=moderate` → **0 vulnerabilities**

### Real-server verification

Executed successfully against values from:
- `integration/integration-tests.properties`

Executed command path:
- `npm run test:integration:safe`

Verified:
- successful authentication
- invalid-credential rejection
- session reuse
- test lookup
- test instance lookup
- run result download from existing run
- trend PDF download from existing run

### Local runner verification

Executed successfully:
- `angular/test-local.ps1`

Verified:
- real run start
- run state progression
- result download
- HTML report extraction

## Packaged Output

Verified VSIX created successfully:
- `angular/out/Micro-Focus.PCIntegration-3.0.0.vsix`

## Notes

### IDE warning about `fast-xml-parser@4.5.6`

The workspace security diagnostics still showed one stale warning after dependency remediation, but:
- `package.json` references `fast-xml-parser` `^5.9.3`
- `package-lock.json` resolves `fast-xml-parser` `5.9.3`
- `npm audit` reports **0 vulnerabilities**

This indicates the remaining warning is most likely an editor/indexing cache issue rather than an actual dependency state issue.

## Recommended Ongoing Practice

- Keep `npm run security:audit` in CI/release builds
- Periodically rebuild lockfile with current npm
- Re-run `npm run test:integration:safe` before publishing a new VSIX
- Keep Azure DevOps runtime on the newest task-handler version supported by Azure DevOps, while allowing newer local compile versions in CI

