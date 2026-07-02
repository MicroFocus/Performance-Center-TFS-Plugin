# OpenText Enterprise Performance Engineering CI plugin for Azure DevOps Server

![CI Build](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/actions/workflows/release.yml/badge.svg)

The **"OpenText Enterprise Performance Engineering CI"** extension integrates performance tests designed in OpenText Enterprise Performance Engineering (LRE) projects with Azure DevOps Server pipelines.

## Active Codebase

The extension is implemented in **TypeScript / Node.js** and lives entirely under `angular/`:

```
angular/
  vss-extension.json          # Extension manifest (publisher, version, files)
  LreCiTask/
    task.json                 # Azure DevOps task definition (inputs, execution handlers)
    index.js                  # Bootstrap entry point (Node version guard + polyfills)
    index.ts                  # TypeScript source of bootstrap
    src/lre/                  # LRE REST API client, authenticator, runner, downloader
    src/models/               # TypeScript entity interfaces
    src/utils/                # Logger, ArtifactManager, XmlUtils
    dist/                     # Compiled output (generated — do not edit)
    node_modules/             # Bundled runtime dependencies
```

The legacy C#/.NET projects (`PC.Plugins.*`, `PC.TFS.BuildTask/`) remain in the repository for reference only and are **not maintained**.

## System Prerequisites

| Requirement | Notes |
|---|---|
| Azure DevOps Server | 2019 or later |
| Agent | v3.x recommended (bundles Node 20). v2.x agents on Windows also work via the Node 20 externals when present. |
| Node.js on agent | Provided by the agent externals — no separate installation needed |
| LRE server | Accessible from the agent host |

## Installing the Extension

1. Download `Micro-Focus.PCIntegration-3.0.0.vsix` from the [GitHub Releases](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/releases) page or the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. In Azure DevOps Server Administration Console → **Extensions** → **Upload extension**, select the VSIX.
3. Install it to your team project collection.

## Running a Test from a Pipeline

1. Open your build pipeline definition and add the **"Enterprise Performance Engineering Test"** task.
2. Fill in the required inputs (server URL, credentials, domain, project, test ID).
3. Run the pipeline — the task authenticates, creates or resolves a timeslot, monitors the run, and downloads the result artifacts automatically.

For full configuration details see the [documentation](https://admhelp.microfocus.com/lr/en/latest/help/WebHelp/Content/Controller/Azure_DevOps.htm).

## Developer Quick Start

```powershell
# Build
cd angular/LreCiTask
npm install
npm run build          # compiles TypeScript → dist/

# Type-check only
npm test

# Package VSIX (output: angular/out/)
npm run package:vsix   # requires: npm install -g tfx-cli
```

See [`angular/LOCAL-TESTING-GUIDE.md`](./angular/LOCAL-TESTING-GUIDE.md) for local test options and [`AGENTS.md`](./AGENTS.md) for the AI coding agent guide.

## Release Process

1. Edit `release/deploy.txt`: set `enabled=true` and `version=X.Y.Z`
2. Commit and push to `master` — the `release.yml` workflow updates all version files, builds the VSIX, creates a GitHub Release, then resets `enabled=false`
