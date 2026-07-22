# AGENTS.md — AI Coding Agent Guide

## Project Overview

Azure DevOps extension that runs **OpenText Enterprise Performance Engineering** performance tests as CI pipeline tasks. The extension packages as a `.vsix` file and is installed on Azure DevOps Server.

## Architecture

**Three implementations coexist — only the TypeScript tasks are actively maintained:**

| Layer | Location | Status |
|---|---|---|
| TypeScript/Node.js CI task | `angular/LreCiTask/` | ✅ Active — primary codebase |
| TypeScript/Node.js workspace sync task | `angular/LreWorkspaceSyncTask/` | ✅ Active — second task |
| Legacy C#/.NET plugins | `PC.Plugins.*/`, `PC.TFS.BuildTask/` | 🔒 Legacy — do not modify |

The `angular/` directory contains both tasks as independent workspaces (each has its own `package.json`, `tsconfig.json`, `task.json`, and `dist/`); they must be built separately.

### TypeScript Extension Structure (`angular/`)

```
package.json                      # Single project root — all deps + all scripts
scripts/package-vsix.js           # VSIX packaging helper (builds → copies node_modules → tfx → cleanup)
src/
  ci/                             # LreCiTask source (CI test run)
    lre/
      LreClient.ts                # All Enterprise Performance Engineering REST API HTTP calls
      LreAuthenticator.ts         # Auth helpers
      LreTestRunner.ts            # Polling loop — monitors run state
      LreReportDownloader.ts      # Downloads result ZIPs and trend PDFs
    models/index.ts               # TypeScript interfaces for CI task
    utils/
      ArtifactManager.ts          # File/directory helpers
      XmlUtils.ts                 # XML serialization helpers (placeholder)
  sync/                           # LreWorkspaceSyncTask source (workspace sync)
    lre/
      LreScriptUploader.ts        # Enterprise Performance Engineering REST API: auth, folder creation, script upload
      LreWorkspaceSyncRunner.ts   # Orchestrator — scans, zips, uploads
      ZipFolderCompressor.ts      # Compresses a script folder to a ZIP buffer
    models/index.ts               # TypeScript interfaces for sync task
    scanner/
      WorkspaceScriptFolderScanner.ts  # Walks workspace and identifies Enterprise Performance Engineering script folders
  shared/                         # Shared code used by both tasks
    utils/
      Logger.ts                   # Unified log wrapper (both tasks share this)
      serverUtils.ts              # parseServerInput() — shared URL/tenant parser
LreCiTask/                        # CI task manifest + entry point only
  index.ts                        # Task entrypoint — reads task.json inputs, orchestrates run
  index.js                        # Bootstrap (Node version guard + polyfills)
  task.json                       # Azure DevOps task manifest
  tsconfig.json                   # Includes ../src/ci/**/*.ts + ../src/shared/**/*.ts
  package.json                    # Metadata only (name, version, type) — no deps
LreWorkspaceSyncTask/             # Sync task manifest + entry point only
  index.ts                        # Task entrypoint — reads task.json inputs, orchestrates sync
  index.js                        # Bootstrap
  task.json                       # Azure DevOps task manifest
  tsconfig.json                   # Includes ../src/sync/**/*.ts + ../src/shared/**/*.ts
  package.json                    # Metadata only
```

**Script detection rules** (in `WorkspaceScriptFolderScanner`): a folder is an Enterprise Performance Engineering script if it contains a file ending in `.usr`, `.jmx`, `.scala`, or `.java`, **or** if it contains both `main.js` and `rts.yml` (DevWeb scripts). Once a script folder is identified, its subtree is pruned — subdirectories are not recursed into.

## Critical Patterns

### Enterprise Performance Engineering REST API Uses XML, Not JSON
All requests/responses use `application/xml`. The `fast-xml-parser` library is used. **Key gotcha**: the parser returns a single object when there is one child element, or an array when there are many — always normalize to array:
```typescript
const all = raw.TestInstance
    ? (Array.isArray(raw.TestInstance) ? raw.TestInstance : [raw.TestInstance])
    : [];
```

**Exception — `LreWorkspaceSyncTask`**: the `/Scripts` endpoint returns **JSON**, not XML. Script *upload* uses `multipart/form-data` (via the `form-data` package): the ZIP file is part 1 and an XML metadata envelope is part 2. The `axios` instance still uses `validateStatus: () => true` and the same `isSuccessResponse()` pattern.

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
Two known traps in `LreCiTask/index.ts`:
- `varPassWord` (capital W) — not `varPassword`
- `vartimeslotRepeat` (lowercase t) — not `varTimeslotRepeat`

`LreWorkspaceSyncTask/index.ts` shares the same `varPassWord` trap. Additional inputs to watch:
- `varUseTokenForAuthentication` (full name) — not `varUseToken`
- `varParallelUploads` — controls concurrent upload goroutines (clamped 1–20, **default 1** — sequential is the safe default for servers that don't yet support concurrent multipart uploads)
- `varSuccessThreshold` — optional integer 0–100 (empty string = default 50%). Parsed by `parseSuccessThreshold()` in `index.ts`; out-of-range values fall back to 50. Controls the pass/fail decision in `processUploads()` inside `LreWorkspaceSyncRunner.ts`.
- `varBaseCommitSha` — optional git commit SHA. When non-empty, `LreWorkspaceSyncRunner` calls `git diff --name-only <sha> HEAD` in `workspaceDir` and filters the discovered script folders to those containing at least one changed file. Falls back to full sync (with a warning) if the git command fails. Implemented via `getChangedPaths()` + `filterChangedScripts()` private helpers in `LreWorkspaceSyncRunner.ts`.

### Tenant Parsing
Server URL may carry `?tenant=<guid>`. It is parsed out in `parseServerInput()` and appended only to auth endpoints (`/authenticate`, `/authenticateclient`, `/logout`), not to resource endpoints.

### Resilience Rules (LreWorkspaceSyncTask)

- **`MAX_CONSECUTIVE_FAILURES = 5`** (fixed constant in `LreWorkspaceSyncRunner.ts`) — if 5 uploads fail in a row, the task aborts immediately with failure, regardless of `successThreshold`.
- **`successThreshold`** (0–100, default 50) — after all uploads complete (or if there were no consecutive-failure aborts), the task passes only if `successfulUploads / total >= successThreshold / 100`. With threshold = 0 the task always passes unless aborted; with threshold = 100 any single failure causes a task failure.

### Version Is Kept in Six Files
These must stay in sync; the release workflow updates them automatically from `release/deploy.txt`:
- `angular/vss-extension.json` → `"version"`
- `angular/package.json` → `"version"`
- `angular/package-lock.json` → `"version"` (updated automatically by `npm version`, committed by the release workflow)
- `angular/LreCiTask/task.json` → `"version": { "Major", "Minor", "Patch" }`
- `angular/LreCiTask/package.json` → `"version"`
- `angular/LreWorkspaceSyncTask/task.json` → `"version": { "Major", "Minor", "Patch" }`
- `angular/LreWorkspaceSyncTask/package.json` → `"version"`

> Current version: **3.2.0**

## Developer Workflows

All commands run from `angular/` — there is now a **single project root** for both tasks.

```powershell
# Install all dependencies (once, covers both tasks)
cd angular
npm install

# Type-check both tasks
npm test               # runs: tsc --noEmit on both tasks

# Build both tasks to dist/
npm run build

# Build a single task
npm run build:ci       # LreCiTask only
npm run build:sync     # LreWorkspaceSyncTask only

# Lint
npm run lint

# Security audit
npm run security:audit

# Package VSIX (output goes to angular/../Extension/)
npm run package:vsix   # requires tfx-cli: npm install -g tfx-cli
```

**Local env vars** for direct `node dist/LreCiTask/index.js` execution (LreCiTask):
`INPUT_VARPCSERVER`, `INPUT_VARUSERNAME`, `INPUT_VARPASSWORD`, `INPUT_VARDOMAIN`, `INPUT_VARPROJECT`, `INPUT_VARTESTID`, `INPUT_VARARTIFACTSDIR`

**LreWorkspaceSyncTask** shares the same `angular/` project root — run from `angular/` with:
`npm run build:sync` and use env vars:
`INPUT_VARPCSERVER`, `INPUT_VARUSERNAME`, `INPUT_VARPASSWORD`, `INPUT_VARDOMAIN`, `INPUT_VARPROJECT`, `INPUT_VARWORKSPACEDIR`, `INPUT_VARRUNTIMEONLY`, `INPUT_VARPARALLELUPLOADS`, `INPUT_VARARTIFACTSDIR`

## Release Process

1. Edit `release/deploy.txt`: set `enabled=true` and bump `version=X.Y.Z`
2. Commit and push to `master` — the `release.yml` workflow auto-updates all version files, builds the VSIX, creates a GitHub Release, then resets `enabled=false`
3. To validate before pushing: `./scripts/Validate-Release.ps1`

## Integration Tests

Require a live Enterprise Performance Engineering server. Config is **not committed**:
```powershell
cd integration
Copy-Item integration-tests.properties.template integration-tests.properties
# Edit with real server URL + credentials
```
Run from `angular/` (the single project root):
```powershell
npm run test:integration          # full tests (may execute real runs)
npm run test:integration:safe     # read-only, no run execution, no license consumption
```

## Key Files to Reference

| Purpose | File |
|---|---|
| Task inputs contract (CI run) | `angular/LreCiTask/task.json` |
| REST API implementation (CI run) | `angular/src/ci/lre/LreClient.ts` |
| All entity types (CI run) | `angular/src/ci/models/index.ts` |
| Task inputs contract (workspace sync) | `angular/LreWorkspaceSyncTask/task.json` |
| Script upload + REST API (workspace sync) | `angular/src/sync/lre/LreScriptUploader.ts` |
| Script folder scanner | `angular/src/sync/scanner/WorkspaceScriptFolderScanner.ts` |
| Sync entity types | `angular/src/sync/models/index.ts` |
| Shared Logger | `angular/src/shared/utils/Logger.ts` |
| Shared server URL parser | `angular/src/shared/utils/serverUtils.ts` |
| Extension manifest | `angular/vss-extension.json` |
| Release trigger | `release/deploy.txt` |
| Local test options | `angular/LOCAL-TESTING-GUIDE.md` |
| CI/CD workflows | `.github/workflows/ci.yml`, `.github/workflows/release.yml` |

