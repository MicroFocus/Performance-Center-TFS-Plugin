/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
using System.Diagnostics;
using System.IO;

namespace PluginsUI.Services;

/// <summary>
/// Tests connectivity and authentication against an LRE server by delegating
/// entirely to <c>Scripts/test-connection.js</c> — the same Node.js runtime and
/// HTTP stack used by the main task, so the request is byte-for-byte identical.
///
/// No C# HttpClient: avoids Content-Type charset, wrong XML element names, or
/// missing XML namespace mismatches that cause LRE error 1101.
/// </summary>
public static class LreConnectionTester
{
    /// <summary>
    /// Runs <c>node test-connection.js</c> with the relevant INPUT_* env vars
    /// and returns (success, captured output) based on the node exit code.
    /// </summary>
    public static async Task<(bool Success, string Message)> TestAsync(
        string  serverUrl,
        string  userName,
        string  password,
        bool    useToken,
        string  proxyUrl      = "",
        string  proxyUser     = "",
        string  proxyPassword = "",
        string? nodeDistPath  = null,
        CancellationToken ct  = default)
    {
        // ── Locate Scripts/test-connection.js ─────────────────────────────
        var scriptPath = ResolveScriptPath(nodeDistPath);
        if (scriptPath is null)
            return (false,
                "Cannot locate Scripts/test-connection.js.\n" +
                "Ensure the application was built correctly or set the Node dist path " +
                "in the Advanced section.");

        // ── Build ProcessStartInfo ────────────────────────────────────────
        var psi = new ProcessStartInfo("node")
        {
            UseShellExecute        = false,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            CreateNoWindow         = true,
            // Node.js writes UTF-8; override the default system OEM codepage.
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            StandardErrorEncoding  = System.Text.Encoding.UTF8
        };
        // Pass the script path as a separate argument to avoid any shell interpretation.
        psi.ArgumentList.Add(scriptPath);

        psi.Environment["INPUT_VARPCSERVER"]                  = serverUrl;
        psi.Environment["INPUT_VARUSETOKENFORAUTHENTICATION"] = useToken ? "true" : "false";
        psi.Environment["INPUT_VARUSERNAME"]                  = userName;
        psi.Environment["INPUT_VARPASSWORD"]                  = password;
        psi.Environment["INPUT_VARPROXYURL"]                  = proxyUrl;
        psi.Environment["INPUT_VARPROXYUSER"]                 = proxyUser;
        psi.Environment["INPUT_VARPROXYPASSWORD"]             = proxyPassword;

        // ── Execute ───────────────────────────────────────────────────────
        try
        {
            using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };

            var lines = new System.Collections.Generic.List<string>();
            process.OutputDataReceived += (_, e) => { if (e.Data is not null) lines.Add(e.Data); };
            process.ErrorDataReceived  += (_, e) => { if (e.Data is not null) lines.Add(e.Data); };

            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            // Enforce 30-second timeout independent of the caller's CancellationToken
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(TimeSpan.FromSeconds(30));

            try
            {
                await process.WaitForExitAsync(linked.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                try { process.Kill(entireProcessTree: true); } catch { /* already exited */ }
                return (false, "Connection test timed out (30 s).");
            }

            var message = string.Join(Environment.NewLine, lines);
            return (process.ExitCode == 0, message);
        }
        catch (Exception ex)
        {
            return (false,
                $"Failed to launch node.exe: {ex.Message}\n" +
                "Ensure Node.js (v20+) is installed and available in PATH.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Script path resolution — mirrors LreTaskRunner.ResolveDistPath priority
    // ─────────────────────────────────────────────────────────────────────────
    private static string? ResolveScriptPath(string? configuredDistPath)
    {
        // 1. Scripts/ next to the exe  ← standard installer layout
        var nextToExe = Path.Combine(AppContext.BaseDirectory, "Scripts", "test-connection.js");
        if (File.Exists(nextToExe)) return nextToExe;

        // 2. Alongside the configured dist/index.js
        if (!string.IsNullOrWhiteSpace(configuredDistPath))
        {
            var distDir = Path.GetDirectoryName(configuredDistPath);
            if (distDir is not null)
            {
                var sibling = Path.GetFullPath(
                    Path.Combine(distDir, "..", "Scripts", "test-connection.js"));
                if (File.Exists(sibling)) return sibling;
            }
        }

        // 3. Dev-repo layout
        var repoRoot  = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        var repoGuess = Path.Combine(
            repoRoot, "PluginUI", "PluginsUI", "Scripts", "test-connection.js");
        if (File.Exists(repoGuess)) return repoGuess;

        return null;
    }
}
