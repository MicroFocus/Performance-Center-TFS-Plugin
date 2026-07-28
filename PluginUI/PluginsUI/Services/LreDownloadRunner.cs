/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 *
 * LreDownloadRunner.cs — runs the LreDownloadScriptsTask (node dist/index.js) as
 * a child process, wiring up all INPUT_* env vars the azure-pipelines-task-lib expects.
 */

using System.Diagnostics;
using System.IO;
using PluginsUI.Models;

namespace PluginsUI.Services;

/// <summary>
/// Runs the angular Enterprise Performance Engineering Download Scripts task
/// (<c>node dist/index.js</c>) as a child process, wiring up all
/// <c>INPUT_*</c> environment variables that <c>azure-pipelines-task-lib</c> expects.
/// Streams stdout/stderr back via <see cref="IProgress{T}"/>.
/// </summary>
public sealed class LreDownloadRunner : IDisposable
{
    private Process?      _process;
    private readonly object _lock = new();

    public bool IsRunning { get; private set; }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Starts <c>node &lt;distPath&gt;</c> with all download task inputs mapped to
    /// environment variables.  Returns the process exit code (0 = success).
    /// </summary>
    public async Task<int> RunAsync(
        LreDownloadConfiguration config,
        string                   password,
        string                   proxyPassword,
        IProgress<string>        progress,
        CancellationToken        ct)
    {
        // ── Resolve dist/index.js path ──────────────────────────
        var distPath = ResolveDistPath(config.NodeDistPath);
        if (distPath is null)
        {
            progress.Report("[ERROR] Cannot locate LreDownloadScriptsTask/index.js.");
            progress.Report("[ERROR] Set 'Node dist path' in the Advanced section,");
            progress.Report("[ERROR] or build the angular project first:");
            progress.Report("[ERROR]   cd angular && npm install && npm run build:download");
            return -1;
        }

        // ── Resolve download directory ──────────────────────────
        var workspaceDir = string.IsNullOrWhiteSpace(config.WorkspaceDir)
            ? Directory.GetCurrentDirectory()
            : config.WorkspaceDir;

        if (!Directory.Exists(workspaceDir))
        {
            // Create the target directory — it is the download destination, so it may not exist yet
            try { Directory.CreateDirectory(workspaceDir); }
            catch
            {
                progress.Report($"[ERROR] Download directory does not exist and could not be created: {workspaceDir}");
                return -1;
            }
        }

        // ── Resolve artifacts directory ─────────────────────────
        var artifactsDir = string.IsNullOrWhiteSpace(config.ArtifactsDirectory)
            ? Path.Combine(Path.GetTempPath(), "LreDownloadArtifacts",
                           DateTime.Now.ToString("yyyyMMdd_HHmmss"))
            : config.ArtifactsDirectory;
        Directory.CreateDirectory(artifactsDir);

        // ── Build ProcessStartInfo ──────────────────────────────
        var distDir  = Path.GetDirectoryName(distPath)!;
        var taskRoot = Path.GetDirectoryName(distDir) ?? distDir;

        var psi = new ProcessStartInfo("node", $"\"{distPath}\"")
        {
            UseShellExecute        = false,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            CreateNoWindow         = true,
            WorkingDirectory       = artifactsDir,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding  = System.Text.Encoding.UTF8
        };

        psi.Environment["NODE_PATH"] = Path.Combine(taskRoot, "node_modules");

        SetEnvironmentVariables(psi.Environment, config, password, proxyPassword,
                                workspaceDir, artifactsDir);

        progress.Report($"[INFO] ─── Enterprise Performance Engineering Download Scripts starting ─────────────");
        progress.Report($"[INFO] Node dist : {distPath}");
        progress.Report($"[INFO] Task root : {taskRoot}  (node_modules resolved here)");
        progress.Report($"[INFO] Work dir  : {artifactsDir}  (.taskkey written here)");
        progress.Report($"[INFO] Artifacts : {artifactsDir}");
        progress.Report($"[INFO] Server    : {config.ServerUrl}");
        progress.Report($"[INFO] Download to: {workspaceDir}");
        progress.Report($"[INFO] Parallel downloads: {config.ParallelDownloads}");
        progress.Report($"[INFO] Success threshold: {(string.IsNullOrWhiteSpace(config.SuccessThreshold) ? "default (50%)" : config.SuccessThreshold + "%")}");
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
                progress.Report("[INFO] Download stopped by user.");
                return -2;
            }

            progress.Report(string.Empty);
            progress.Report(exitCode == 0
                ? "[INFO] ─── Script download completed successfully ────────"
                : $"[WARN] ─── Script download exited with code {exitCode} ──────");
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
    /// Resolves the path to the LreDownloadScriptsTask bootstrap <c>index.js</c>.
    ///
    /// Priority order (stops at the first match):
    ///   1. Explicit path set by the user in the Advanced section.
    ///   2. <c>LreDownloadScriptsTask\index.js</c> next to <c>PluginsUI.exe</c>
    ///      (installer / staged build layout).
    ///   3. Dev-repo convention: <c>&lt;repoRoot&gt;\angular\LreDownloadScriptsTask\index.js</c>
    /// </summary>
    public static string? ResolveDistPath(string? configured)
    {
        // 1. Explicit user-supplied path
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured))
            return configured;

        // 2. LreDownloadScriptsTask\index.js next to the exe (installer / staged layout)
        var nextToExe = Path.Combine(AppContext.BaseDirectory, "LreDownloadScriptsTask", "index.js");
        if (File.Exists(nextToExe)) return nextToExe;

        // 3. Dev-repo layout: bin/Debug/net10.0-windows → ../../../../.. → repo root
        var repoRoot  = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var repoGuess = Path.Combine(repoRoot, "angular", "LreDownloadScriptsTask", "index.js");
        if (File.Exists(repoGuess)) return repoGuess;

        return null;
    }

    /// <summary>
    /// Maps all <see cref="LreDownloadConfiguration"/> fields + passwords to the
    /// <c>INPUT_*</c> / <c>SYSTEM_*</c> / <c>BUILD_*</c> environment variables
    /// that <c>azure-pipelines-task-lib</c> reads.
    /// Input names mirror task.json exactly (task-lib: upper-case, strip non-alnum).
    /// </summary>
    private static void SetEnvironmentVariables(
        IDictionary<string, string?> env,
        LreDownloadConfiguration     config,
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
        env["INPUT_VARPASSWORD"]                  = password;
        env["INPUT_VARDOMAIN"]                    = config.Domain;
        env["INPUT_VARPROJECT"]                   = config.Project;
        env["INPUT_VARWORKSPACEDIR"]              = workspaceDir;
        env["INPUT_VARPARALLELDOWNLOADS"]         = config.ParallelDownloads.ToString();
        env["INPUT_VARPROXYURL"]                  = config.ProxyUrl;
        env["INPUT_VARPROXYUSER"]                 = config.ProxyUserName;
        env["INPUT_VARPROXYPASSWORD"]             = proxyPassword;
        env["INPUT_VARSUCCESSTHRESHOLD"]          = config.SuccessThreshold;
        env["INPUT_VARARTIFACTSDIR"]              = artifactsDir;
    }
}

