# PluginsUI

A standalone **WPF / .NET 8** GUI that runs the
**OpenText Enterprise Performance Engineering (LRE)** performance test task locally —
with no dependency on the legacy `PC.Plugins.*` .NET assemblies.

---

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
| **Test Connection** | Authenticate against the LRE server (delegates to `test-connection.js`) |
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
    -PCServer  "https://lre.mycompany.com:444/?tenant=<guid>" `
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
