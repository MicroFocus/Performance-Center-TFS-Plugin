# OpenText Enterprise Performance Engineering CI plugin for Azure DevOps Server

![CI Build](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/actions/workflows/release.yml/badge.svg)

The **"OpenText Enterprise Performance Engineering CI"** extension integrates performance tests designed in OpenText Enterprise Performance Engineering projects with Azure DevOps Server pipelines.  
The extension ships **two independent tasks**:

| Task | Purpose |
|---|---|
| **Enterprise Performance Engineering Test** (`LreCiTask`) | Run a performance test from a pipeline and collect results |
| **Enterprise Performance Engineering Workspace Sync** (`LreWorkspaceSyncTask`) | Scan a repository for script folders, zip them, and upload to an Enterprise Performance Engineering project |

## Active Codebase

Both tasks are implemented in **TypeScript / Node.js** and live under `angular/`:

```
angular/
  vss-extension.json                # Extension manifest (publisher, version, files)
  package.json                      # Single project root — all deps + all scripts
  src/
    ci/                             # Enterprise Performance Engineering REST API client, runner, downloader
    sync/                           # Script uploader, sync runner, zip compressor, scanner
    shared/                         # Shared Logger and server URL parser (used by both tasks)
  LreCiTask/
    task.json                       # Azure DevOps task definition (inputs, execution handlers)
    index.js / index.ts             # Bootstrap entry point
    dist/                           # Compiled output (generated — do not edit)
    node_modules/                   # Bundled runtime dependencies (copied at package time)
  LreWorkspaceSyncTask/
    task.json                       # Azure DevOps task definition
    index.js / index.ts             # Bootstrap entry point
    dist/                           # Compiled output (generated — do not edit)
    node_modules/                   # Bundled runtime dependencies (copied at package time)
```

The legacy C#/.NET projects (`PC.Plugins.*`, `PC.TFS.BuildTask/`) remain in the repository for reference only and are **not maintained**.

## System Prerequisites

| Requirement | Notes |
|---|---|
| Azure DevOps Server | 2019 or later |
| Agent | v3.x recommended (bundles Node 20). v2.x agents on Windows also work via the Node 20 externals when present. |
| Node.js on agent | Provided by the agent externals — no separate installation needed |
| Enterprise Performance Engineering server | Accessible from the agent host |

## Installing the Extension

1. Download the latest `.vsix` from the [GitHub Releases](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/releases) page or the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. In Azure DevOps Server Administration Console → **Extensions** → **Upload extension**, select the VSIX.
3. Install it to your team project collection.

## Task 1 — Running a Performance Test

1. Open your build pipeline definition and add the **"Enterprise Performance Engineering Test"** task.
2. Fill in the required inputs (server URL, credentials, domain, project, test ID).
3. Run the pipeline — the task authenticates, creates or resolves a timeslot, monitors the run, and downloads the result artifacts automatically.

For full configuration details see the [documentation](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm).

## Task 2 — Enterprise Performance Engineering Workspace Sync

The **Enterprise Performance Engineering Workspace Sync** task scans a local directory (typically `$(Build.SourcesDirectory)`) for Enterprise Performance Engineering performance test script folders, compresses each into a ZIP, and uploads them to the configured Enterprise Performance Engineering project — keeping the Enterprise Performance Engineering test plan in sync with the repository automatically.

**Script detection rules:** a folder is treated as a script when it contains a file ending in `.usr`, `.jmx`, `.scala`, or `.java`, *or* when it contains both `main.js` and `rts.yml` (DevWeb scripts).

### Key inputs

| Input | Default | Description |
|---|---|---|
| `varPCServer` | — | Enterprise Performance Engineering server URL (optional tenant GUID via `?tenant=<guid>`) |
| `varWorkspaceDir` | `$(Build.SourcesDirectory)` | Root directory to scan for script folders |
| `varParallelUploads` | **1** | Concurrent uploads (1–20). Default is **1 (sequential)** — increase only when the target Enterprise Performance Engineering release supports concurrent uploads |
| `varSuccessThreshold` | *(empty)* | Minimum % of scripts that must upload successfully for the task to pass (see below) |
| `varRuntimeOnly` | `false` | Upload scripts as runtime-only (cannot be edited in the Enterprise Performance Engineering UI) |

### Success threshold rules

The `varSuccessThreshold` parameter (optional, integer 0–100) controls the pass/fail decision:

| Value | Behaviour |
|---|---|
| *(empty / not set)* | Default behaviour — task passes when ≥ 50% of scripts uploaded successfully |
| `0` | Task passes even if **zero** scripts were uploaded (authentication failure still fails the task) |
| `100` | Task fails if **even one** script fails to upload |
| Outside 0–100 | Falls back to the default (50%) |

> **Note:** 5 consecutive upload failures always abort the task with failure, regardless of the threshold setting.

## Developer Quick Start

```powershell
# ── Single install for both tasks ────────────────────────────────────────────
cd angular
npm install            # one npm install covers the whole project

# Type-check both tasks
npm test

# Build both tasks to dist/
npm run build          # or: npm run build:ci / npm run build:sync

# Package VSIX (output: Extension/)
npm run package:vsix   # requires: npm install -g tfx-cli
```

See [`angular/LOCAL-TESTING-GUIDE.md`](./angular/LOCAL-TESTING-GUIDE.md) for local test options and [`AGENTS.md`](./AGENTS.md) for the AI coding agent guide.

## Release Process

1. Edit `release/deploy.txt`: set `enabled=true` and `version=X.Y.Z`
2. Commit and push to `master` — the `release.yml` workflow updates all version files (both tasks + extension manifest), builds the VSIX, creates a GitHub Release, then resets `enabled=false`
