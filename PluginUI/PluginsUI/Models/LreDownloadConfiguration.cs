/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
namespace PluginsUI.Models;

/// <summary>
/// Configuration fields for the Enterprise Performance Engineering Download Scripts task (LreDownloadScriptsTask).
/// Mirrors the task.json inputs exactly.
/// Passwords are intentionally excluded from serialisation (see ConfigurationService).
/// </summary>
public class LreDownloadConfiguration
{
    // ── Connection ────────────────────────────────────────────────
    public string ServerUrl                { get; set; } = "https://MyServer:443";
    public bool   UseTokenForAuthentication { get; set; } = false;
    public string UserName                 { get; set; } = "";
    public string Domain                   { get; set; } = "DEFAULT";
    public string Project                  { get; set; } = "";

    // ── Proxy ─────────────────────────────────────────────────────
    public string ProxyUrl                 { get; set; } = "";
    public string ProxyUserName            { get; set; } = "";
    // ProxyPassword is NOT persisted

    // ── Download ──────────────────────────────────────────────────
    /// <summary>
    /// Local directory where downloaded scripts (.usz files) are written.
    /// The sub-folder hierarchy mirrors the server-side test-plan path, minus
    /// the root "Subject" segment.  Defaults to current working directory when empty.
    /// </summary>
    public string WorkspaceDir             { get; set; } = "";

    /// <summary>Number of concurrent script downloads. Clamped 1–20 by the task. Default 1 (sequential).</summary>
    public int    ParallelDownloads        { get; set; } = 1;

    /// <summary>
    /// Minimum percentage of scripts that must download successfully for the task to pass (0–100).
    /// Empty string means "not set" → the task defaults to 50%.
    /// </summary>
    public string SuccessThreshold         { get; set; } = "";

    // ── Advanced / paths ─────────────────────────────────────────
    /// <summary>Where download logs are written.</summary>
    public string ArtifactsDirectory       { get; set; } = "";
    /// <summary>Full path to the LreDownloadScriptsTask bootstrap index.js. Auto-detected if empty.</summary>
    public string NodeDistPath             { get; set; } = "";
    public string Description              { get; set; } = "";
}

