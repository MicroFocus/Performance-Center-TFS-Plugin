# LreDownloadScriptsTask — Internal Developer Documentation

## Overview

`LreDownloadScriptsTask` is an Azure DevOps pipeline task (and PluginUI standalone task) that
**downloads all performance-test scripts** from an OpenText Enterprise Performance Engineering (LRE)
server domain/project into a local workspace directory.

It is the mirror-image of `LreWorkspaceSyncTask` (which _uploads_ scripts).  The two tasks share
the same authentication strategy, proxy support, parallel-queue pattern, and logging format.

---

## Architecture

```
angular/
├── LreDownloadScriptsTask/        ← task folder (not in vsix)
│   ├── index.js                   ← Node bootstrap + polyfills
│   ├── index.ts                   ← Azure DevOps task entry-point
│   ├── task.json                  ← ADO task definition
│   ├── tsconfig.json              ← builds into ./dist/
│   └── dist/                      ← compiled output (gitignored)
│       └── LreDownloadScriptsTask/
│           └── index.js
└── src/
    └── download/                  ← shared TypeScript library
        ├── models/
        │   └── index.ts           ← LreDownloadConfig, RemoteScript, DownloadResult
        └── lre/
            ├── LreScriptDownloader.ts      ← REST API client (auth + download)
            └── LreScriptDownloadRunner.ts  ← parallel worker pool + extraction
```

---

## REST API used

All calls go to `/LoadTest/rest/domains/{domain}/projects/{project}/`:

| Method | Endpoint            | Purpose                                 |
|--------|---------------------|-----------------------------------------|
| GET    | `/Scripts`          | List all scripts (name, ID, folder path)|
| GET    | `/scripts/{id}/zip` | Download script content as zip binary   |

> **Note:** The listing endpoint uses capital `Scripts`; the download endpoint uses lowercase
> `scripts` with a `/zip` suffix — as defined in the public LRE REST API reference:
> `GET /LoadTest/rest/domains/{domainName}/projects/{projectName}/scripts/{ID}/zip`

Authentication uses the same endpoints as `LreScriptUploader`:
- Username/password → `GET /authentication-point/authenticate`
- API token (SSO)  → `POST /authentication-point/authenticateclient`

---

## Download & Extraction Flow

### Per-script sequence

```
1. GET /Scripts/{id}/content  →  raw zip binary (Buffer)
2. Write Buffer to temp .usz  →  OS temp directory  (e.g. /tmp/lre_download_42_1722170000000.usz)
3. Extract zip contents       →  target directory   (see "Local directory mapping" below)
4. Delete temp .usz           →  always, in finally block
```

### Local directory mapping

The server stores each script under a `TestFolderPath` that always starts with `Subject\`.
The task strips `Subject\` and appends the script's own name as the final directory component:

```
Server:  TestFolderPath = "Subject\folder1\SubFolder1"   Name = "MyScript"
Local:   {workspaceDir}\folder1\SubFolder1\MyScript\
```

Edge case — script at root level:
```
Server:  TestFolderPath = "Subject"   Name = "RootScript"
Local:   {workspaceDir}\RootScript\
```

The extracted directory **mirrors the content** of the `.usz` zip (which is a standard zip file):
files and sub-folders are written exactly as they appear inside the archive.

> **Note:** The `.usz` file is a temporary artefact and is always removed after extraction,
> even when extraction succeeds.  It is never left in the workspace.

---

## Parallel download queue

Identical pattern to `LreWorkspaceSyncRunner`:

- Configurable concurrency `1–20` (default 1, sequential).
- Each worker picks the next script from a shared index counter (`nextIndex++`).
- Each worker buffers its log lines in a `DownloadBuffer` and flushes them **atomically** when
  done, so lines from concurrent downloads never interleave in the console output.
- **Consecutive-failure abort**: 5 consecutive failures abort immediately regardless of threshold.
- **Success threshold** (0–100 %): overall task passes only if
  `successfulDownloads / total >= threshold`.  Default 50 %.

---

## Configuration (task inputs → `LreDownloadConfig`)

| task.json input           | `LreDownloadConfig` field | Notes                                       |
|---------------------------|---------------------------|---------------------------------------------|
| `varPCServer`             | `serverUrl` + `tenant`    | Parsed by `parseServerInput()`              |
| `varUseTokenForAuthentication` | `useToken`          |                                             |
| `varUserName`             | `username` / `clientId`   |                                             |
| `varPassWord`             | `password` / `clientSecret` |                                           |
| `varDomain`               | `domain`                  |                                             |
| `varProject`              | `project`                 |                                             |
| `varWorkspaceDir`         | `workspaceDir`            | Root of the local download directory        |
| `varParallelDownloads`    | _(runner arg)_            | Clamped 1–20                                |
| `varSuccessThreshold`     | _(runner arg)_            | 0–100 %; empty → 50 %                       |
| `varProxyUrl/User/Password` | `proxyUrl/User/Password` |                                            |
| `varArtifactsDir`         | `artifactsDir`            | Log-file directory                          |

---

## Logging format

Identical to `LreWorkspaceSyncTask`:
- Every line is timestamped: `[ISO-8601] message`
- Log file written to `artifactsDir` (timestamped filename: `lre_workspace_sync_*.log`).
- Per-script log blocks are buffered and flushed atomically (one block per script).

---

## Building

```bash
cd angular
npm run build:download          # compile LreDownloadScriptsTask only
npm run build                   # compile all three tasks (ci + sync + download)
npm run typecheck:download      # type-check without emitting
```

Compiled output: `angular/LreDownloadScriptsTask/dist/`

---

## vsix packaging

`LreDownloadScriptsTask` is **not included** in the vsix extension (`vss-extension.json` is not
modified).  It is intended to be used:
- As a standalone task launched by `PluginsUI.exe` (Download Scripts tab).
- By future pipeline integrations that reference the task folder directly.

---

## Dependencies

All shared with `LreWorkspaceSyncTask` / `LreCiTask` — no new production deps introduced:
- `axios` + `axios-cookiejar-support` + `tough-cookie` — HTTP with session cookies
- `fast-xml-parser` — parse `/Scripts` list response
- `adm-zip` — extract `.usz` archive content
- `azure-pipelines-task-lib` — task input/output/result API

