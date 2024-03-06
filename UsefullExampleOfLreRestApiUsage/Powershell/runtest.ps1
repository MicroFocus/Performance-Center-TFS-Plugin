#region parameters
param([string][Parameter(Mandatory=$true,Position=0,HelpMessage="The base of the LRE server URL. e.g. http(s)://mylreserver.mydomain.com:80")] $lreServer,
	[string][Parameter(Mandatory=$true,Position=1,HelpMessage="the LRE user able to perform action on the lreproject")] $username,
	[string][Parameter(Mandatory=$true,Position=2,HelpMessage="the password of the lre user")] $password,
	[string][Parameter(Mandatory=$true,Position=3,HelpMessage="the name of the domain in LRE (case sensitive)")] $domain,
	[string][Parameter(Mandatory=$true,Position=4,HelpMessage="the name of the project in LRE (case sensitive)")] $project,
	[string][Parameter(Mandatory=$true,Position=5,HelpMessage="The Id of the test to be executed")] $testId,
    [string][Parameter(Mandatory=$true,Position=6,HelpMessage="Timeslot duration in Hours")] $timeslotDurationHours,
    [string][Parameter(Mandatory=$true,Position=7,HelpMessage="Timeslot duration in Minutes (timeslot duration requires to be at least 30 minutes if previous parameter is set to 0)")] $timeslotDurationMinutes,
    [string][Parameter(Mandatory=$true,Position=8,HelpMessage="select one of the following options: 0 for ""Collate Results"", 1 for ""Collate And Analyze"" and 2 for ""Do Not Collate""")] $postRunAction,
    [string][Parameter(Mandatory=$false,Position=9,HelpMessage="Set to true if vuds licenses should be used")] $vudsMode=$false,
	[string][Parameter(Mandatory=$false,Position=10,HelpMessage="relevant for multitenancy")] $tenant="fa128c06-5436-413d-9cfa-9f04bb738df3")

#endregion


#region Add the required assemblies
Add-Type -AssemblyName System.Net.Http
#endregion

#region Define parameters (parametrized above)
# $lreServer = "http://mylreserver"
# $username = "myuser"
# $password = "mypassword"
# $domain = "DANIEL"
# $project = "proj1"
# $testId = "180"
# $timeslotDurationHours = 0
# $timeslotDurationMinutes = 30
# $postRunAction = 1
# $vudsMode = $false
# $tenant = "fa128c06-5436-413d-9cfa-9f04bb738df3"
#endregion

#region classes

# Define a class representing the structure of TestInstance
class TestInstance {
    [int] $TestID
    [int] $TestSetID
    [int] $TestInstanceID
}

#endregion

#region initialize parameters
######################## Welcome message ############################
Write-Host ("")
Write-Host ("********* Welcome to script performing different rest commands over LRE *********")
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
#$apiDomainProjectScript = "scripts"
$apiDomainProjectTests = "tests"
$apiDomainProjectTestInstances = "testinstances"
$apiDomainProjectTestsets = "testsets"
$apiDomainProjectRuns = "runs"

$postRunActions = @("Collate Results", "Collate And Analyze", "Do Not Collate")
$selectedPostRunAction = $postRunActions[$postRunAction]

# Create HttpClient
$httpClient = New-Object System.Net.Http.HttpClient
#endregion

#region functions Important: each function needs to be defined\declared before being used in script
function LreLogin() {
    # Define URL for auth
    $apiAuthUrl = ("{0}/{1}" -f $apiUrlBase,$apiAPAuth)
    $base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(("{0}:{1}" -f $username,$password)))
    # Prepare authentication request
    $requestMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $apiAuthUrl)
    $requestMessage.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Basic", $base64AuthInfo)

    # Send authentication request
    $responseAuth = $httpClient.SendAsync($requestMessage).Result
	return $responseAuth
}
function LreLogout() {
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
    }
	else {
        Write-Host "Logout failed. Status code: $($responselogout.StatusCode)"
    }
}

function LreTestExist() {
	$testsIdUrl = "$apiDomainProject/$apiDomainProjectTests/$testId"
	$requestTestIdMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $testsIdUrl)
	$responseToRequestTestIdMessage = $httpClient.SendAsync($requestTestIdMessage).Result
	if ($responseToRequestTestIdMessage.IsSuccessStatusCode) {
		if($null -ne $responseToRequestTestIdMessage){
			return $true
		}
		return $false
	}
	return $false
}

function LreGetTestInstancesByTestId {
    # Construct the URL for the query
    $testInstancesByTestIdQueryUrl = "{0}/{1}?query={2}" -f $apiDomainProject, $apiDomainProjectTestInstances, "{test-id[$testId]}"

    # Create the HTTP request message
    $requestTestInstancesMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $testInstancesByTestIdQueryUrl)

    # Specify Accept header to request JSON response
    $requestTestInstancesMessage.Headers.Accept.Add("application/json")

    # Send the request and receive the response
    $responseToRequestTestInstancesMessage = $httpClient.SendAsync($requestTestInstancesMessage).Result

    # Check if the request was successful (status code 200)
    if ($responseToRequestTestInstancesMessage.IsSuccessStatusCode) {
        # Read the content of the response as a string
        $responseTestInstancesContent = $responseToRequestTestInstancesMessage.Content.ReadAsStringAsync().Result

        # Convert the response content from JSON to an object
        $responseTestInstances = ConvertFrom-Json $responseTestInstancesContent

        # Return the object
        return $responseTestInstances
    }
    else {
        # If the request was not successful, handle the error (for example, by throwing an exception)
        throw "Failed to retrieve test instances. Status code: $($responseToRequestTestInstancesMessage.StatusCode)"
    }
}

function LreGetTestsets {
    $getTestsetsUrl = "{0}/{1}" -f $apiDomainProject, $apiDomainProjectTestsets
    $requestTestsetsMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $getTestsetsUrl)
    # Specify Accept header to request JSON response
    $requestTestsetsMessage.Headers.Accept.Add("application/json")
    $responseToRequestTestsetsMessage = $httpClient.SendAsync($requestTestsetsMessage).Result
    if ($responseToRequestTestsetsMessage.IsSuccessStatusCode) {
        # Read the content of the response as a string
        $responseTestsetsContent = $responseToRequestTestsetsMessage.Content.ReadAsStringAsync().Result

        # Convert the response content from JSON to an object
        $responseTestsets = ConvertFrom-Json $responseTestsetsContent

        # Return the object
        return $responseTestsets
    }
}

function LreGetTestset {
    $testsets = LreGetTestsets
    if (@($testsets).Count -gt 0) {
        $firstTestset = $testsets[0]
        return $firstTestset
    }
    else {
        Write-Host ("create a testset in the project or implement a flow creating a testset via rest")
        return $null
    }
}
function LreCreateTestInstance {
    $createTestInstanceUrl = "{0}/{1}" -f $apiDomainProject, $apiDomainProjectTestInstances
    $createTestInstanceBody = "<TestInstance xmlns = ""http://www.hp.com/PC/REST/API""><TestID>$testId</TestID><TestSetID>$($lreTestSet.TestSetId)</TestSetID></TestInstance>"
    $createTestInstanceMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::POST, $createTestInstanceUrl)

    # Set the request body
    $createTestInstanceMessage.Content = [System.Net.Http.StringContent]::new($createTestInstanceBody, [System.Text.Encoding]::UTF8, "application/xml")

    # Specify Accept header to request JSON response
    $createTestInstanceMessage.Headers.Accept.Add("application/json")
    
    $responseToCreateTestInstanceMessage = $httpClient.SendAsync($createTestInstanceMessage).Result
    if ($responseToCreateTestInstanceMessage.IsSuccessStatusCode) {
        # Read the content of the response as a string
        $responseTestInstanceContent = $responseToCreateTestInstanceMessage.Content.ReadAsStringAsync().Result

        # Convert the response content from JSON to an object
        $responseTestInstance = ConvertFrom-Json $responseTestInstanceContent

        # Return the response content
        return $responseTestInstance
    }
    else {
        # If the request was not successful, handle the error (for example, by throwing an exception)
        throw "Failed to create test instance. Status code: $($responseToCreateTestInstanceMessage.StatusCode)"
    }
}



function LreGetCorrectTestInstanceID {
	if (LreTestExist) {
		$lreTestInstances = LreGetTestInstancesByTestId
        if (@($lreTestInstances).Count -gt 0) {
            $firstTestInstance = $lreTestInstances[0]
            return $firstTestInstance
        }
        else {
            $lreTestSet = LreGetTestset
            if($lreTestSet) {
                $newTestinstance = LreCreateTestInstance
                return $newTestinstance
            }
        }

		return $lreTestInstances
	}
	Write-Host "Test id $testId does not exist"
	return 0;
}


function LreStartRun() {
    $startRunUrl = "{0}/{1}" -f $apiDomainProject, $apiDomainProjectRuns
    $startRunBody = "<Run xmlns = ""http://www.hp.com/PC/REST/API"">
    <PostRunAction>$selectedPostRunAction</PostRunAction>
    <TestID>$testId</TestID>
    <TestInstanceID>$($lreTestInstance.TestInstanceID)</TestInstanceID>
    <TimeslotDuration>
        <Hours>$timeslotDurationHours</Hours>
        <Minutes>$timeslotDurationMinutes</Minutes>
    </TimeslotDuration>
    <VudsMode>$($vudsMode.ToString().ToLower())</VudsMode>
    </Run>"
    $startRunMessage = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::POST, $startRunUrl)

    # Set the request body
    $startRunMessage.Content = [System.Net.Http.StringContent]::new($startRunBody, [System.Text.Encoding]::UTF8, "application/xml")

    # Specify Accept header to request JSON response
    $startRunMessage.Headers.Accept.Add("application/json")
    
    $responseToStartRunMessage = $httpClient.SendAsync($startRunMessage).Result
    if ($responseToStartRunMessage.IsSuccessStatusCode) {
        # Read the content of the response as a string
        $responseToStartRunMessageContent = $responseToStartRunMessage.Content.ReadAsStringAsync().Result

        # Convert the response content from JSON to an object
        $responseStartRun = ConvertFrom-Json $responseToStartRunMessageContent

        # Return the response content
        return $responseStartRun
    }
    else {
        # If the request was not successful, handle the error (for example, by throwing an exception)
        throw "Failed to create start run. Status code: $($responseToCreateTestInstanceMessage.StatusCode)"
    }
}

function LreTryStarRun() {
	###################### 3- find test instance ########################
	Write-Host ("")
	Write-Host ("********* finding existing test instance in LRE project ... *********")
	Write-Host ("")
	$lreTestInstance = LreGetCorrectTestInstanceID
	if($lreTestInstance) {
		$lreRun = LreStartRun
        if($lreRun)
        {
            Write-Host ("Run Id $($lreRun.ID) is in state $($lreRun.RunState)")
            if($($lreRun.ID) -gt 0) {
                return $true
            }
        }
	}
    return $false
}
#endregion


#region code flow
##################### 1 - authentication #######################
Write-Host ("")
Write-Host ("********* authenticating to LRE ... *********")
Write-Host ("")

# login
$responseAuth = LreLogin

# Check authentication response
if ($responseAuth.IsSuccessStatusCode) {
	$loggedIn = $true
    Write-Host "Authentication successful. Proceeding with stating run ..."
	$success = LreTryStarRun
} 
else {
    Write-Host "Authentication failed. Status code: $($responseAuth.StatusCode)"
}
if($loggedIn)
{
	# logout
    LreLogout
}
return $success

#endregion