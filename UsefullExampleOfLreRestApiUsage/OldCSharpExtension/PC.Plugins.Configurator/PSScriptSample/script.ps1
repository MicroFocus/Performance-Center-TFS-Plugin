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
$varTimeslotRepeat = "DoNotRepeat"
$varTimeslotRepeatDelay = "1"
$varTimeslotRepeatAttempts = "3"
try {
	$report = [PC.Plugins.Configurator.Configurator]::Perform($varPCServer, $varUserName, $varPassword, $varDomain, $varProject,
		 $varTestID, 	$varAutoTestInstance, $varTestInstID, $varPostRunAction,
		 $varProxyUrl, $varProxyUserName, $varProxyPassword,
		 $varTrending,	 $varTrendReportID, "", $varTimeslotDurationMinutes,
		 $varUseSLAStatus, $varUseVUDs, $varWorkDirectory, $varLogFileName, "", $varTimeslotRepeat, $varTimeslotRepeatDelay, $varTimeslotRepeatAttempts)

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
				# Check for an interrupt signal (e.g., press Ctrl+C)
				if($host.UI.RawUI.KeyAvailable -and ($host.UI.RawUI.ReadKey("NoEcho,IncludeKeyUp").Character -eq 3)) {
					throw "Script was interrupted."
				}
			}
			Start-Sleep -s 2
		} While (-not $isLogFileEnded -and $isLogFileEnded -ne $null)
	}
}
catch {
    # Handle the interruption by terminating the script
    Write-Host $_.Exception.Message
    Stop-Process -Id $PID
}

