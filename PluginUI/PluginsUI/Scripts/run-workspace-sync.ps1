<#
.SYNOPSIS
    Standalone helper script — runs the LRE Workspace Sync task (node dist/index.js) locally.

.DESCRIPTION
    Sets all INPUT_* environment variables that azure-pipelines-task-lib expects
    and launches "node dist/index.js" from the LreWorkspaceSyncTask build.
    Use this script from the command line when you do not want to use the PluginsUI.exe GUI.

    Parameters mirror the LreWorkspaceSyncTask task.json inputs exactly.

.EXAMPLE
    .\run-workspace-sync.ps1 `
        -PCServer "https://lre.mycompany.com:444/?tenant=fa128c06-5436-413d-9cfa-9f04bb738df3" `
        -Domain "DEFAULT" -Project "MyProject" `
        -UserName "admin" -Password "s3cr3t" `
        -WorkspaceDir "C:\src\my-load-tests"

.EXAMPLE
    # Token authentication, runtime only, 5 parallel uploads
    .\run-workspace-sync.ps1 `
        -PCServer "https://lre.mycompany.com:444" `
        -Domain "DEFAULT" -Project "MyProject" `
        -UseTokenForAuthentication $true `
        -UserName "clientId" -Password "clientSecret" `
        -WorkspaceDir "C:\src\my-load-tests" `
        -RuntimeOnly $true `
        -ParallelUploads 5
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

    # ── Workspace ─────────────────────────────────────────────────────────────
    # Directory to scan for LRE script folders (.usr / .jmx / .scala / .java / DevWeb).
    # Defaults to the current working directory when empty.
    [string]$WorkspaceDir = "",

    # When $true, only scripts with a runtime component are uploaded.
    [bool]  $RuntimeOnly      = $false,

    # Number of concurrent uploads (1–20).
    [int]   $ParallelUploads  = 10,

    # ── Proxy ─────────────────────────────────────────────────────────────────
    [string]$ProxyUrl      = "",
    [string]$ProxyUser     = "",
    [string]$ProxyPassword = "",

    # ── Advanced / paths ─────────────────────────────────────────────────────
    [string]$ArtifactsDir  = "",
    [string]$Description   = "",

    # Full path to LreWorkspaceSyncTask dist/index.js.  Auto-detected when empty.
    [string]$NodeDistPath  = ""
)

$ErrorActionPreference = "Stop"

# ── Resolve dist/index.js for the workspace sync task ─────────────────────────
if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 1. Installer layout: LreWorkspaceSyncTask\index.js (bootstrap) is one level above Scripts\
    $candidate = Join-Path $PSScriptRoot "..\LreWorkspaceSyncTask\index.js"
    $candidate = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    # 2. Typical repo layout: PluginUI/PluginsUI/Scripts  →  angular/LreWorkspaceSyncTask/index.js (bootstrap)
    $candidate = Join-Path $PSScriptRoot "..\..\..\angular\LreWorkspaceSyncTask\index.js"
    $candidate = [System.IO.Path]::GetFullPath($candidate)
    if (Test-Path $candidate) { $NodeDistPath = $candidate }
}

if ([string]::IsNullOrWhiteSpace($NodeDistPath)) {
    Write-Error @"
LreWorkspaceSyncTask index.js (bootstrap) not found.
Build the angular project first:
  cd angular
  npm install
  npm run build

Then pass -NodeDistPath to this script, or ensure the installer layout is intact:
  <install dir>\LreWorkspaceSyncTask\index.js
"@
    exit 1
}

Write-Host "Node dist : $NodeDistPath" -ForegroundColor DarkGray

# ── Resolve workspace directory ────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($WorkspaceDir)) {
    $WorkspaceDir = Get-Location | Select-Object -ExpandProperty Path
    Write-Host "Workspace : $WorkspaceDir  (defaulted to current directory)" -ForegroundColor DarkGray
} else {
    Write-Host "Workspace : $WorkspaceDir" -ForegroundColor DarkGray
}

if (-not (Test-Path $WorkspaceDir -PathType Container)) {
    Write-Error "Workspace directory does not exist: $WorkspaceDir"
    exit 1
}

# ── Resolve artifacts directory ────────────────────────────────────────────────
if ([string]::IsNullOrWhiteSpace($ArtifactsDir)) {
    $ArtifactsDir = Join-Path $env:TEMP ("LreWorkspaceSyncArtifacts\" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
Write-Host "Artifacts : $ArtifactsDir" -ForegroundColor DarkGray

# ── Clamp parallel uploads ──────────────────────────────────────────────────────
if ($ParallelUploads -lt 1)  { $ParallelUploads = 1  }
if ($ParallelUploads -gt 20) { $ParallelUploads = 20 }

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
$env:INPUT_VARPASSWORD                  = $Password           # task.json: varPassWord → INPUT_VARPASSWORD
$env:INPUT_VARDOMAIN                    = $Domain
$env:INPUT_VARPROJECT                   = $Project
$env:INPUT_VARWORKSPACEDIR              = $WorkspaceDir
$env:INPUT_VARRUNTIMEONLY               = $RuntimeOnly.ToString().ToLower()
$env:INPUT_VARPARALLELUPLOADS           = $ParallelUploads.ToString()
$env:INPUT_VARPROXYURL                  = $ProxyUrl
$env:INPUT_VARPROXYUSER                 = $ProxyUser
$env:INPUT_VARPROXYPASSWORD             = $ProxyPassword
$env:INPUT_VARARTIFACTSDIR              = $ArtifactsDir

# ── Run ─────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== LRE Workspace Sync Starting ===" -ForegroundColor Cyan
Write-Host "  Server           : $PCServer"
Write-Host "  Domain / Project : $Domain / $Project"
Write-Host "  Workspace        : $WorkspaceDir"
Write-Host "  Runtime only     : $RuntimeOnly"
Write-Host "  Parallel uploads : $ParallelUploads"
Write-Host ""

node "$NodeDistPath"
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== Workspace Sync Completed Successfully ===" -ForegroundColor Green
} else {
    Write-Warning "=== Workspace Sync Exited with Code $exitCode ==="
}
Write-Host "Artifacts : $ArtifactsDir"
exit $exitCode

