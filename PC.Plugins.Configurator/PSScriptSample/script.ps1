$assembly = [Reflection.Assembly]::LoadFile("C:\Users\dananda\Desktop\PC.Plugins.Common\PC.TFS.Plugin\PC.Plugins.Configurator\bin\Debug\PC.Plugins.Automation.dll")
$assembly = [Reflection.Assembly]::LoadFile("C:\Users\dananda\Desktop\PC.Plugins.Common\PC.TFS.Plugin\PC.Plugins.Configurator\bin\Debug\PC.Plugins.Common.dll")
$assembly = [Reflection.Assembly]::LoadFile("C:\Users\dananda\Desktop\PC.Plugins.Common\PC.TFS.Plugin\PC.Plugins.Configurator\bin\Debug\PC.Plugins.Configurator.dll")

$varPCServer = "http://myd-vm06917"
$varUserName = "sa"
$varPassword = ""
$varDomain = "DEFAULT"
$varProject ="PC"
$varTestID ="19"
$varAutoTestInstance = "true"
$varTestInstID = ""
$varPostRunAction = "CollateAndAnalyze"
$varProxyUrl = ""
$varProxyUserName = ""
$varProxyPassword = ""
$varTrending = "DoNotTrend"
$varTrendReportID = ""
$varTimeslotDurationMinutes = "30"
$varUseSLAStatus = "false"
$varUseVUDs = "false"
$varWorkDirectory = ""
$varLogFileName = ""

$report = [PC.Plugins.Configurator.Configurator]::Perform($varPCServer, $varUserName, $varPassword, $varDomain, $varProject,
	 $varTestID, 	$varAutoTestInstance, $varTestInstID, $varPostRunAction,
	 $varProxyUrl, $varProxyUserName, $varProxyPassword,
	 $varTrending,	 $varTrendReportID, "", $varTimeslotDurationMinutes,
	 $varUseSLAStatus, $varUseVUDs, $varWorkDirectory, $varLogFileName, "")

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
}

