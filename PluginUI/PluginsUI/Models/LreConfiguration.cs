/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 */
namespace PluginsUI.Models;

/// <summary>
/// All configuration fields collected by the UI.
/// Passwords are intentionally excluded from serialisation (see ConfigurationService).
/// </summary>
public class LreConfiguration
{
    // ── Connection ────────────────────────────────────────────────
    public string ServerUrl               { get; set; } = "https://MyServer:443";
    public bool   UseTokenForAuthentication { get; set; } = false;
    public string UserName                { get; set; } = "";
    public string Domain                  { get; set; } = "DEFAULT";
    public string Project                 { get; set; } = "";

    // ── Test ──────────────────────────────────────────────────────
    public string TestId                  { get; set; } = "";
    public bool   AutoTestInstance        { get; set; } = true;
    public string TestInstanceId          { get; set; } = "";

    // ── Proxy ─────────────────────────────────────────────────────
    public string ProxyUrl                { get; set; } = "";
    public string ProxyUserName           { get; set; } = "";
    // ProxyPassword is NOT persisted

    // ── Run options ───────────────────────────────────────────────
    /// <summary>CollateResults | CollateAndAnalyze | DoNotCollate</summary>
    public string PostRunAction           { get; set; } = "CollateAndAnalyze";
    /// <summary>DoNotTrend | AssociatedTrend | UseTrendReportID</summary>
    public string Trending                { get; set; } = "DoNotTrend";
    public string TrendReportId           { get; set; } = "";
    public string TimeslotDurationMinutes { get; set; } = "30";
    public bool   UseVUDs                 { get; set; } = false;
    public bool   UseSLAInStatus          { get; set; } = false;
    /// <summary>DoNotRepeat | RepeatWithParameters</summary>
    public string TimeslotRepeat          { get; set; } = "DoNotRepeat";
    public string TimeslotRepeatDelay     { get; set; } = "";
    public string TimeslotRepeatAttempts  { get; set; } = "";

    // ── Advanced / paths ─────────────────────────────────────────
    /// <summary>Where result artifacts are written. Falls back to a temp folder if empty.</summary>
    public string ArtifactsDirectory      { get; set; } = "";
    /// <summary>Full path to the LreCiTask bootstrap index.js. Auto-detected if empty.</summary>
    public string NodeDistPath            { get; set; } = "";
    public string Description             { get; set; } = "";
}

