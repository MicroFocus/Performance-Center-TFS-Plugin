# PowerShell3 execution handler for the LRE CI Task.

# Used as a fallback when the Azure DevOps agent is too old to map the
# Node20_1 / Node20 / Node16 task-execution handlers to the correct Node
# externals (typically agent v2.x with Node 20 added manually).
#
# Execution order in task.json:
#   1. Node20_1  - handled natively by agents that support it
#   2. Node20    - handled natively by agents that support it
#   3. Node16    - handled natively by agents that support it
#   4. PowerShell3 (this script) - explicit Node 20 lookup from agent externals
#   5. Node      - falls through to index.js which hard-fails with a clear msg

param()
$ErrorActionPreference = "Stop"

$taskRoot  = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentHome = $env:AGENT_HOMEDIRECTORY   # set by every Azure DevOps agent

# Candidates in preference order: newest first
$nodeCandidates = @()
if ($agentHome) {
    $nodeCandidates += Join-Path $agentHome "externals\node20_1\bin\node.exe"
    $nodeCandidates += Join-Path $agentHome "externals\node20\bin\node.exe"
    $nodeCandidates += Join-Path $agentHome "externals\node16\bin\node.exe"
}

$nodeExe = $null
foreach ($candidate in $nodeCandidates) {
    if (Test-Path $candidate) {
        $nodeExe = $candidate
        break
    }
}

if (-not $nodeExe) {
    # Last resort: whatever 'node' is on the system PATH
    $sysNode = Get-Command node -ErrorAction SilentlyContinue
    if ($sysNode) { $nodeExe = $sysNode.Source }
}

if (-not $nodeExe) {
    $msg = "Node.js 16+ was not found in the agent externals or on the system PATH." +
           " Searched: $($nodeCandidates -join ', ')." +
           " Please upgrade the Azure DevOps agent to v3.x so it bundles Node 20 externals," +
           " or install Node 16+ on this machine."
    Write-Host "##vso[task.logissue type=error]$msg"
    Write-Host "##vso[task.complete result=Failed;]$msg"
    exit 1
}

$nodeVersion = & $nodeExe --version
Write-Host "##[debug]LRE Task PowerShell3 handler: using $nodeExe ($nodeVersion)"

& $nodeExe (Join-Path $taskRoot "index.js")
exit $LASTEXITCODE
