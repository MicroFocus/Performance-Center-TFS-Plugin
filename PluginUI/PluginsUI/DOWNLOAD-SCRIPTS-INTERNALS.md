# Download Scripts Feature — PluginUI Internal Documentation

## Overview

The **Download Scripts** tab (Tab 2) in `PluginsUI.exe` allows users to download all performance-test
scripts from an OpenText Enterprise Performance Engineering (LRE) server project into a local directory,
without requiring Azure DevOps.  It mirrors the **Workspace Sync** tab but operates in the opposite
direction: instead of uploading scripts _to_ the server, it downloads scripts _from_ the server.

---

## How it works

`PluginsUI.exe` spawns a Node.js child process running `LreDownloadScriptsTask/index.js` (the angular
task), wiring all form inputs as `INPUT_*` environment variables — the same mechanism used by the
CI Test Run and Workspace Sync tabs.

```
PluginsUI.exe
 └─ LreDownloadRunner.RunAsync()
     └─ node LreDownloadScriptsTask/index.js   (child process)
         └─ LreScriptDownloadRunner.run()
             ├─ authenticate
             ├─ fetch script list  (GET /Scripts)
             └─ download + extract each script  (GET /scripts/{id}/zip)
```

---

## Local directory layout after download

Each script downloaded from the server is **extracted** into its own folder.  The folder hierarchy
mirrors the server-side test-plan path, **minus the root `Subject` segment**, and the script's own
folder is named after the script:

```
Server:  TestFolderPath = "Subject\folder1\SubFolder1"   Name = "MyScript"
Local:   {workspaceDir}\folder1\SubFolder1\MyScript\
                                                    ├── MyScript.usr     (or whatever files are inside)
                                                    └── ...
```

The `.usz` file (which is just a zip with a different extension) is downloaded to the OS temp
directory, extracted, and immediately deleted.  It never appears in the workspace.

---

## C# components

| File | Purpose |
|------|---------|
| `Models/LreDownloadConfiguration.cs` | Configuration POCO — serialised to/from JSON for Save/Load Config and auto-save |
| `Services/LreDownloadRunner.cs`       | Spawns the Node.js child process; maps form fields to `INPUT_*` env vars; streams stdout/stderr to the Output panel |

### `LreDownloadConfiguration` fields

| Property | Default | Description |
|----------|---------|-------------|
| `ServerUrl` | `https://MyServer:443` | Shared with CI/Sync tabs |
| `UseTokenForAuthentication` | false | SSO / API token mode |
| `UserName` | "" | Username or token client ID |
| `Domain` | `DEFAULT` | LRE domain |
| `Project` | "" | LRE project |
| `ProxyUrl/UserName` | "" | Optional proxy |
| `WorkspaceDir` | "" | Local download root (created automatically if absent) |
| `ParallelDownloads` | 1 | Concurrent downloads, clamped 1–20 |
| `SuccessThreshold` | "" | Minimum % success; empty → task default (50 %) |
| `ArtifactsDirectory` | "" | Log-file output dir; empty → OS temp |
| `NodeDistPath` | "" | Auto-detected if empty |
| `Description` | "" | Free-text run label |

### `LreDownloadRunner` — dist path resolution

Priority order (same pattern as `LreTaskRunner` and `LreWorkspaceSyncRunner`):

1. Explicit user-supplied path (Advanced → Node dist path).
2. `LreDownloadScriptsTask\index.js` **next to `PluginsUI.exe`** — installer / staged layout.
3. `<repoRoot>\angular\LreDownloadScriptsTask\index.js` — dev-repo layout.

---

## UI — Download Scripts tab (Tab index 2)

Controls defined in `MainWindow.xaml`:

| XAML name | Mapped to | Notes |
|-----------|-----------|-------|
| `DownloadWorkspaceDir` | `WorkspaceDir` | Browse button available |
| `DownloadParallelDownloads` | `ParallelDownloads` | Integer 1–20; validated on Run |
| `DownloadSuccessThreshold` | `SuccessThreshold` | 0–100; empty → default 50 % |
| `DownloadArtifactsDirectory` | `ArtifactsDirectory` | Browse button available |
| `DownloadNodeDistPath` | `NodeDistPath` | Browse + Detect buttons |
| `DownloadDescriptionText` | `Description` | Optional label |

### Tab-aware code in `MainWindow.xaml.cs`

The `IsDownloadTab` property (`SelectedIndex == 2`) gates all tab-specific logic:

- **Run_Click** — calls `_downloadRunner.RunAsync()` when `IsDownloadTab`.
- **Stop_Click** — calls `_downloadRunner.Stop()` alongside the other runners.
- **SaveConfig / LoadConfig** — serialises/deserialises `LreDownloadConfiguration`.
- **ValidateRequiredFields** — download tab requires only the shared connection fields
  (server, user, domain, project); the workspace dir is created automatically.
- **SetRunning** — status text reads "Downloading scripts…".
- **Window_Closing** — auto-saves download config to `last-session-download.json`.

### Auto-save path

```
%LOCALAPPDATA%\PluginsUI\last-session-download.json
```

Passwords are never persisted (same policy as CI and Sync configs).

---

## Building & testing the angular task locally

```powershell
cd angular
npm install
npm run build:download          # compile TypeScript → dist/
```

Then in PluginsUI, set the **Node dist path** to:
```
<repo>\angular\LreDownloadScriptsTask\index.js
```
Or click **Detect** — the runner will find it automatically from the dev-repo layout.

