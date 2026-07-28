<#
.SYNOPSIS
    Standalone helper script — runs the LRE Download Scripts task (node index.js) locally.

.DESCRIPTION
    Sets all INPUT_* environment variables that azure-pipelines-task-lib expects
    and launches "node index.js" from the LreDownloadScriptsTask build.
    Use this script from the command line when you do not want to use the PluginsUI.exe GUI.

    Each downloaded script is extracted from its .usz (zip) archive into a sub-folder
    named after the script, under a directory hierarchy that mirrors the server-side
    test-plan path minus the root "Subject" segment.

    Example layout after download:
      <WorkspaceDir>\
        folder1\
          SubFolder1\
            MyScript\
              MyScript.usr
              ...

    Parameters mirror the LreDownloadScriptsTask task.json inputs exactly.

.EXAMPLE
    .\run-download-scripts.ps1 `
        -PCServer "https://lre.mycompany.com:444/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3" `
        -Domain "DEFAULT" -Project "MyProject" `
        -UserName "admin" -Password "s3cr3t" `
        -WorkspaceDir "C:\downloads\scripts"

.EXAMPLE
    # Token authentication, 5 parallel downloads
    .\run-download-scripts.ps1 `
        -PCServer "https://lre.mycompany.com:444" `
        -Domain "DEFAULT" -Project "MyProject" `
        -UseTokenForAuthentication $true `
        -UserName "I_KEY_abc" -Password "S_KEY_xyz" `
        -WorkspaceDir "C:\downloads\scripts" `
        -ParallelDownloads 5
#>
param(
    # ── Connection ────────────────────────────────────────────────────────────
    [Parameter(Mandatory = $true)]
    [string]$PCServer,

    [string]$Domain   = "DEFAULT",

    [Parameter(Mandatory = $true)]
    [string]$Project,

    [string]$UserName = "",
    [string]$Password = "",
    [bool]  $UseTokenForAuthentication = $false,

    # ── Download ──────────────────────────────────────────────────────────────
    # Local directory where downloaded scripts are extracted.
    # Defaults to the current working directory when empty.
    [string]$WorkspaceDir = "",

    # Number of concurrent downloads (1–20).
    [int]   $ParallelDownloads  = 1,

    # Minimum percentage of scripts that must download successfully (0–100).
    # Leave empty to use the task default (50 %).
    [string]$SuccessThreshold   = "",

    # ── Proxy ─────────────────────────────────────────────────────────────────
    [string]$ProxyUrl      = "",
    [string]$ProxyUser     = "",
    [string]$ProxyPassword = "",

    # ── Advanced / paths ─────────────────────────────────────────────────────
    [string]$ArtifactsDir  = "",
    [string]$Description   = "",

    # Full path to LreDownloadScriptsTask index.js (bootstrap).  Auto-detected when empty.
    [string]$NodeDistPath  = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve dist/index.js for the download scripts task ───────────────────────
if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 1. Installer layout: LreDownloadScriptsTask\index.js is one level above Scripts\
    $candidate = Join-Path $PSScriptRoot "..\LreDownloadScriptsTask\index.js"
    $candidate = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 2. Typical repo layout: PluginUI/PluginsUI/Scripts  →  angular/LreDownloadScriptsTask/index.js
    $candidate = Join-Path $PSScriptRoot "..\..\..\angular\LreDownloadScriptsTask\index.js"
    $candidate = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    Write-Error @"
LreDownloadScriptsTask index.js (bootstrap) not found.
Build the angular project first:
  cd angular
  npm install
  npm run build:download

Then pass -NodeDistPath to this script, or ensure the installer layout is intact:
  <install dir>\LreDownloadScriptsTask\index.js
"@
    exit 1
}

Write-Host "Node dist : $NodeDistPath" -ForegroundColor DarkGray

# ── Resolve download directory ─────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($WorkspaceDir)) {
    $WorkspaceDir = Get-Location | Select-Object -ExpandProperty Path
    Write-Host "Download  : $WorkspaceDir  (defaulted to current directory)" -ForegroundColor DarkGray
} else {
    Write-Host "Download  : $WorkspaceDir" -ForegroundColor DarkGray
}

# Create the download directory if it does not exist
if (-not (Test-Path $WorkspaceDir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $WorkspaceDir | Out-Null
    Write-Host "  Created download directory: $WorkspaceDir" -ForegroundColor DarkGray
}

# ── Resolve artifacts directory ────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($ArtifactsDir)) {
    $ArtifactsDir = Join-Path $env:TEMP ("LreDownloadArtifacts\" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
Write-Host "Artifacts : $ArtifactsDir" -ForegroundColor DarkGray

# ── Clamp parallel downloads ───────────────────────────────────────────────────
if ($ParallelDownloads -lt 1)  { $ParallelDownloads = 1  }
if ($ParallelDownloads -gt 20) { $ParallelDownloads = 20 }

# ── Set Azure DevOps agent context variables ────────────────────────────────────
$env:SYSTEM_TASKINSTANCEID          = [Guid]::NewGuid().ToString()
$env:SYSTEM_JOBID                   = [Guid]::NewGuid().ToString()
$env:BUILD_BUILDID                  = "1"
$env:BUILD_ARTIFACTSTAGINGDIRECTORY = $ArtifactsDir
$env:BUILD_SOURCESDIRECTORY         = $WorkspaceDir

# ── Set INPUT_* task variables ──────────────────────────────────────────────────
# Names are normalised by azure-pipelines-task-lib: upper-cased, non-alnum stripped.
$env:INPUT_DESCRIPTIONSTRING            = $Description
$env:INPUT_VARPCSERVER                  = $PCServer
$env:INPUT_VARUSETOKENFORAUTHENTICATION = $UseTokenForAuthentication.ToString().ToLower()
$env:INPUT_VARUSERNAME                  = $UserName
$env:INPUT_VARPASSWORD                  = $Password
$env:INPUT_VARDOMAIN                    = $Domain
$env:INPUT_VARPROJECT                   = $Project
$env:INPUT_VARWORKSPACEDIR              = $WorkspaceDir
$env:INPUT_VARPARALLELDOWNLOADS         = $ParallelDownloads.ToString()
$env:INPUT_VARSUCCESSTHRESHOLD          = $SuccessThreshold
$env:INPUT_VARPROXYURL                  = $ProxyUrl
$env:INPUT_VARPROXYUSER                 = $ProxyUser
$env:INPUT_VARPROXYPASSWORD             = $ProxyPassword
$env:INPUT_VARARTIFACTSDIR              = $ArtifactsDir

# ── Run ─────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== LRE Download Scripts Starting ===" -ForegroundColor Cyan
Write-Host "  Server             : $PCServer"
Write-Host "  Domain / Project   : $Domain / $Project"
Write-Host "  Download directory : $WorkspaceDir"
Write-Host "  Parallel downloads : $ParallelDownloads"
if (-not [string]::IsNullOrWhiteSpace($SuccessThreshold)) {
    Write-Host "  Success threshold  : $SuccessThreshold%"
}
Write-Host ""

node "$NodeDistPath"
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== Download Scripts Completed Successfully ===" -ForegroundColor Green
} else {
    Write-Warning "=== Download Scripts Exited with Code $exitCode ==="
}
Write-Host "Artifacts : $ArtifactsDir"
exit $exitCode

