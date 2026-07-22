/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 *
 * LreWorkspaceSyncRunner.cs — runs the LreWorkspaceSyncTask (node dist/index.js) as
 * a child process, wiring up all INPUT_* env vars the azure-pipelines-task-lib expects.
 */

using System.Diagnostics;
using System.IO;
using PluginsUI.Models;

namespace PluginsUI.Services;

/// <summary>
/// Runs the angular Enterprise Performance Engineering Workspace Sync task (<c>node dist/index.js</c>) as a child process,
/// wiring up all <c>INPUT_*</c> environment variables that <c>azure-pipelines-task-lib</c> expects.
/// Streams stdout/stderr back via <see cref="IProgress{T}"/>.
/// </summary>
public sealed class LreWorkspaceSyncRunner : IDisposable
{
    private Process?      _process;
    private readonly object _lock = new();

    public bool IsRunning { get; private set; }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Starts <c>node &lt;distPath&gt;</c> with all workspace-sync task inputs mapped to
    /// environment variables.  Returns the process exit code (0 = success).
    /// </summary>
    public async Task<int> RunAsync(
        LreSyncConfiguration config,
        string                password,
        string                proxyPassword,
        IProgress<string>     progress,
        CancellationToken     ct)
    {
        // ── Resolve dist/index.js path ──────────────────────────
        var distPath = ResolveDistPath(config.NodeDistPath);
        if (distPath is null)
        {
            progress.Report("[ERROR] Cannot locate LreWorkspaceSyncTask/index.js.");
            progress.Report("[ERROR] Set 'Node dist path' in the Advanced section,");
            progress.Report("[ERROR] or build the angular project first:");
            progress.Report("[ERROR]   cd angular && npm install && npm run build:sync");
            return -1;
        }

        // ── Resolve workspace directory ─────────────────────────
        var workspaceDir = string.IsNullOrWhiteSpace(config.WorkspaceDir)
            ? Directory.GetCurrentDirectory()
            : config.WorkspaceDir;

        if (!Directory.Exists(workspaceDir))
        {
            progress.Report($"[ERROR] Workspace directory does not exist: {workspaceDir}");
            return -1;
        }

        // ── Resolve artifacts directory ─────────────────────────
        var artifactsDir = string.IsNullOrWhiteSpace(config.ArtifactsDirectory)
            ? Path.Combine(Path.GetTempPath(), "LreWorkspaceSyncArtifacts",
                           DateTime.Now.ToString("yyyyMMdd_HHmmss"))
            : config.ArtifactsDirectory;
        Directory.CreateDirectory(artifactsDir);

        // ── Build ProcessStartInfo ──────────────────────────────
        // When running the bootstrap index.js (at <taskDir>/index.js):
        //   distPath  = <appDir>/LreWorkspaceSyncTask/index.js
        //   distDir   = <appDir>/LreWorkspaceSyncTask
        //   taskRoot  = <appDir>          ← parent of LreWorkspaceSyncTask
        //   NODE_PATH = <appDir>/node_modules  ← shared node_modules (single copy)
        var distDir  = Path.GetDirectoryName(distPath)!;          // LreWorkspaceSyncTask dir
        var taskRoot = Path.GetDirectoryName(distDir) ?? distDir; // app root (contains node_modules)

        var psi = new ProcessStartInfo("node", $"\"{distPath}\"")
        {
            UseShellExecute        = false,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            CreateNoWindow         = true,
            // Use artifacts dir as CWD — always writable; azure-pipelines-task-lib
            // writes .taskkey to process.cwd() which fails in read-only folders.
            WorkingDirectory       = artifactsDir,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding  = System.Text.Encoding.UTF8
        };

        psi.Environment["NODE_PATH"] = Path.Combine(taskRoot, "node_modules");

        SetEnvironmentVariables(psi.Environment, config, password, proxyPassword,
                                workspaceDir, artifactsDir);

                progress.Report($"[INFO] ─── Enterprise Performance Engineering Workspace Sync starting ──────────────────");
        progress.Report($"[INFO] Node dist : {distPath}");
        progress.Report($"[INFO] Task root : {taskRoot}  (node_modules resolved here)");
        progress.Report($"[INFO] Work dir  : {artifactsDir}  (.taskkey written here)");
        progress.Report($"[INFO] Artifacts : {artifactsDir}");
        progress.Report($"[INFO] Server    : {config.ServerUrl}");
        progress.Report($"[INFO] Workspace : {workspaceDir}");
        progress.Report($"[INFO] Runtime only: {config.RuntimeOnly}");
        progress.Report($"[INFO] Parallel uploads: {config.ParallelUploads}");
        progress.Report($"[INFO] Success threshold: {(string.IsNullOrWhiteSpace(config.SuccessThreshold) ? "default (50%)" : config.SuccessThreshold + "%")}");
        progress.Report($"[INFO] Differential sync SHA: {(string.IsNullOrWhiteSpace(config.BaseCommitSha) ? "(none — full sync)" : config.BaseCommitSha)}");
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
                progress.Report("[INFO] Sync stopped by user.");
                return -2;
            }

            progress.Report(string.Empty);
            progress.Report(exitCode == 0
                ? "[INFO] ─── Workspace Sync completed successfully ─────────"
                : $"[WARN] ─── Workspace Sync exited with code {exitCode} ─────");
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
    /// Resolves the path to the LreWorkspaceSyncTask bootstrap <c>index.js</c>.
    ///
    /// Priority order (stops at the first match):
    ///   1. Explicit path set by the user in the Advanced section.
    ///   2. <c>LreWorkspaceSyncTask\index.js</c> in the same directory as <c>PluginsUI.exe</c>
    ///      — installer / staged build layout:
    ///      <code>
    ///        PluginsUI.exe
    ///        node_modules\…              ← shared production deps
    ///        LreCiTask\index.js
    ///        LreCiTask\dist\…
    ///        LreWorkspaceSyncTask\index.js  ← bootstrap (polyfills + loads dist)
    ///        LreWorkspaceSyncTask\dist\…    ← compiled TypeScript
    ///        Scripts\…
    ///        Assets\…
    ///      </code>
    ///   3. Dev-repo convention: <c>&lt;repoRoot&gt;\angular\LreWorkspaceSyncTask\index.js</c>
    /// </summary>
    public static string? ResolveDistPath(string? configured)
    {
        // 1. Explicit user-supplied path
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured))
            return configured;

        // 2. LreWorkspaceSyncTask\index.js next to the exe  ← installer / staged layout
        var nextToExe = Path.Combine(AppContext.BaseDirectory, "LreWorkspaceSyncTask", "index.js");
        if (File.Exists(nextToExe)) return nextToExe;

        // 3. Dev-repo layout: bin/Debug/net10.0-windows → ../../../../.. → repo root
        var repoRoot  = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var repoGuess = Path.Combine(repoRoot, "angular", "LreWorkspaceSyncTask", "index.js");
        if (File.Exists(repoGuess)) return repoGuess;

        return null;
    }

    /// <summary>
    /// Maps all <see cref="LreSyncConfiguration"/> fields + passwords to the
    /// <c>INPUT_*</c> / <c>SYSTEM_*</c> / <c>BUILD_*</c> environment variables
    /// that <c>azure-pipelines-task-lib</c> reads.
    /// Input names mirror task.json exactly (task-lib: upper-case, strip non-alnum).
    /// </summary>
    private static void SetEnvironmentVariables(
        IDictionary<string, string?> env,
        LreSyncConfiguration         config,
        string                       password,
        string                       proxyPassword,
        string                       workspaceDir,
        string                       artifactsDir)
    {
        // Azure DevOps agent context (minimal — enough for task-lib to initialise)
        env["SYSTEM_TASKINSTANCEID"]          = Guid.NewGuid().ToString();
        env["SYSTEM_JOBID"]                   = Guid.NewGuid().ToString();
        env["BUILD_BUILDID"]                  = "1";
        env["BUILD_ARTIFACTSTAGINGDIRECTORY"] = artifactsDir;
        env["BUILD_SOURCESDIRECTORY"]         = workspaceDir;

        // Task inputs
        env["INPUT_DESCRIPTIONSTRING"]            = config.Description;
        env["INPUT_VARPCSERVER"]                  = config.ServerUrl;
        env["INPUT_VARUSETOKENFORAUTHENTICATION"] = config.UseTokenForAuthentication ? "true" : "false";
        env["INPUT_VARUSERNAME"]                  = config.UserName;
        env["INPUT_VARPASSWORD"]                  = password;           // varPassWord → INPUT_VARPASSWORD
        env["INPUT_VARDOMAIN"]                    = config.Domain;
        env["INPUT_VARPROJECT"]                   = config.Project;
        env["INPUT_VARWORKSPACEDIR"]              = workspaceDir;
        env["INPUT_VARRUNTIMEONLY"]               = config.RuntimeOnly ? "true" : "false";
        env["INPUT_VARPARALLELUPLOADS"]           = config.ParallelUploads.ToString();
        env["INPUT_VARPROXYURL"]                  = config.ProxyUrl;
        env["INPUT_VARPROXYUSER"]                 = config.ProxyUserName;
        env["INPUT_VARPROXYPASSWORD"]             = proxyPassword;
        env["INPUT_VARSUCCESSTHRESHOLD"]          = config.SuccessThreshold;
        env["INPUT_VARBASECOMMITSHA"]             = config.BaseCommitSha;
        env["INPUT_VARARTIFACTSDIR"]              = artifactsDir;
    }
}

