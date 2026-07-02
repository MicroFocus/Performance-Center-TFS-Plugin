# AGENTS.md — AI Coding Agent Guide

## Project Overview

Azure DevOps extension that runs **OpenText Enterprise Performance Engineering** performance tests as CI pipeline tasks. The extension packages as a `.vsix` file and is installed on Azure DevOps Server.

## Architecture

**Two implementations coexist — only the TypeScript one is actively maintained:**

| Layer | Location | Status |
|---|---|---|
| TypeScript/Node.js extension | `angular/LreCiTask/` | ✅ Active — primary codebase |
| Legacy C#/.NET plugins | `PC.Plugins.*/`, `PC.TFS.BuildTask/` | 🔒 Legacy — do not modify |

The `angular/` directory is a standalone workspace; it builds, tests, and packages independently.

### TypeScript Extension Structure (`angular/LreCiTask/`)

```
index.ts                  # Task entrypoint — reads task.json inputs, orchestrates execution
src/lre/
  LreClient.ts            # All LRE REST API HTTP calls (auth, test mgmt, run mgmt, reports)
  LreAuthenticator.ts     # Auth helpers
  LreTestRunner.ts        # Polling loop — monitors run state until terminal state
  LreReportDownloader.ts  # Downloads result ZIPs and trend PDFs
src/models/index.ts       # TypeScript interfaces (ported from C# PCEntities namespace)
src/utils/
  Logger.ts               # Log wrapper (writes to artifacts dir + tl.debug/error/warning)
  ArtifactManager.ts      # File/directory helpers
  XmlUtils.ts             # XML serialization helpers
task.json                 # Azure DevOps task manifest — input names are the contract
```

## Critical Patterns

### LRE REST API Uses XML, Not JSON
All requests/responses use `application/xml`. The `fast-xml-parser` library is used. **Key gotcha**: the parser returns a single object when there is one child element, or an array when there are many — always normalize to array:
```typescript
const all = raw.TestInstance
    ? (Array.isArray(raw.TestInstance) ? raw.TestInstance : [raw.TestInstance])
    : [];
```

### HTTP Errors Are Never Thrown — Check Manually
`axios` is configured with `validateStatus: () => true`. Always check with the private `isSuccessResponse()` helper (accepts 200/201/202/204):
```typescript
if (!this.isSuccessResponse(response)) { /* handle error */ }
```

### Node.js Execution Handler Fallback Chain
`task.json` declares four execution handlers in priority order:
```json
"execution": { "Node20_1": {...}, "Node20": {...}, "Node16": {...}, "Node": {...} }
```
Azure DevOps picks the highest version the agent supports. `Node20_1` is a newer Node 20 patch batch (recent agents); `Node20` covers older Node 20 externals; `Node16` catches agents without Node 20; `Node` (v6) is the last resort. The bootstrap `index.js` **hard-fails with a clear error message before loading any modules** when it detects Node < 16, because `axios` v1.x uses ES2018 object-spread syntax that is a parse-time error on Node 6 — polyfills cannot fix syntax errors. Polyfills are provided only for the gap between Node 16 and Node 20 built-ins: `crypto.randomUUID`, `globalThis`, `Object.fromEntries`, `Array.prototype.flat/flatMap`, `Promise.allSettled`, `String.prototype.trimStart/trimEnd`, `queueMicrotask`.

> ⚠️ The polyfills patch `crypto.randomUUID` via `crypto.randomBytes` — functionally correct but weaker entropy guarantees than the native implementation.

### Input Name Casing Must Match `task.json` Exactly
Two known traps in `index.ts`:
- `varPassWord` (capital W) — not `varPassword`
- `vartimeslotRepeat` (lowercase t) — not `varTimeslotRepeat`

### Tenant Parsing
Server URL may carry `?tenant=<guid>`. It is parsed out in `parseServerInput()` and appended only to auth endpoints (`/authenticate`, `/authenticateclient`, `/logout`), not to resource endpoints.

### Version Is Kept in Three Files
These must stay in sync; the release workflow updates them automatically from `release/deploy.txt`:
- `angular/vss-extension.json` → `"version"`
- `angular/LreCiTask/task.json` → `"version": { "Major", "Minor", "Patch" }`
- `angular/LreCiTask/package.json` → `"version"`

## Developer Workflows

All commands run from `angular/LreCiTask/` unless noted.

```powershell
# Install dependencies
npm install

# Type-check only (this IS the "test" script)
npm test          # runs: tsc --noEmit

# Build to dist/
npm run build

# Lint
npm run lint

# Package VSIX (output goes to angular/out/)
npm run package:vsix   # requires tfx-cli: npm install -g tfx-cli

# Local task test with PowerShell wrapper
cd angular
.\test-local.ps1 -PCServer "http://lre-server:80" -Domain "DEFAULT" -Project "MyProject" -TestID "1" -UserName "admin" -Password "pass"
```

**Local env vars** for direct `node dist/index.js` execution:
`INPUT_VARPCSERVER`, `INPUT_VARUSERNAME`, `INPUT_VARPASSWORD`, `INPUT_VARDOMAIN`, `INPUT_VARPROJECT`, `INPUT_VARTESTID`, `INPUT_VARARTIFACTSDIR`

## Release Process

1. Edit `release/deploy.txt`: set `enabled=true` and bump `version=X.Y.Z`
2. Commit and push to `master` — the `release.yml` workflow auto-updates all version files, builds the VSIX, creates a GitHub Release, then resets `enabled=false`
3. To validate before pushing: `./scripts/Validate-Release.ps1`

## Integration Tests

Require a live LRE server. Config is **not committed**:
```powershell
cd integration
Copy-Item integration-tests.properties.template integration-tests.properties
# Edit with real server URL + credentials
```
Run from `angular/LreCiTask`:
```powershell
npm run test:integration          # full tests (may execute real runs)
npm run test:integration:safe     # read-only, no run execution, no license consumption
```

## Key Files to Reference

| Purpose | File |
|---|---|
| Task inputs contract | `angular/LreCiTask/task.json` |
| REST API implementation | `angular/LreCiTask/src/lre/LreClient.ts` |
| All entity types | `angular/LreCiTask/src/models/index.ts` |
| Extension manifest | `angular/vss-extension.json` |
| Release trigger | `release/deploy.txt` |
| Local test options | `angular/LOCAL-TESTING-GUIDE.md` |
| CI/CD workflows | `.github/workflows/ci.yml`, `.github/workflows/release.yml` |

