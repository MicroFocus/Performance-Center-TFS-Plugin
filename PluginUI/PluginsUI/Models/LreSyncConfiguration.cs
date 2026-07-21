/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
namespace PluginsUI.Models;

/// <summary>
/// Configuration fields for the Enterprise Performance Engineering Workspace Sync task (LreWorkspaceSyncTask).
/// Mirrors the task.json inputs exactly.
/// Passwords are intentionally excluded from serialisation (see ConfigurationService).
/// </summary>
public class LreSyncConfiguration
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

    // ── Workspace sync ────────────────────────────────────────────
    /// <summary>
    /// Local directory to scan for Enterprise Performance Engineering script folders (.usr / .jmx / .scala / .java / DevWeb).
    /// Defaults to the current working directory when empty.
    /// </summary>
    public string WorkspaceDir             { get; set; } = "";

    /// <summary>
    /// When true, only scripts that have a runtime component are uploaded (DevWeb / JMeter / Gatling).
    /// False uploads all detected script types.
    /// </summary>
    public bool   RuntimeOnly              { get; set; } = false;

    /// <summary>Number of concurrent script uploads. Clamped 1–20 by the task. Default 1 (sequential).</summary>
    public int    ParallelUploads          { get; set; } = 1;

    /// <summary>
    /// Minimum percentage of scripts that must upload successfully for the task to pass (0–100).
    /// Empty string means "not set" → the task defaults to 50%.
    /// 0  = pass even if no script uploads succeed (auth failure still fails the task).
    /// 100 = fail if even one script fails to upload.
    /// Values outside 0–100 fall back to the task's default (50%).
    /// </summary>
    public string SuccessThreshold         { get; set; } = "";

    // ── Advanced / paths ─────────────────────────────────────────
    /// <summary>Where upload logs and result files are written.</summary>
    public string ArtifactsDirectory       { get; set; } = "";
    /// <summary>Full path to the LreWorkspaceSyncTask bootstrap index.js. Auto-detected if empty.</summary>
    public string NodeDistPath             { get; set; } = "";
    public string Description              { get; set; } = "";
}

