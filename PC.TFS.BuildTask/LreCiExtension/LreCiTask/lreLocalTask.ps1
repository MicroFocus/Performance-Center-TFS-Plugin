#
# lreLocalTask.ps1
#

$varPCServer = $env:VARPCSERVER
$varUserName = $env:VARUSERNAME
$varPassword = $env:VARPASSWORD
$varDomain = $env:VARDOMAIN
$varProject = $env:VARPROJECT
$varTestID = $env:VARTESTID
$varAutoTestInstance = $env:VARAUTOTESTINSTANCE
$varTestInstID = $env:VARTESTINSTID
$varPostRunAction = $env:VARPOSTRUNACTION
$varProxyUrl = $env:VARPROXYURL
$varProxyUser = $env:VARPROXYUSER
$varProxyPassword = $env:VARPROXYPASSWORD
$varTrending = $env:VARTRENDING
$varTrendReportID = $env:VARTRENDREPORTID
$varTimeslotDuration = $env:VARTIMESLOTDURATION
$varUseVUDs = $env:VARUSEVUDS
$varUseSLAInStatus = $env:VARUSESLAINSTATUS
$varArtifactsDir = $env:VARARTIFACTSDIR
$varTimeslotRepeat = $env:VARTIMESLOTREPEAT
$varTimeslotRepeatDelay = $env:VARTIMESLOTREPEATDELAY
$varTimeslotRepeatAttempts = $env:VARTIMESLOTREPEATATTEMPTS
$varUseTokenForAuthentication = $env:VARUSETOKENFORAUTHENTICATION

$dateTime="$("$(Get-Date -format 'u')")".Replace(":","-").Replace(" ", "--");
$varArtifactsDir="$($varArtifactsDir)\$($dateTime)".Replace("\\", "\")

#Write-Host "+++++++++Verifying required environment variable++++++++++"
$pcworkdir = $PSScriptRoot
#Write-Host "++++++++/Verifying required environment variable++++++++++"

$varAutomationDll = "PC.Plugins.Automation.dll"
$varCommonDll = "PC.Plugins.Common.dll"
$varConfiguratorDll="PC.Plugins.Configurator.dll"

if (-Not((Test-Path -Path ("{0}\{1}" -f $pcworkdir, $varAutomationDll)) -and (Test-Path -Path ("{0}\{1}" -f $pcworkdir, $varCommonDll)) -and (Test-Path -Path ("{0}\{1}" -f $pcworkdir, $varConfiguratorDll))))
{
	Write-Host "files not found with the extension under " $pcworkdir
	Write-Host "trying to use the files from the environment variable PC_LAUNCHER"
	$pcworkdir = $env:PC_LAUNCHER
}
if ((Test-Path -Path ("{0}\{1}" -f $pcworkdir, $varAutomationDll)) -and (Test-Path -Path  ("{0}\{1}" -f $pcworkdir, $varCommonDll)) -and (Test-Path -Path ("{0}\{1}" -f $pcworkdir, $varConfiguratorDll)))
{
	#Write-Host "++++++++++++loading+libraries*+++++++++++++++++++"
	$assembly = [Reflection.Assembly]::LoadFile(("{0}\{1}" -f $pcworkdir, $varAutomationDll))
	$assembly = [Reflection.Assembly]::LoadFile(("{0}\{1}" -f $pcworkdir, $varCommonDll))
	$assembly = [Reflection.Assembly]::LoadFile(("{0}\{1}" -f $pcworkdir, $varConfiguratorDll))
	#Write-Host "++++++++++++/loading+libraries*++++++++++++++++++"

	Start-Sleep -s 2


	#Write-Host "+++++++++++++executing command+++++++++++++++++++"

	$report = [PC.Plugins.Configurator.Configurator]::Perform($varPCServer, $varUseTokenForAuthentication, $varUserName, $varPassword,  $varDomain, $varProject,
		$varTestID, $varAutoTestInstance, $varTestInstID, $varPostRunAction,
		$varProxyUrl, $varProxyUser, $varProxyPassword, 
		$varTrending, $varTrendReportID, "", $varTimeslotDuration,
		$varUseSLAInStatus, $varUseVUDs, $varArtifactsDir, "", "", $varTimeslotRepeat, $varTimeslotRepeatDelay, $varTimeslotRepeatAttempts)

	#Write-Host "+++++++++++++++++Log Content+++++++++++++++++++++"
	
	Start-Sleep -s 2
	
	if($report -ne "")
	{
		Start-Sleep -s 2
		$isLogFileEnded = [PC.Plugins.Configurator.Configurator]::IsLogFileEnded($report)
		do 
		{
			$isLogFileEnded = [PC.Plugins.Configurator.Configurator]::IsLogFileEnded($report)
			$newContent = [PC.Plugins.Configurator.Configurator]::GetNewContent($report)
			if($newContent -ne "")
			{
				Write-Host $newContent
			}
			Start-Sleep -s 2
		} While (-not $isLogFileEnded -and $isLogFileEnded -ne $null)
		$taskStatus =  [PC.Plugins.Configurator.Configurator]::GetTaskStatus($report)
		if ($taskStatus -ne $null)
		{
			Write-Error $taskStatus
		}
		[PC.Plugins.Configurator.Configurator]::DeleteUnusedFilesFromArtifact($report)
	}
}
else
{
	if ($pcworkdir -ne $null)
	{	
		Write-Error "Assembly files not found under " $pcworkdir
	}
	else
	{
		Write-Error "Environment variable PC_LAUNCHER not set"
	}
}
