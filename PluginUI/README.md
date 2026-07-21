# PluginsUI

A standalone **WPF / .NET 10** GUI that runs both
**OpenText Enterprise Performance Engineering** tasks locally —
with no dependency on the legacy `PC.Plugins.*` .NET assemblies.

Two tasks are supported:

| Task | Purpose |
|---|---|
| **Enterprise Performance Engineering Test** | Authenticate, create/reserve a timeslot, monitor a run, download artifacts |
| **Enterprise Performance Engineering Workspace Sync** | Scan a repository, compress script folders, upload to a project's test plan |

---

## Architecture

```
PluginUI/
  PluginsUI.sln
  prepare-release.ps1      — staging script used by the installer
  PluginsUI/               — WPF application project (.NET 10)
    App.xaml / App.xaml.cs          — application entry, global WPF styles
    MainWindow.xaml / .xaml.cs      — tabbed UI (CI Test · Workspace Sync)
    Models/
      LreConfiguration.cs       — CI task form values (JSON-serialisable, no passwords)
      LreSyncConfiguration.cs   — Workspace Sync form values
    Services/
      LreTaskRunner.cs          — spawns "node LreCiTask/index.js" with INPUT_* env vars
      LreWorkspaceSyncRunner.cs — spawns "node LreWorkspaceSyncTask/index.js" with INPUT_* env vars
      LreConnectionTester.cs    — runs "node Scripts/test-connection.js" (auth check)
      ConfigurationService.cs   — JSON save / load (passwords excluded)
    Scripts/
      test-connection.js        — Node.js auth tester (built-in http/https only, no npm)
      run-lre-task.ps1          — companion CLI script for the CI task
      run-workspace-sync.ps1    — companion CLI script for the Workspace Sync task
    Assets/
      pc-logo.png, qicon.png, PC.ico, MicroFocusIcon.ico
  PluginsInstaller/        — WiX v4 MSI installer project
    PluginsInstaller.wixproj
    PreBuild.ps1           — called by WiX before compile; invokes prepare-release.ps1
    Product.wxs / Files.wxs / Registry.wxs / Shortcuts.wxs / Variables.wxi
```

### Staging layout (used by the installer and the dev output)

```
<staging or bin/>/
  PluginsUI.exe
  node_modules/            ← shared production deps (single copy)
  LreCiTask/
    index.js               ← bootstrap (polyfills + loads dist)
    dist/
      LreCiTask/index.js   ← compiled TypeScript entry
      src/ci/...
      src/shared/...
  LreWorkspaceSyncTask/
    index.js               ← bootstrap
    dist/
      LreWorkspaceSyncTask/index.js
      src/sync/...
      src/shared/...
  Scripts/
  Assets/
```

Node.js resolves `require('azure-pipelines-task-lib')` etc. by walking up from
`LreCiTask/dist/LreCiTask/` through `LreCiTask/` to the root, where the shared
`node_modules/` lives.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **.NET 10 SDK** | `dotnet --version` ≥ 10.0 |
| **Node.js ≥ 20** | Used to execute the task bootstrap and `test-connection.js` |
| **Built angular tasks** | Run `npm install && npm run build` in `angular/` (single project root) |

---

## Getting Started

### 1 — Build the angular tasks (one-time, single project root)

```powershell
cd angular
npm install        # installs deps for both tasks
npm run build      # compiles both tasks to dist/
```

### 2 — Build PluginsUI

```powershell
cd PluginUI
dotnet build       # or open PluginsUI.sln in Visual Studio 2022+
```

The MSBuild `CopyAngularTasks` target automatically copies Angular artifacts
(`index.js`, `dist/`, `node_modules/`) into the output directory. No manual
copy step is needed.

### 3 — Run

```powershell
.\PluginsUI\bin\Debug\net10.0-windows\PluginsUI.exe
```

Or press **F5** in Visual Studio / Rider.

---

## UI Overview

The window has two tabs — **CI Test** and **Workspace Sync** — each with its
own form. Both share the same connection section and button bar.

### CI Test tab

| Section | Fields |
|---|---|
| **Connection** | Server URL (tenant support), auth-token toggle, username, password (show/hide), domain, project |
| **Test** | Test ID, test instance (auto / manual) |
| **Proxy** | Proxy URL, user, password |
| **Run Options** | Post-run action, trending, timeslot duration, VUDs, SLA status, repeat-on-failure |
| **Advanced** | Artifacts directory (Browse), Node dist path (Browse), description |

### Workspace Sync tab

| Section | Fields |
|---|---|
| **Connection** | Same server/auth/domain/project as CI Test |
| **Sync** | Workspace directory (Browse), runtime-only toggle, parallel uploads, success threshold |
| **Proxy** | Proxy URL, user, password |
| **Advanced** | Artifacts directory (Browse), Node dist path (Browse), description |

### Output panel

Real-time streaming output from the node process is displayed in a dark
terminal-style **RichTextBox**, with colour-coded lines:

| Colour | Meaning |
|---|---|
| Light grey | Normal INFO output |
| **Red** | `[ERR]` lines |
| **Gold** | `[WARN]` / `##[warning]` lines |
| **Green** | Success / completed lines |
| **Light blue** | Path / metadata lines |

---

## Button bar

| Button | Action |
|---|---|
| **Load Config** | Load a previously saved JSON configuration (passwords are not stored) |
| **Save Config** | Save current form values to a JSON file |
| **Test Connection** | Authenticate against the server (delegates to `test-connection.js`) |
| **▶ Run** | Launch the active task with all form values as `INPUT_*` env vars |
| **■ Stop** | Kill the running node process (entire process tree) |
| **Close** | Close window — prompts if a task is running |

---

## Auto session save / restore

On close the application automatically saves all form values (excluding passwords) to:

```
%LOCALAPPDATA%\PluginsUI\last-session.json
```

On next launch the last session is restored automatically. You only need to
re-enter passwords.

---

## Saving & Loading Configuration

- **Save Config** → choose any `.json` file location.
- **Passwords are intentionally excluded** (security — never written to disk).
- **Load Config** → restores all non-password fields. Re-enter passwords after loading.

---

## Test Connection

The **Test Connection** button runs `Scripts/test-connection.js` via `node` —
the same Node.js / HTTP stack used by the main tasks. This guarantees the
authentication request is byte-for-byte identical to the one sent during a real
run (correct `Content-Type: application/xml`, correct XML element names).

Password-auth: `GET /authentication-point/authenticate` with `Authorization: Basic …`

Token-auth: `POST /authentication-point/authenticateclient` with XML body:
```xml
<AuthenticationClient>
    <ClientIdKey>I_KEY_…</ClientIdKey>
    <ClientSecretKey>S_KEY_…</ClientSecretKey>
</AuthenticationClient>
```

---

## Node bootstrap auto-detection

If the **Node dist path** field is blank, the runners search in this order:

1. `LreCiTask\index.js` (or `LreWorkspaceSyncTask\index.js`) **next to `PluginsUI.exe`** — installer / staged build layout
2. `<repo-root>\angular\LreCiTask\index.js` — dev-repo layout (navigates up 5 levels from the exe)

Set the path explicitly via the **Browse…** button if you keep the files elsewhere.

`LreConnectionTester` follows the same fallback for `Scripts/test-connection.js`.

---

## Artifacts directory

If blank, a timestamped sub-folder inside `%TEMP%\LrePluginArtifacts\` is created
automatically. The resolved path is printed in the output panel at task start.

---

## Command-line (no GUI)

Use the companion scripts for CI / scripted usage:

```powershell
# CI test run
.\PluginsUI\Scripts\run-lre-task.ps1 `
    -PCServer  "https://epe.mycompany.com:444/?tenant=<guid>" `
    -Domain    "DEFAULT" `
    -Project   "MyProject" `
    -TestID    "42" `
    -UserName  "admin" `
    -Password  "s3cr3t"

# Workspace sync
.\PluginsUI\Scripts\run-workspace-sync.ps1 `
    -PCServer      "https://epe.mycompany.com:444" `
    -Domain        "DEFAULT" `
    -Project       "MyProject" `
    -WorkspaceDir  "C:\repos\myproject" `
    -UserName      "admin" `
    -Password      "s3cr3t"
```

Run `Get-Help .\Scripts\run-lre-task.ps1 -Full` for all parameters.

---

## Building the MSI installer

The WiX installer project (`PluginsInstaller`) builds an MSI that includes
PluginsUI.exe and all Angular task artifacts.

### Quick build (recommended)

```powershell
# 1. Build the VSIX first (from the repo angular/ root)
cd angular
npm install && npm run build && npm run package:vsix   # produces Extension/*.vsix

# 2. Build the MSI (Release config)
cd PluginUI
dotnet build PluginsInstaller\PluginsInstaller.wixproj -c Release
```

The `PreBuild.ps1` script is called automatically before WiX compiles. It:
1. Detects the latest `.vsix` in `Extension\` and calls `prepare-release.ps1 -FromVsix`
2. Falls back to `-SkipAngularBuild` (uses existing `dist\` in source tree) if no VSIX found
3. Falls back to a full source build if `PLUGINSUI_FULL_BUILD=1` is set

The MSI is written to `PluginUI\out\Release\PluginsUI-Setup.msi`.

### Manual staging

```powershell
cd PluginUI

# Option A: build everything from source
.\prepare-release.ps1

# Option B: reuse already-built dist\ in source tree
.\prepare-release.ps1 -SkipAngularBuild

# Option C: extract dist\ from a published .vsix (fastest)
.\prepare-release.ps1 -FromVsix
.\prepare-release.ps1 -FromVsix -VsixPath "C:\builds\Micro-Focus.PCIntegration-3.1.0.vsix"
```

After staging, build the MSI manually:
```powershell
dotnet build PluginsInstaller\PluginsInstaller.wixproj -c Release
```

### Forcing a staging rebuild

By default `PreBuild.ps1` skips staging if `staging\PluginsUI.exe` already exists.
Set `PLUGINSUI_REBUILD_STAGING=1` to force a rebuild:

```powershell
$env:PLUGINSUI_REBUILD_STAGING = "1"
dotnet build PluginsInstaller\PluginsInstaller.wixproj -c Release
```

---

## Improvements over PC.Plugins.ConfiguratorUI

| Feature | Old (PC.Plugins.ConfiguratorUI) | New (PluginsUI) |
|---|---|---|
| Framework | .NET Framework 4.8 (legacy XML csproj) | .NET 10 SDK-style project |
| Dependencies | PC.Plugins.Common, Automation, Configurator | **None** — fully standalone |
| Tasks supported | CI test only | CI test **+** Workspace Sync |
| Run engine | C# `PCBuilder` via legacy DLLs | `node LreCiTask/index.js` with `INPUT_*` env vars |
| Test Connection | `PCRestProxy` DLL (C#) — wrong XML format for token | `node test-connection.js` — identical HTTP call |
| Output | Separate PS window tailing a log file | Embedded colour-coded RichTextBox (real-time) |
| Stop button | ❌ | ✅ Kills node + entire process tree |
| Save / Load config | ❌ | ✅ JSON (passwords excluded) |
| Auto session restore | ❌ | ✅ Saves on close, restores on open |
| Artifacts directory | ❌ (not exposed) | ✅ With Browse button |
| Node dist path | ❌ N/A | ✅ Auto-detected or manually set |
| Async UI | ❌ Raw threads, UI can freeze | ✅ `async`/`await` throughout |
| UI layout | Flat label / input list | Grouped sections (Connection · Test · Proxy · …) |
| Validation | None | Required-field check before Run |
| Password show/hide | ❌ | ✅ Show / Hide toggle |
| DPI awareness | Default | ✅ `PerMonitorV2` via `app.manifest` |

---

## Further improvement suggestions

| # | Suggestion | Effort |
|---|---|---|
| 1 | **Resizable output panel** — `GridSplitter` between the form and output sections | Low |
| 2 | **Single-instance mutex** — prevent two copies running simultaneously | Low |
| 3 | **Open Artifacts shortcut** — button/link to open the artifacts folder in Explorer after a run | Low |
| 4 | **Max output lines** — ring-buffer the RichTextBox to avoid memory growth on very long runs | Medium |
| 5 | **Token-auth label swap** — change "User name" / "Password" labels to "Client Id" / "Client Secret" when token mode is active | Low |

---

## License

Apache License 2.0 — see `../../LICENSE`.


## Architecture

```
PluginUI/
  PluginsUI.sln
  PluginsUI/
    App.xaml / App.xaml.cs          — application entry, global WPF styles
    MainWindow.xaml / .xaml.cs      — form UI + async code-behind
    Models/
      LreConfiguration.cs           — all form-field values (JSON-serialisable, no passwords)
    Services/
      LreTaskRunner.cs              — spawns "node dist/index.js" with INPUT_* env vars
      LreConnectionTester.cs        — runs "node Scripts/test-connection.js" (identical HTTP call)
      ConfigurationService.cs       — JSON save / load (passwords excluded)
    Scripts/
      test-connection.js            — Node.js auth tester (built-in http/https only, no npm)
      run-lre-task.ps1              — companion CLI script (same logic as the GUI, no GUI needed)
    Assets/
      pc-logo.png, qicon.png, PC.ico, MicroFocusIcon.ico
```

---

## Why a separate project?

`PC.Plugins.ConfiguratorUI` depends on three legacy C# DLLs
(`PC.Plugins.Common`, `PC.Plugins.Automation`, `PC.Plugins.Configurator`) that must
stay in sync with an old .NET Framework 4.8 codebase.

`PluginsUI` is completely self-contained:
- No DLL references to legacy code
- Runs the actively-maintained TypeScript task (`angular/LreCiTask`) as its engine
- Can be distributed as a single `.exe` next to the built `dist/` output

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **.NET 8 SDK** | `dotnet --version` ≥ 8.0 |
| **Node.js ≥ 20** | Used to execute `dist/index.js` and `test-connection.js` |
| **Built angular task** | Run `npm install && npm run build` in `angular/LreCiTask/` |

---

## Getting Started

### 1 — Build the angular task (one-time)

```powershell
cd angular\LreCiTask
npm install
npm run build       # produces angular/LreCiTask/dist/index.js
```

### 2 — Build PluginsUI

```powershell
cd PluginUI
dotnet build        # or open PluginsUI.sln in Visual Studio 2022+
```

### 3 — Run

```powershell
.\PluginsUI\bin\Debug\net8.0-windows\PluginsUI.exe
```

Or press **F5** in Visual Studio / Rider.

---

## UI Overview

The form is split into five sections:

| Section | Fields |
|---|---|
| **Connection** | Server URL (with tenant support), auth-token toggle, username, password (show/hide), domain, project |
| **Test** | Test ID, test instance (auto / manual) |
| **Proxy** | Proxy URL, user, password |
| **Run Options** | Post-run action, trending, timeslot duration, VUDs, SLA status, repeat-on-failure |
| **Advanced** | Artifacts directory (Browse), Node dist path (Browse), description |

### Output panel

Real-time streaming output from `node dist/index.js` is displayed in a dark terminal-style
**RichTextBox** at the bottom of the window, with colour-coded lines:

| Colour | Meaning |
|---|---|
| Light grey | Normal INFO output |
| **Red** | `[ERR]` lines |
| **Gold** | `[WARN]` lines |
| **Green** | Success / completed lines |
| **Light blue** | Path / metadata lines |

---

## Button bar

| Button | Action |
|---|---|
| **Load Config** | Load a previously saved JSON configuration (passwords are not stored) |
| **Save Config** | Save current form values to a JSON file |
| **Test Connection** | Authenticate against the Enterprise Performance Engineering server (delegates to `test-connection.js`) |
| **▶ Run** | Launch `node dist/index.js` with all form values set as `INPUT_*` env vars |
| **■ Stop** | Kill the running node process (entire process tree) |
| **Close** | Close window — prompts if a test is running |

---

## Auto session save / restore

On close the application automatically saves all form values (excluding passwords) to:

```
%LOCALAPPDATA%\PluginsUI\last-session.json
```

On next launch the last session is restored automatically. You only need to re-enter
passwords.

---

## Saving & Loading Configuration

- **Save Config** → choose any `.json` file location.
- **Passwords are intentionally excluded** (security — never written to disk).
- **Load Config** → restores all non-password fields. Re-enter passwords after loading.

---

## Test Connection

The **Test Connection** button runs `Scripts/test-connection.js` via `node` —
the same Node.js / HTTP stack used by the main task.
This guarantees the authentication request is byte-for-byte identical to the one
sent during a real run (correct `Content-Type: application/xml`, correct XML element
names).

Password-auth: `GET /authentication-point/authenticate` with `Authorization: Basic …`

Token-auth: `POST /authentication-point/authenticateclient` with XML body:
```xml
<AuthenticationClient>
    <ClientIdKey>I_KEY_…</ClientIdKey>
    <ClientSecretKey>S_KEY_…</ClientSecretKey>
</AuthenticationClient>
```

---

## Node dist path auto-detection

If the **Node dist path** field is blank, `LreTaskRunner` searches in this order:

1. `dist\index.js` next to `PluginsUI.exe`
2. `<repo-root>\angular\LreCiTask\dist\index.js` (typical dev-repo layout)

Set the path explicitly via the **Browse…** button if you keep the dist elsewhere.

`LreConnectionTester` follows the same fallback for `Scripts/test-connection.js`.

---

## Artifacts directory

If blank, a timestamped sub-folder inside `%TEMP%\LrePluginArtifacts\` is created
automatically. The resolved path is printed in the output panel at task start.

---

## Command-line (no GUI)

Use the companion script for CI / scripted usage:

```powershell
.\PluginsUI\Scripts\run-lre-task.ps1 `
    -PCServer  "https://epe.mycompany.com:444/?tenant=<guid>" `
    -Domain    "DEFAULT" `
    -Project   "MyProject" `
    -TestID    "42" `
    -UserName  "admin" `
    -Password  "s3cr3t"
```

Run `Get-Help .\Scripts\run-lre-task.ps1 -Full` for all parameters.

---

## Improvements over PC.Plugins.ConfiguratorUI

| Feature | Old (PC.Plugins.ConfiguratorUI) | New (PluginsUI) |
|---|---|---|
| Framework | .NET Framework 4.8 (legacy XML csproj) | .NET 8 SDK-style project |
| Dependencies | PC.Plugins.Common, Automation, Configurator | **None** — fully standalone |
| Run engine | C# `PCBuilder` via legacy DLLs | `node dist/index.js` with `INPUT_*` env vars |
| Test Connection | `PCRestProxy` DLL (C#) — wrong XML format for token | `node test-connection.js` — identical HTTP call |
| Output | Separate PS window tailing a log file | Embedded colour-coded RichTextBox (real-time) |
| Stop button | ❌ | ✅ Kills node + entire process tree |
| Save / Load config | ❌ | ✅ JSON (passwords excluded) |
| Auto session restore | ❌ | ✅ Saves on close, restores on open |
| Artifacts directory | ❌ (not exposed) | ✅ With Browse button |
| Node dist path | ❌ N/A | ✅ Auto-detected or manually set |
| Async UI | ❌ Raw threads, UI can freeze | ✅ `async`/`await` throughout |
| UI layout | Flat label / input list | Grouped sections (Connection · Test · Proxy · …) |
| Validation | None | Required-field check before Run |
| Password show/hide | ❌ | ✅ Show / Hide toggle |
| DPI awareness | Default | ✅ `PerMonitorV2` via `app.manifest` |

---

## Further improvement suggestions

The following have been identified but not yet implemented — pick them up when needed:

| # | Suggestion | Effort |
|---|---|---|
| 1 | **Resizable output panel** — `GridSplitter` between the form and output sections | Low |
| 2 | **Single-instance mutex** — prevent two copies running simultaneously | Low |
| 3 | **Open Artifacts shortcut** — button/link to open the artifacts folder in Explorer after a run | Low |
| 4 | **Max output lines** — ring-buffer the RichTextBox to avoid memory growth on very long runs | Medium |
| 5 | **Token-auth label swap** — change "User name" / "Password" labels to "Client Id" / "Client Secret" when token mode is active | Low |

---

## License

Apache License 2.0 — see `../../LICENSE`.
