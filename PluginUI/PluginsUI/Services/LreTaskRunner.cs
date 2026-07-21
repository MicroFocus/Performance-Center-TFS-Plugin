/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
using System.Diagnostics;
using System.IO;
using PluginsUI.Models;

namespace PluginsUI.Services;

/// <summary>
/// Runs the angular Enterprise Performance Engineering test task (<c>node dist/index.js</c>) as a child process,
/// wiring up all <c>INPUT_*</c> environment variables that <c>azure-pipelines-task-lib</c> expects.
/// Streams stdout/stderr back via <see cref="IProgress{T}"/>.
/// No dependency on PC.Plugins.* assemblies.
/// </summary>
public sealed class LreTaskRunner : IDisposable
{
    private Process?      _process;
    private readonly object _lock = new();

    public bool IsRunning { get; private set; }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Starts <c>node &lt;distPath&gt;</c> with all task inputs mapped to environment variables.
    /// Returns the process exit code (0 = success).
    /// </summary>
    public async Task<int> RunAsync(
        LreConfiguration config,
        string           password,
        string           proxyPassword,
        IProgress<string> progress,
        CancellationToken ct)
    {
        // ── Resolve dist/index.js path ──────────────────────────
        var distPath = ResolveDistPath(config.NodeDistPath);
        if (distPath is null)
        {
            progress.Report("[ERROR] Cannot locate LreCiTask/index.js.");
            progress.Report("[ERROR] Set 'Node dist path' in the Advanced section,");
            progress.Report("[ERROR] or build the angular project first:");
            progress.Report("[ERROR]   cd angular && npm install && npm run build:ci");
            return -1;
        }
        var artifactsDir = string.IsNullOrWhiteSpace(config.ArtifactsDirectory)
            ? Path.Combine(Path.GetTempPath(), "LrePluginArtifacts",
                           DateTime.Now.ToString("yyyyMMdd_HHmmss"))
            : config.ArtifactsDirectory;
        Directory.CreateDirectory(artifactsDir);

        // ── Build ProcessStartInfo ──────────────────────────────
        // Node resolves require() relative to the *script file's* location, so
        // node_modules (one level above dist/) is found regardless of CWD.
        //
        // WorkingDirectory must NOT be Program Files or any read-only folder because
        // azure-pipelines-task-lib writes a .taskkey file to process.cwd() on startup.
        // Using the artifacts directory (always writable, already created) avoids the
        // EPERM error when running from a protected install location.
        // When running the bootstrap index.js (at <taskDir>/index.js):
        //   distPath  = <appDir>/LreCiTask/index.js
        //   distDir   = <appDir>/LreCiTask
        //   taskRoot  = <appDir>          ← parent of LreCiTask
        //   NODE_PATH = <appDir>/node_modules  ← shared node_modules (single copy)
        var distDir  = Path.GetDirectoryName(distPath)!;              // LreCiTask dir
        var taskRoot = Path.GetDirectoryName(distDir) ?? distDir;     // app root (contains node_modules)

        var psi = new ProcessStartInfo("node", $"\"{distPath}\"")
        {
            UseShellExecute        = false,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            CreateNoWindow         = true,
            // Use the artifacts dir as CWD — it is always writable.
            // azure-pipelines-task-lib writes .taskkey to process.cwd(); using a
            // read-only Program Files folder here causes an EPERM error.
            WorkingDirectory       = artifactsDir,
            // Node.js writes UTF-8; override the default system OEM codepage so
            // characters like em-dash (—) are not garbled to â€" in the output panel.
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding  = System.Text.Encoding.UTF8
        };

        // Ensure azure-pipelines-task-lib can find node_modules even though CWD
        // is now the artifacts dir and not the task root.  NODE_PATH adds an extra
        // directory to Node's module search path as a fallback.
        psi.Environment["NODE_PATH"] = Path.Combine(taskRoot, "node_modules");

        SetEnvironmentVariables(psi.Environment, config, password, proxyPassword, artifactsDir);

                progress.Report($"[INFO] ─── Enterprise Performance Engineering task starting ───────────────────────────");
        progress.Report($"[INFO] Node dist : {distPath}");
        progress.Report($"[INFO] Task root : {taskRoot}  (node_modules resolved here)");
        progress.Report($"[INFO] Work dir  : {artifactsDir}  (.taskkey written here)");
        progress.Report($"[INFO] Artifacts : {artifactsDir}");
        progress.Report($"[INFO] Server    : {config.ServerUrl}");
        progress.Report($"[INFO] Test ID   : {config.TestId}");
        progress.Report(string.Empty);

        // ── Start process ───────────────────────────────────────
        var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var tcs     = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);

        process.Exited             += (_, _) => tcs.TrySetResult(process.ExitCode);
        process.OutputDataReceived += (_, e)  => { if (e.Data is not null) progress.Report(e.Data); };
        process.ErrorDataReceived  += (_, e)  => { if (e.Data is not null) progress.Report("[ERR] " + e.Data); };

        lock (_lock) { _process = process; IsRunning = true; }

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            // Allow CancellationToken to kill the node process
            using var reg = ct.Register(() =>
            {
                try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
                catch { /* already gone */ }
                tcs.TrySetCanceled(ct);
            });

            int exitCode;
            try
            {
                exitCode = await tcs.Task.ConfigureAwait(false);
            }
            catch (TaskCanceledException)
            {
                progress.Report(string.Empty);
                progress.Report("[INFO] Task stopped by user.");
                return -2;
            }

            progress.Report(string.Empty);
            progress.Report(exitCode == 0
                ? "[INFO] ─── Task completed successfully ──────────────────"
                : $"[WARN] ─── Task exited with code {exitCode} ───────────────");
            progress.Report($"[INFO] Artifacts written to: {artifactsDir}");
            return exitCode;
        }
        finally
        {
            lock (_lock) { _process = null; IsRunning = false; }
            process.Dispose();
        }
    }

    /// <summary>Kills the running node process (if any).</summary>
    public void Stop()
    {
        lock (_lock)
        {
            try { _process?.Kill(entireProcessTree: true); }
            catch { /* ignore */ }
        }
    }

    public void Dispose() => Stop();

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Resolves the path to the LreCiTask bootstrap <c>index.js</c>.
    ///
    /// Priority order (stops at the first match):
    ///   1. Explicit path set by the user in the Advanced section.
    ///   2. <c>LreCiTask\index.js</c> in the same directory as <c>PluginsUI.exe</c>
    ///      — installer / staged build layout:
    ///      <code>
    ///        PluginsUI.exe
    ///        node_modules\…              ← shared production deps
    ///        LreCiTask\index.js          ← bootstrap (polyfills + loads dist)
    ///        LreCiTask\dist\…            ← compiled TypeScript
    ///        LreWorkspaceSyncTask\index.js
    ///        LreWorkspaceSyncTask\dist\…
    ///        Scripts\…
    ///        Assets\…
    ///      </code>
    ///   3. Dev-repo convention: <c>&lt;repoRoot&gt;\angular\LreCiTask\index.js</c>
    ///      (only reached when running directly from a build output folder).
    /// </summary>
    public static string? ResolveDistPath(string? configured)
    {
        // 1. Explicit user-supplied path
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured))
            return configured;

        // 2. LreCiTask\index.js next to the exe  ← installer / staged layout
        var nextToExe = Path.Combine(AppContext.BaseDirectory, "LreCiTask", "index.js");
        if (File.Exists(nextToExe)) return nextToExe;

        // 3. Dev-repo layout: bin/Debug/net10.0-windows → ../../../../.. → repo root
        var repoRoot  = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var repoGuess = Path.Combine(repoRoot, "angular", "LreCiTask", "index.js");
        if (File.Exists(repoGuess)) return repoGuess;

        return null;
    }

    /// <summary>
    /// Maps all <see cref="LreConfiguration"/> fields + passwords to the
    /// <c>INPUT_*</c> / <c>SYSTEM_*</c> / <c>BUILD_*</c> environment variables
    /// that <c>azure-pipelines-task-lib</c> reads.
    /// </summary>
    private static void SetEnvironmentVariables(
        IDictionary<string, string?> env,
        LreConfiguration config,
        string password,
        string proxyPassword,
        string artifactsDir)
    {
        // Azure DevOps agent context (minimal — enough for task-lib to initialise)
        env["SYSTEM_TASKINSTANCEID"]          = Guid.NewGuid().ToString();
        env["SYSTEM_JOBID"]                   = Guid.NewGuid().ToString();
        env["BUILD_BUILDID"]                  = "1";
        env["BUILD_ARTIFACTSTAGINGDIRECTORY"] = artifactsDir;

        // Task inputs — names mirror task.json exactly (task-lib uppercases + strips non-alnum)
        env["INPUT_DESCRIPTIONSTRING"]            = config.Description;
        env["INPUT_VARPCSERVER"]                  = config.ServerUrl;
        env["INPUT_VARUSETOKENFORAUTHENTICATION"] = config.UseTokenForAuthentication ? "true" : "false";
        env["INPUT_VARUSERNAME"]                  = config.UserName;
        env["INPUT_VARPASSWORD"]                  = password;           // varPassWord → INPUT_VARPASSWORD
        env["INPUT_VARDOMAIN"]                    = config.Domain;
        env["INPUT_VARPROJECT"]                   = config.Project;
        env["INPUT_VARTESTID"]                    = config.TestId;
        env["INPUT_VARAUTOTESTINSTANCE"]          = config.AutoTestInstance ? "true" : "false";
        env["INPUT_VARTESTINSTID"]                = config.TestInstanceId;
        env["INPUT_VARPROXYURL"]                  = config.ProxyUrl;
        env["INPUT_VARPROXYUSER"]                 = config.ProxyUserName;
        env["INPUT_VARPROXYPASSWORD"]             = proxyPassword;
        env["INPUT_VARPOSTRUNACTION"]             = config.PostRunAction;
        env["INPUT_VARTRENDING"]                  = config.Trending;
        env["INPUT_VARTRENDREPORTID"]             = config.TrendReportId;
        env["INPUT_VARTIMESLOTDURATION"]          = config.TimeslotDurationMinutes;
        env["INPUT_VARUSEVUDS"]                   = config.UseVUDs ? "true" : "false";
        env["INPUT_VARUSESLAINSTATUS"]            = config.UseSLAInStatus ? "true" : "false";
        env["INPUT_VARTIMESLOTREPEAT"]            = config.TimeslotRepeat;     // vartimeslotRepeat → INPUT_VARTIMESLOTREPEAT
        env["INPUT_VARTIMESLOTREPEATDELAY"]       = config.TimeslotRepeatDelay;
        env["INPUT_VARTIMESLOTREPEATATTEMPTS"]    = config.TimeslotRepeatAttempts;
        env["INPUT_VARARTIFACTSDIR"]              = artifactsDir;
    }
}

