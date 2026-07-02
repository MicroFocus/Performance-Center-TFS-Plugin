# PowerShell script to build and test the LRE task locally

param(
    [string]$PCServer = "http://MyServer:80",
    [string]$Domain = "DEFAULT",
    [string]$Project = "MyProject",
    [string]$TestID = "1",
    [string]$UserName = "admin",
    [string]$Password = "password",
    [string]$TestInstanceID = "",
    [string]$ArtifactsDir = "$PSScriptRoot\test-artifacts"
)

$ErrorActionPreference = "Stop"

Write-Host "=== LRE Task Local Test Runner ===" -ForegroundColor Cyan
Write-Host "Building TypeScript..." -ForegroundColor Yellow

# Navigate to task directory
Push-Location "$PSScriptRoot\LreCiTask"

try {
    $nodeVersionText = node --version
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js 20 or newer is required but node.exe was not found in PATH."
    }

    $nodeMajorVersion = [int]($nodeVersionText.TrimStart('v').Split('.')[0])
    if ($nodeMajorVersion -lt 20) {
        throw "Node.js 20 or newer is required. Current version: $nodeVersionText"
    }

    # Install dependencies
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install 2>&1 | Out-Null

    # Build TypeScript
    Write-Host "Compiling TypeScript..." -ForegroundColor Yellow
    npm run build 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }

    # Create artifacts directory
    if (-not (Test-Path $ArtifactsDir)) {
        New-Item -ItemType Directory -Path $ArtifactsDir -Force | Out-Null
        Write-Host "Created artifacts directory: $ArtifactsDir" -ForegroundColor Green
    }

    # Run the test
    Write-Host "`n=== Running Task ===" -ForegroundColor Cyan
    Write-Host "PC Server: $PCServer"
    Write-Host "Domain: $Domain"
    Write-Host "Project: $Project"
    Write-Host "Test ID: $TestID"
    Write-Host "Artifacts Dir: $ArtifactsDir"
    Write-Host ""

    # Set environment variables for task inputs
    $env:SYSTEM_TASKINSTANCEID = "test-instance-" + [System.Guid]::NewGuid().ToString()
    $env:SYSTEM_JOBID = "test-job-" + [System.Guid]::NewGuid().ToString()
    $env:BUILD_BUILDID = "1"
    $env:BUILD_ARTIFACTSTAGINGDIRECTORY = $ArtifactsDir
    $env:INPUT_DESCRIPTIONSTRING = "Local Test Run"
    $env:INPUT_VARPCSERVER = $PCServer
    $env:INPUT_VARUSETOKENFORAUTHENTICATION = "false"
    $env:INPUT_VARUSERNAME = $UserName
    $env:INPUT_VARPASSWORD = $Password
    $env:INPUT_VARDOMAIN = $Domain
    $env:INPUT_VARPROJECT = $Project
    $env:INPUT_VARTESTID = $TestID
    $env:INPUT_VARAUTOTESTINSTANCE = "true"
    $env:INPUT_VARTESTINSTID = $TestInstanceID
    $env:INPUT_VARPROXYURL = ""
    $env:INPUT_VARPROXYUSER = ""
    $env:INPUT_VARPROXYPASSWORD = ""
    $env:INPUT_VARPOSTRUNACTION = "CollateAndAnalyze"
    $env:INPUT_VARTRENDING = "DoNotTrend"
    $env:INPUT_VARTRENDREPORTID = ""
    $env:INPUT_VARTIMESLOTDURATION = "30"
    $env:INPUT_VARUSEVUDS = "false"
    $env:INPUT_VARUSESLAINSTATUS = "false"
    $env:INPUT_VARTIMESLOTREPEAT = "DoNotRepeat"
    $env:INPUT_VARTIMESLOTREPEATDELAY = ""
    $env:INPUT_VARTIMESLOTREPEATATTEMPTS = ""
    $env:INPUT_VARARTIFACTSDIR = $ArtifactsDir

    # Run the task
    node dist/index.js

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n=== Test Completed Successfully ===" -ForegroundColor Green
        Write-Host "Check artifacts at: $ArtifactsDir"

        # List generated files
        if (Test-Path $ArtifactsDir) {
            Write-Host "`nGenerated files:" -ForegroundColor Yellow
            Get-ChildItem $ArtifactsDir -Recurse | Select-Object FullName | ForEach-Object { Write-Host "  $_" }
        }
    } else {
        Write-Host "`n=== Test Failed ===" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

