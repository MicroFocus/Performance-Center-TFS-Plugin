param([string][Parameter(Mandatory=$true,Position=0,HelpMessage="The base of the server URL. e.g. http(s)://MyServer.mydomain.com:80")] $lreServer,
	  [string][Parameter(Mandatory=$true,Position=1,HelpMessage="the user able to perform action on the project")] $username,
	  [string][Parameter(Mandatory=$true,Position=2,HelpMessage="the password of the user")] $password,
	  [string][Parameter(Mandatory=$true,Position=3,HelpMessage="the name of the domain (case sensitive)")] $domain,
	  [string][Parameter(Mandatory=$true,Position=4,HelpMessage="the name of the project (case sensitive)")] $project,
	  [string][Parameter(Mandatory=$true,Position=5,HelpMessage="the full file name of the script compressed to zip file and accessible by powershell")] $filePath,
	  [string][Parameter(Mandatory=$true,Position=6,HelpMessage="the folder path in project under subject `
	(path should be existing (there is an API allowing to create subject path but not implemeted here) `
	and might be case sensitive and should contain the root subject). e.g. myscriptsfolder\mysubscriptsfolder\mysubsubscriptsfolder")] $lreScriptSubjectPath,
	  [string][Parameter(Mandatory=$false,Position=7,HelpMessage="you can decide to overwrite if script already exist. default is true")] $lreScriptOverwrite="true",
	  [string] [Parameter(Mandatory=$false,Position=8,HelpMessage="you can decide to uploade all files or only runtime files (default is false)")]$lreScriptRuntimeOnly="false",
	  [string][Parameter(Mandatory=$false,Position=9,HelpMessage="relevant for multitenancy")] $tenant="fa128c06-5436-413d-9cfa-9f04bb738df3")

# Add the required assemblies
Add-Type -AssemblyName System.Net.Http

####### Define parameters (parametrized above) #########
# $lreServer = "http://MyServer"
# $tenant = "fa128c06-5436-413d-9cfa-9f04bb738df3"
# $username = "myuser"
# $password = "mypassword"
# $domain = "DANIEL"
# $project = "proj1"
# $filePath = "C:/scripts/90_Web_MessagesPrint.zip"
# $lreScriptSubjectPath = "scriptsfolder\subscriptsfolder"
# $lreScriptOverwrite = "true"
# $lreScriptRuntimeOnly = "false"

######################## Welcome message ############################
Write-Host ("")
Write-Host ("********* Welcome to script performing different rest commands over OpenText Enterprise Performance Engineering *********")
Write-Host ("")

######################## initialize some variables ##################
$success = $false
$apiUrlBase = ("{0}/loadtest/rest" -f $lreServer)
$apiDomainProject=("{0}/domains/{1}/projects/{2}" -f $apiUrlBase,$domain,$project)

if ([string]::IsNullOrEmpty($tenant)) {
  $tenantparam = ""
} else {
  $tenantparam = ("?tenant={0}" -f $tenant)
}

# relative APIs
$apiAPAuth = ("authentication-point/authenticate{0}" -f $tenantparam)
$apiAPLogout = "authentication-point/logout"
#$apiDomainProjectTest = "tests"
$apiDomainProjectScript = "scripts"

##################### 1 - authentication #######################
Write-Host ("")
Write-Host ("********* authenticating to Server ... *********")
Write-Host ("")

# Define URL for auth
$apiAuthUrl = ("{0}/{1}" -f $apiUrlBase,$apiAPAuth)
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(("{0}:{1}" -f $username,$password)))

# Create HttpClient
$httpClient = New-Object System.Net.Http.HttpClient

# Prepare authentication request
$requestMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $apiAuthUrl)
$requestMessage.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Basic", $base64AuthInfo)

# Send authentication request
$responseAuth = $httpClient.SendAsync($requestMessage).Result

# Check authentication response
if ($responseAuth.IsSuccessStatusCode) {
	$login = $true
    Write-Host "Authentication successful. Status code: $($responseAuth.StatusCode)"

    ###################### 3- upload script ########################
	Write-Host ("")
	Write-Host ("********* Uploading script to project ... *********")
	Write-Host ("")

	# Define URL for uploading script
	$apiDomainProjectScriptUrl = ("{0}/{1}" -f $apiDomainProject,$apiDomainProjectScript)

    # Define form data parameters (metadata)
    $formData = @{
        metadata = @"
        <Script xmlns="http://www.hp.com/PC/REST/API"> 
            <TestFolderPath>$lreScriptSubjectPath</TestFolderPath> 
            <Overwrite>$lreScriptOverwrite</Overwrite> 
            <RuntimeOnly>$lreScriptRuntimeOnly</RuntimeOnly> 
            <KeepCheckedOut>false</KeepCheckedOut> 
        </Script>
"@
    }
    
    # Create multipart form data content
    $multipartContent = New-Object System.Net.Http.MultipartFormDataContent
    
    # Add form data parameters
    foreach ($key in $formData.Keys) {
        $multipartContent.Add([System.Net.Http.StringContent]::new($formData[$key]), $key)
    }
    
    # Add file content
    $fileContent = [System.IO.File]::ReadAllBytes($filePath)
    $fileStream = [System.IO.MemoryStream]::new($fileContent)
    $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
    $multipartContent.Add($fileContent, "file", (Get-Item $filePath).Name)
    
    # Send the request
    $responseUploadScript = $httpClient.PostAsync($apiDomainProjectScriptUrl, $multipartContent).Result
    
    # Check the response
    if ($responseUploadScript.IsSuccessStatusCode) {
        Write-Host "Upload successful. Status code: $($responseUploadScript.StatusCode)"
        $success = $true
    } else {
        Write-Host "Upload failed. Status code: $($responseUploadScript.StatusCode)"
    }

} else {
    Write-Host "Authentication failed. Status code: $($responseAuth.StatusCode)"
}
if($login)
{
	
	######################## logout ################################
	Write-Host ("")
	Write-Host ("********* Performing Logout ... *********")
	Write-Host ("")
	#define URL for Logout
	$apiAPLogoutUrl = ("{0}/{1}" -f $apiUrlBase,$apiAPLogout)

	# Logout request
	$requestLogout = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $apiAPLogoutUrl)
	# Send logout request
	$responselogout = $httpClient.SendAsync($requestLogout).Result

	# Check authentication response
	if ($responselogout.IsSuccessStatusCode) {
		Write-Host "logout successful. Status code: $($responselogout.StatusCode)"
    } else {
        Write-Host "Logout failed. Status code: $($responselogout.StatusCode)"
    }
}
return $success