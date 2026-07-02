<#
.SYNOPSIS
    Standalone helper script — runs the LRE angular task (node dist/index.js) locally.

.DESCRIPTION
    Sets all INPUT_* environment variables that azure-pipelines-task-lib expects
    and launches "node dist/index.js".  Use this script from the command line or
    from CI when you do not want to use the PluginsUI.exe GUI.

    Parameters mirror the task.json inputs exactly.

.EXAMPLE
    .\run-lre-task.ps1 `
        -PCServer "https://lre.mycompany.com:444/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3" `
        -Domain "DEFAULT" -Project "MyProject" `
        -TestID "42" -UserName "admin" -Password "s3cr3t"
#>
param(
    # ── Connection ────────────────────────────────────────────────────────────
    [Parameter(Mandatory = $true)]
    [string]$PCServer,

    [string]$Domain   = "DEFAULT",

    [Parameter(Mandatory = $true)]
    [string]$Project,

    [Parameter(Mandatory = $true)]
    [string]$TestID,

    [string]$UserName = "",
    [string]$Password = "",
    [bool]  $UseTokenForAuthentication = $false,

    # ── Test ──────────────────────────────────────────────────────────────────
    [bool]  $AutoTestInstance = $true,
    [string]$TestInstanceID   = "",

    # ── Proxy ─────────────────────────────────────────────────────────────────
    [string]$ProxyUrl      = "",
    [string]$ProxyUser     = "",
    [string]$ProxyPassword = "",

    # ── Run options ───────────────────────────────────────────────────────────
    # CollateResults | CollateAndAnalyze | DoNotCollate
    [string]$PostRunAction  = "CollateAndAnalyze",

    # DoNotTrend | AssociatedTrend | UseTrendReportID
    [string]$Trending       = "DoNotTrend",
    [string]$TrendReportID  = "",

    [string]$TimeslotDuration    = "30",
    [bool]  $UseVUDs             = $false,
    [bool]  $UseSLAInStatus      = $false,

    # DoNotRepeat | RepeatWithParameters
    [string]$TimeslotRepeat          = "DoNotRepeat",
    [string]$TimeslotRepeatDelay     = "",
    [string]$TimeslotRepeatAttempts  = "",

    # ── Advanced / paths ─────────────────────────────────────────────────────
    [string]$ArtifactsDir  = "",
    [string]$Description   = "",

    # Full path to dist/index.js.  Auto-detected when empty.
    [string]$NodeDistPath  = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve dist/index.js ──────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 1. Next to this script
    $candidate = Join-Path $PSScriptRoot "dist\index.js"
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 2. Typical repo layout: PluginUI/PluginsUI/Scripts  →  angular/LreCiTask/dist
    $candidate = Join-Path $PSScriptRoot "..\..\..\angular\LreCiTask\dist\index.js"
    $candidate = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    Write-Error @"
dist/index.js not found.
Build the angular project first:
  cd angular\LreCiTask
  npm install
  npm run build

Then pass -NodeDistPath to this script or ensure dist\index.js is next to it.
"@
    exit 1
}

Write-Host "Node dist : $NodeDistPath" -ForegroundColor DarkGray

# ── Resolve artifacts directory ───────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($ArtifactsDir)) {
    $ArtifactsDir = Join-Path $env:TEMP ("LrePluginArtifacts\" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
Write-Host "Artifacts : $ArtifactsDir" -ForegroundColor DarkGray

# ── Set Azure DevOps agent context variables ───────────────────────────────
$env:SYSTEM_TASKINSTANCEID          = [Guid]::NewGuid().ToString()
$env:SYSTEM_JOBID                   = [Guid]::NewGuid().ToString()
$env:BUILD_BUILDID                  = "1"
$env:BUILD_ARTIFACTSTAGINGDIRECTORY = $ArtifactsDir

# ── Set INPUT_* task variables ────────────────────────────────────────────
# Names are normalised by azure-pipelines-task-lib: upper-cased, non-alnum stripped.
$env:INPUT_DESCRIPTIONSTRING            = $Description
$env:INPUT_VARPCSERVER                  = $PCServer
$env:INPUT_VARUSETOKENFORAUTHENTICATION = $UseTokenForAuthentication.ToString().ToLower()
$env:INPUT_VARUSERNAME                  = $UserName
$env:INPUT_VARPASSWORD                  = $Password          # task.json: varPassWord → INPUT_VARPASSWORD
$env:INPUT_VARDOMAIN                    = $Domain
$env:INPUT_VARPROJECT                   = $Project
$env:INPUT_VARTESTID                    = $TestID
$env:INPUT_VARAUTOTESTINSTANCE          = $AutoTestInstance.ToString().ToLower()
$env:INPUT_VARTESTINSTID                = $TestInstanceID
$env:INPUT_VARPROXYURL                  = $ProxyUrl
$env:INPUT_VARPROXYUSER                 = $ProxyUser
$env:INPUT_VARPROXYPASSWORD             = $ProxyPassword
$env:INPUT_VARPOSTRUNACTION             = $PostRunAction
$env:INPUT_VARTRENDING                  = $Trending
$env:INPUT_VARTRENDREPORTID             = $TrendReportID
$env:INPUT_VARTIMESLOTDURATION          = $TimeslotDuration
$env:INPUT_VARUSEVUDS                   = $UseVUDs.ToString().ToLower()
$env:INPUT_VARUSESLAINSTATUS            = $UseSLAInStatus.ToString().ToLower()
$env:INPUT_VARTIMESLOTREPEAT            = $TimeslotRepeat    # task.json: vartimeslotRepeat → INPUT_VARTIMESLOTREPEAT
$env:INPUT_VARTIMESLOTREPEATDELAY       = $TimeslotRepeatDelay
$env:INPUT_VARTIMESLOTREPEATATTEMPTS    = $TimeslotRepeatAttempts
$env:INPUT_VARARTIFACTSDIR              = $ArtifactsDir

# ── Run ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== LRE Task Starting ===" -ForegroundColor Cyan
Write-Host "  Server   : $PCServer"
Write-Host "  Test ID  : $TestID"
Write-Host ""

node "$NodeDistPath"
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== Task Completed Successfully ===" -ForegroundColor Green
} else {
    Write-Warning "=== Task Exited with Code $exitCode ==="
}
Write-Host "Artifacts : $ArtifactsDir"
exit $exitCode

