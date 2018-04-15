using System;
using System.Text;
using System.Collections.Generic;
using PC.Plugins.Common.PCEntities;
using PC.Plugins.Common.Client;
using PC.Plugins.Common.Helper;
using PC.Plugins.Common.Constants;
using System.Net.Http;
using System.Net;
using System.Web;
using System.Collections.Specialized;
using System.IO;

namespace PC.Plugins.Common.Rest
{

    /// <summary>
    /// <summary>
    ///*
    /// 
    /// @author Daniel Danan
    /// 
    /// Class to be used for most common operations required in CI plugins
    /// </summary>
    public class PCRestProxy : IPCRestProxy
    {

        protected internal static readonly IList<int> _validStatusCodes = new List<int> { (int)HttpStatusCode.OK, (int)HttpStatusCode.Created, (int)HttpStatusCode.Accepted, (int)HttpStatusCode.NoContent };

        private string _webProtocol = "http";
        private string _pcServer;
        private string _domain;
        private string _project;
        private string _proxyOutURL = "";
        private string _proxyScheme = "";
        private string _proxyHostName = "";
        private int _proxyPort;
        private string _proxyUser = "";
        private string _proxyPassword = "";
        private string _encodedCredentials;

        private HttpClient _httpClient;
        //private HttpContext _context;
        private CookieContainer _cookieContainer = new CookieContainer();
        private WebProxy _proxy;
        private RestEntity _restEntity;
        private PCErrorResponse _pcErrorResponse = new PCErrorResponse("General error caused by the function \"{0}\" in PCRestProxy. Error: {1}", 99999);


        public string WebProtocol
        {
            get { return _webProtocol; }
            set { _webProtocol = value; }
        }
        public string PCServer
        {
            get { return _pcServer; }
            set { _pcServer = value; }
        }
        public string Domain
        {
            get { return _domain; }
            set { _domain = value; }
        }
        public string Project
        {
            get { return _project; }
            set { _project = value; }
        }
        public string ProxyOutURL
        {
            get { return _proxyOutURL; }
            set
            {
                _proxyOutURL = value;
                if(string.IsNullOrWhiteSpace(_proxyOutURL))
                    SetProxyDataFromURL(_proxyOutURL);
            }
        }
        //public string ProxyScheme
        //{
        //    get { return _proxyScheme; }
        //    set { _proxyScheme = value; }
        //}
        //public string ProxyHostName
        //{
        //    get { return _proxyHostName; }
        //    set { _proxyHostName = value; }
        //}
        //public int ProxyPort
        //{
        //    get { return _proxyPort; }
        //    set { _proxyPort = value; }
        //}
        public string ProxyUser
        {
            get { return _proxyUser; }
            set { _proxyUser = value; }
        }
        public string ProxyPassword
        {
            get { return _proxyPassword; }
            set { _proxyPassword = value; }
        }

        /// <summary>
        /// constructor defining the different parameters of a connection to PC
        /// </summary>
        /// <param name="webProtocolName">http or https</param>
        /// <param name="pcServerNameAndPort">PC Server name and port separated by colon character(:)</param>
        /// <param name="domain">Domain in ALM</param>
        /// <param name="project">ALM project</param>
        /// <param name="proxyOutURL">Proxy URL. e.g: http://<<<proxyserver>>>:<<<port_number>>>. Optional</param>
        /// <param name="proxyUser">proxy user. Optional</param>
        /// <param name="proxyPassword">proxy password Password. Optional</param>
        public PCRestProxy(string webProtocolName, string pcServerNameAndPort, string domain, string project, string proxyOutURL="", string proxyUser="", string proxyPassword="")
        {
            //logger = mainLogger;
            if(!string.IsNullOrWhiteSpace(webProtocolName))
                _webProtocol = webProtocolName;

            if (!string.IsNullOrWhiteSpace(pcServerNameAndPort))
                _pcServer = pcServerNameAndPort;

            if (!string.IsNullOrWhiteSpace(domain))
                _domain = domain;

            if (!string.IsNullOrWhiteSpace(project))
                _project = project;

            if (!string.IsNullOrWhiteSpace(proxyOutURL))
                _proxyOutURL = proxyOutURL;



            if (!string.ReferenceEquals(proxyOutURL, null) && proxyOutURL.Length > 0)
            {
                // Setting proxy
                // we should get the full proxy URL from the user: http(s)://<server>:<port>
                // PAC (proxy auto-config) or Automatic configuration script is not supported (for example our proxy: http://autocache.hpecorp.net/)
                SetProxyDataFromURL(_proxyOutURL);
                _proxyUser = proxyUser;
                _proxyPassword = proxyPassword;

                string proxyUri = string.Format("{0}:{1}", _proxyHostName, _proxyPort);

                NetworkCredential proxyCreds = new NetworkCredential(
                    proxyUser,
                    proxyPassword
                );

                string proxyAddress = proxyOutURL;

                _proxy = new WebProxy(proxyUri, false)
                {
                    Address = new Uri(proxyAddress),
                    UseDefaultCredentials = string.IsNullOrWhiteSpace(proxyUser),
                    Credentials = proxyCreds
                };

                HttpClientHandler httpClientHandler = new HttpClientHandler()
                {
                    Proxy = _proxy,
                    PreAuthenticate = true,
                    UseDefaultCredentials = false,
                    CookieContainer = _cookieContainer
                };

                _httpClient = new HttpClient(httpClientHandler);
            }
        }

        /// <summary>
        /// Authenticate to PC Server
        /// </summary>
        /// <param name="userName">PC username</param>
        /// <param name="password">PC Password</param>
        public virtual bool Authenticate(string userName, string password)
        {
            _encodedCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(userName + ":" + password));
            _restEntity = new RestEntity();
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.AUTHENTICATION_LOGIN_URL, true)
                .ContentType(RESTConstants.APPLICATION_XML)
                .Header("Authorization", string.Format("Basic {0}", _encodedCredentials))
                .Get();
            _cookieContainer.Add(clientResponse.Cookies);
            return Client.Utils.Validate(clientResponse, _validStatusCodes);
        }

        /// <summary>
        /// Authenticate to PC Server
        /// </summary>
        /// <param name="userName">PC username</param>
        /// <param name="password">PC Password</param>
        /// /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool Authenticate(string userName, string password, ref PCErrorResponse pcErrorResponse)
        {
            bool authenticated = false;
            try
            {
                _encodedCredentials = Convert.ToBase64String(Encoding.UTF8.GetBytes(userName + ":" + password));
                _restEntity = new RestEntity();
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.AUTHENTICATION_LOGIN_URL, true)
                    .ContentType(RESTConstants.APPLICATION_XML)
                    .Header("Authorization", string.Format("Basic {0}", _encodedCredentials))
                    .Get();
                if(clientResponse.Cookies!=null)
                    _cookieContainer.Add(clientResponse.Cookies);
                authenticated = Client.Utils.Validate(clientResponse, _validStatusCodes);
                if (authenticated == false)
                    if (clientResponse.Body != null)
                        try {
                            pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
                        }
                        catch
                        {
                            pcErrorResponse = new PCErrorResponse(clientResponse.Body, 9999899);
                        }
                    else
                        pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "Authenticate", String.Format("No response from the PC server. Verify that this PC URL {0}://{1}:{2}/LoadTest/ is indeed available", _webProtocol, _pcServer, _proxyPort > 0 ? _proxyPort.ToString() : _webProtocol.Equals("http") ? "80" : "433")), 999990);

            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse (string.Format(_pcErrorResponse.ExceptionMessage, "Authenticate", ex.Message), 999991);
            }
            return authenticated;
        }

        /// <summary>
        /// Get all TestSets (in PCTestSets object) in the ALM project
        /// </summary>
        public virtual PCTestSets GetAllTestSets()
        {
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.TEST_SETS_NAME)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCTestSets.XMLToObject(clientResponse.Body);
            }
            return null;
        }

        /// <summary>
        /// Get all TestSets (in PCTestSets object) in the ALM project
        /// </summary>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTestSets GetAllTestSets(ref PCErrorResponse pcErrorResponse)
        {
            PCTestSets pcTestSets = null;
            try
            {
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.TEST_SETS_NAME)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcTestSets = PCTestSets.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetAllTestSets", ex.Message), 999992);
            }
            return pcTestSets;
        }


        /// <summary>
        /// Get all test instances (in PCTestInstances object) of a specific Test
        /// </summary>
        /// <param name="testId">ID of the Test</param>
        public virtual PCTestInstances GetTestInstancesByTestId(int testId)
        {
            string testInstancesByTestIdQuery = string.Format("{0}?{1}={2}", PCConstants.TEST_INSTANCES_NAME, "query", "{test-id[" + testId + "]}");
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, testInstancesByTestIdQuery)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCTestInstances.XMLToObject(clientResponse.Body);
            }
            return null;
        }


        /// <summary>
        /// Get all test instances (in PCTestInstances object) of a specific Test
        /// </summary>
        /// <param name="testId">ID of the Test</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTestInstances GetTestInstancesByTestId(int testId, ref PCErrorResponse pcErrorResponse)
        {
            PCTestInstances pcTestInstances = null;
            try
            {
                string testInstancesByTestIdQuery = string.Format("{0}?{1}={2}", PCConstants.TEST_INSTANCES_NAME, "query", "{test-id[" + testId + "]}");
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, testInstancesByTestIdQuery)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                        pcTestInstances = PCTestInstances.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetTestInstancesByTestId", ex.Message), 999993);               
            }
            return pcTestInstances;
        }


        /// <summary>
        /// Get information (in GetRunData object) on specific Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        public virtual PCRunResponse GetRunData(int runId)
        {
            string runDataQuery = string.Format("{0}/{1}", PCConstants.RUNS_RESOURCE_NAME, runId);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, runDataQuery)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCRunResponse.XMLToObject(clientResponse.Body);
            }
            return null;
        }

        /// <summary>
        /// Get information (in GetRunData object) on specific Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCRunResponse GetRunData(int runId, ref PCErrorResponse pcErrorResponse)
        {
            PCRunResponse pcRunResponse = null;
            try
            { 
                string runDataQuery = string.Format("{0}/{1}", PCConstants.RUNS_RESOURCE_NAME, runId);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, runDataQuery)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcRunResponse = PCRunResponse.XMLToObject(clientResponse.Body);
                 else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetRunData", ex.Message), 999994);
            }
            return pcRunResponse;
        }


        /// <summary>
        /// Get information (in PCTest object) on specific test
        /// </summary>
        /// <param name="testId">ID of the Test</param>
        public virtual PCTest GetTestData(int testId)
        {
            string testDataQuery = string.Format("{0}/{1}", PCConstants.TESTS_RESOURCE_NAME, testId);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, testDataQuery)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCTest.XMLToObject(clientResponse.Body);
            }
            return null;
        }

        /// <summary>
        /// Get information (in PCTest object) on specific test
        /// </summary>
        /// <param name="testId">ID of the Test</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTest GetTestData(int testId, ref PCErrorResponse pcErrorResponse)
        {
            PCTest pcTest = null;
            try
            {
                string testDataQuery = string.Format("{0}/{1}", PCConstants.TESTS_RESOURCE_NAME, testId);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, testDataQuery)
                  .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                        pcTest = PCTest.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);                              
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetTestData", ex.Message), 999995);
            }
            return pcTest;
        }

        /// <summary>
        /// Get all Results (in PCRunResults object) of a specific Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        public virtual PCRunResults GetRunResults(int runId)
        {

            string getRunResultsUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.RESULTS_RESOURCE_NAME);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunResultsUrl)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCRunResults.XMLToObject(clientResponse.Body);
            }
            return null;
        }

        /// <summary>
        /// Get all Results (in PCRunResults object) of a specific Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCRunResults GetRunResults(int runId, ref PCErrorResponse pcErrorResponse)
        {
            PCRunResults pcRunResults = null;
            try
            {
                string getRunResultsUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.RESULTS_RESOURCE_NAME);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunResultsUrl)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcRunResults = PCRunResults.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetRunResults", ex.Message), 999996);
            }
            return pcRunResults;
        }

        /// <summary>
        /// To dowload a specific result of a specific Run to a file. Returns true if successful while the file is still being downloaded (important for big files)
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        /// <param name="resultId">Result ID to be downloaded</param>
        /// <param name="fullFileName">Fullfilename should contain both the Location where to download the file and the name to be given to the file</param>
        public virtual bool GetRunResultData(int runId, int resultId, string fullFileName)
        {
            string getRunResultDataUrl = string.Format("{0}/{1}/{2}/{3}/data", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.RESULTS_RESOURCE_NAME, resultId);
            GeneralHelper.CreateDirectoryForFileIfNotExisting(fullFileName);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunResultDataUrl)
                .GetFile(fullFileName);
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return true;
            }
            return false;
        }


        /// <summary>
        /// To dowload a specific result of a specific Run to a file. Returns true if successful while the file is still being downloaded (important for big files)
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        /// <param name="resultId">Result ID to be downloaded</param>
        /// <param name="fullFileName">Fullfilename should contain both the Location where to download the file and the name to be given to the file</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool GetRunResultData(int runId, int resultId, string fullFileName, ref PCErrorResponse pcErrorResponse)
        {
            bool getRunResultData = false;
            try
            {
                string getRunResultDataUrl = string.Format("{0}/{1}/{2}/{3}/data", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.RESULTS_RESOURCE_NAME, resultId);
                GeneralHelper.CreateDirectoryForFileIfNotExisting(fullFileName);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunResultDataUrl)
                    .GetFile(fullFileName);
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    getRunResultData = true;
                else
                 pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetRunResultData", ex.Message), 999997);
            }
            return getRunResultData;
        }

        /// <summary>
        /// Get the event logs of a Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        public virtual PCRunEventLog GetRunEventLog(int runId)
        {
            string getRunEventLogUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.EVENTLOG_RESOURCE_NAME);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunEventLogUrl)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                return PCRunEventLog.XMLToObject(clientResponse.Body);
            return null;
        }

        /// <summary>
        /// Get the event logs of a Run
        /// </summary>
        /// <param name="runId">ID of the Run</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCRunEventLog GetRunEventLog(int runId, ref PCErrorResponse pcErrorResponse)
        {
            PCRunEventLog pcRunEventLog = null;
            try
            {
                string getRunEventLogUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, PCConstants.EVENTLOG_RESOURCE_NAME);

                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getRunEventLogUrl)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcRunEventLog = PCRunEventLog.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetRunEventLog", ex.Message), 999998);
            }
            return pcRunEventLog;
        }


        /// <summary>
        /// Logout
        /// </summary>
        public virtual bool Logout()
        {
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.AUTHENTICATION_LOGOUT_URL, true)
                .Get();
            return Client.Utils.Validate(clientResponse, _validStatusCodes);
        }


        /// <summary>
        /// Logout
        /// </summary>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool Logout(ref PCErrorResponse pcErrorResponse)
        {
            bool logout = false;
            try
            {
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, PCConstants.AUTHENTICATION_LOGOUT_URL, true)
                    .Get();
                logout = Client.Utils.Validate(clientResponse, _validStatusCodes);
                if (logout == false)
                {
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
                }
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "Logout", ex.Message), 999999);
            }
            return logout;
        }

        /// <summary>
        /// Stops a Run
        /// </summary>
        /// <param name="runId">ID of the Run to be stopped</param>
        /// <param name="stopMode">How to stop the Run. Value could be "stop" (default), "stopNow", or "abort". Optional </param>
        /// <param name="releaseTimeslot">Define if the timeslot should be released. Default is true. Optional</param>
        /// <param name="postRunAction">What to do with colate once the Run is stopped. Value could be (case sensitive): "Do Not Collate" (default), "Collate And Analyze", "Collate Results". Optional </param>
        public virtual bool StopRun(int runId, string stopMode="stop", bool releaseTimeslot = true, string postRunAction = "Do Not Collate")
        {
            string stopUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, stopMode);

            //define postactions to stop the run

            //Using DoNotCollate if not provided collateAction is wrong
            string verifiedCollateAction = postRunAction;
            try
            {
                PCConstants.PostRunActionValue enumValue = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(verifiedCollateAction);
            }
            catch
            {
                verifiedCollateAction = EnumerationHelper.GetEnumDescription((PCConstants.PostRunActionValue)PCConstants.PostRunActionValue.DoNotCollate);
            }
            
            PCPostRunActionsRequest postRunActionsRequest = new PCPostRunActionsRequest(releaseTimeslot, postRunAction);
            string xmlpostRunActionsRequest = postRunActionsRequest.ObjectToXml();

            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, stopUrl)
                .Body(xmlpostRunActionsRequest)
                .Post();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return true;
            }
            return false;
        }

        /// <summary>
        /// Stops a Run
        /// </summary>
        /// <param name="runId">ID of the Run to be stopped</param>
        /// <param name="stopMode">How to stop the Run. Value could be "stop" (default), "stopNow", or "abort". Optional </param>
        /// <param name="releaseTimeslot">Define if the timeslot should be released. Default is true. Optional</param>
        /// <param name="postRunAction">What to do with colate once the Run is stopped. Value could be (case sensitive): "Do Not Collate" (default), "Collate And Analyze", "Collate Results". Optional </param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool StopRun(int runId, ref PCErrorResponse pcErrorResponse, string stopMode = "stop", bool releaseTimeslot = true, string postRunAction = "Do Not Collate")
        {
            bool StopRun = false;
            try
            {
                string stopUrl = string.Format("{0}/{1}/{2}", PCConstants.RUNS_RESOURCE_NAME, runId, stopMode);

                //define postactions to stop the run

                //Using DoNotCollate if not provided collateAction is wrong
                string verifiedCollateAction = postRunAction;
                try
                {
                    PCConstants.PostRunActionValue enumValue = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(verifiedCollateAction);
                }
                catch
                {
                    verifiedCollateAction = EnumerationHelper.GetEnumDescription((PCConstants.PostRunActionValue)PCConstants.PostRunActionValue.DoNotCollate);
                }

                PCPostRunActionsRequest postRunActionsRequest = new PCPostRunActionsRequest(releaseTimeslot, postRunAction);
                string xmlpostRunActionsRequest = postRunActionsRequest.ObjectToXml();

                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, stopUrl)
                    .Body(xmlpostRunActionsRequest)
                    .Post();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    StopRun = true;
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "StopRun", ex.Message), 1000000);
            }
            return StopRun;
        }


        /// <summary>
        /// Create a new test instance of a test into a testset
        /// </summary>
        /// <param name="testId">ID of the test</param>
        /// <param name="testSetId">ID of the testset</param>
        public virtual int CreateTestInstance(int testId, int testSetId)
        {
            string createTestInstanceUrl = PCConstants.TEST_INSTANCES_NAME;
            string body = "<TestInstance xmlns = \"" + PCConstants.PC_API_XMLNS + "\"><TestID>" + testId +
                "</TestID><TestSetID>" + testSetId + "</TestSetID></TestInstance>";
            PCTestInstanceRequest testInstanceRequest = new PCTestInstanceRequest(testId, testSetId);
            string xmlTestInstanceRequest = testInstanceRequest.ObjectToXml();

            var response = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, createTestInstanceUrl)
               .Body(xmlTestInstanceRequest)
               .Post();
            if (Client.Utils.Validate(response, _validStatusCodes))
            {
                PCTestInstanceResponse testInstanceResponse = PCTestInstanceResponse.XMLToObject(response.Body);
                return testInstanceResponse.TestInstanceID;

            }
            return 0;
        }

        /// <summary>
        /// Create a new test instance of a test into a testset
        /// </summary>
        /// <param name="testId">ID of the test</param>
        /// <param name="testSetId">ID of the testset</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual int CreateTestInstance(int testId, int testSetId, ref PCErrorResponse pcErrorResponse)
        {
            int createTestInstance = 0;
            try
            {
                string createTestInstanceUrl = PCConstants.TEST_INSTANCES_NAME;
                string body = "<TestInstance xmlns = \"" + PCConstants.PC_API_XMLNS + "\"><TestID>" + testId +
                    "</TestID><TestSetID>" + testSetId + "</TestSetID></TestInstance>";
                PCTestInstanceRequest testInstanceRequest = new PCTestInstanceRequest(testId, testSetId);
                string xmlTestInstanceRequest = testInstanceRequest.ObjectToXml();
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, createTestInstanceUrl)
                   .Body(xmlTestInstanceRequest)
                   .Post();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                { 
                    PCTestInstanceResponse testInstanceResponse = PCTestInstanceResponse.XMLToObject(clientResponse.Body);
                    createTestInstance = testInstanceResponse.TestInstanceID;
                }
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "CreateTestInstance", ex.Message), 1000001);
            }
            return createTestInstance;
        }


        /// <summary>
        /// download a TrendReport to PDF file 
        /// </summary>
        /// <param name="trendReportId">ID of the trendReport to download. Returns true if successful while the file is still being downloaded (important for big files)</param>
        /// <param name="fullFileName">Fullfilename should contain both the Location where to download the file and the name to be given to the file</param>
        public virtual bool GetTrendingPDF(int trendReportId, string fullFileName)
        {
            GeneralHelper.CreateDirectoryForFileIfNotExisting(fullFileName);
            string getTrendReportUrl = string.Format("{0}/{1}/{2}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId, PCConstants.TREND_REPORT_RESOURCE_SUFFIX);

            var response = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportUrl)
                .GetFile(fullFileName);
            if (Client.Utils.Validate(response, _validStatusCodes))
            {
                return true;
            }
            return false;
        }

        /// <summary>
        /// download a TrendReport to PDF file 
        /// </summary>
        /// <param name="trendReportId">ID of the trendReport to download. Returns true if successful while the file is still being downloaded (important for big files)</param>
        /// <param name="fullFileName">Fullfilename should contain both the Location where to download the file and the name to be given to the file</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool GetTrendingPDF(int trendReportId, string fullFileName, ref PCErrorResponse pcErrorResponse)
        {
            bool getTrendingPDF= false;
            try
            {
                GeneralHelper.CreateDirectoryForFileIfNotExisting(fullFileName);
                string getTrendReportUrl = string.Format("{0}/{1}/{2}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId, PCConstants.TREND_REPORT_RESOURCE_SUFFIX);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportUrl)
                    .GetFile(fullFileName);
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    getTrendingPDF = true;
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetTrendingPDF", ex.Message), 1000002);
            }
            return getTrendingPDF;
        }


        /// <summary>
        /// Start executing a specific test and return PCRunResponse object
        /// </summary>
        /// <param name="testId">ID of the test</param>
        /// <param name="testInstanceId">ID of the test instance</param>
        /// <param name="timeslotDuration">For how long the timeslot should be reserved (TimeslotDuration object)</param>
        /// <param name="postRunAction">Actions to be done once the run is finished. Value could be (case sensitive): "Do Not Collate" (default), "Collate And Analyze", "Collate Results". Optional </param>
        /// <param name="vudsMode">Should the test be execuited with vuds. boo (false is default). Optional. </param>
        public virtual PCRunResponse StartRun(int testId, int testInstanceId, PCTimeslotDuration timeslotDuration, string postRunAction = "Collate And Analyze", bool vudsMode = false)
        {
            string startRunURL = PCConstants.RUNS_RESOURCE_NAME;
            PCRunRequest pcRunRequest = new PCRunRequest(testId, testInstanceId, timeslotDuration, postRunAction, vudsMode);

            //Using CollateAndAnalyze if provided collateAction is wrong
            string verifiedCollateAction = postRunAction;
            try
            {
                PCConstants.PostRunActionValue enumValue = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(verifiedCollateAction);
            }
            catch
            {
                verifiedCollateAction = EnumerationHelper.GetEnumDescription((PCConstants.PostRunActionValue)PCConstants.PostRunActionValue.CollateAndAnalyze);
            }

            string xmlPCRunRequest = pcRunRequest.ObjectToXml();


            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, startRunURL)
               .Body(xmlPCRunRequest)
               .Post();

            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                PCRunResponse pcRunResponse = PCRunResponse.XMLToObject(clientResponse.Body);
                return pcRunResponse;
            }
            return null;
        }

        /// <summary>
        /// Start executing a specific test and return PCRunResponse object
        /// </summary>
        /// <param name="testId">ID of the test</param>
        /// <param name="testInstanceId">ID of the test instance</param>
        /// <param name="timeslotDuration">For how long the timeslot should be reserved (TimeslotDuration object)</param>
        /// <param name="postRunAction">Actions to be done once the run is finished. Value could be (case sensitive): "Do Not Collate" (default), "Collate And Analyze", "Collate Results". Optional </param>
        /// <param name="vudsMode">Should the test be execuited with vuds. boo (false is default). Optional. </param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCRunResponse StartRun(int testId, int testInstanceId, PCTimeslotDuration timeslotDuration, ref PCErrorResponse pcErrorResponse, string postRunAction = "Collate And Analyze", bool vudsMode = false)
        {
            PCRunResponse pcRunResponse = null;
            try
            {
                string startRunURL = PCConstants.RUNS_RESOURCE_NAME;
                PCRunRequest pcRunRequest = new PCRunRequest(testId, testInstanceId, timeslotDuration, postRunAction, vudsMode);

                //Using CollateAndAnalyze if provided collateAction is wrong
                string verifiedCollateAction = postRunAction;
                try
                {
                    PCConstants.PostRunActionValue enumValue = EnumerationHelper.GetEnumFromDescription<PCConstants.PostRunActionValue>(verifiedCollateAction);
                }
                catch
                {
                    verifiedCollateAction = EnumerationHelper.GetEnumDescription((PCConstants.PostRunActionValue)PCConstants.PostRunActionValue.CollateAndAnalyze);
                }

                string xmlPCRunRequest = pcRunRequest.ObjectToXml();


                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, startRunURL)
                   .Body(xmlPCRunRequest)
                   .Post();

                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcRunResponse = PCRunResponse.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "StartRun", ex.Message), 1000003);
            }
            return pcRunResponse;
        }


        /// <summary>
        /// Get a Trend report in XML
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        /// <param name="runId">ID of the Run</param>
        public virtual PCTrendReportRoot GetTrendReport(int trendReportId, int runId)
        {
            string getTrendReportByXMLUrl = string.Format("{0}/{1}/{2}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId, runId);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportByXMLUrl)
                .Get();

            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                PCTrendReportRoot trendReportRoot = PCTrendReportRoot.XMLToObject(clientResponse.Body);
                return trendReportRoot;
            }
            return null;
        }

        /// <summary>
        /// Get a Trend report in XML
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        /// <param name="runId">ID of the Run</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTrendReportRoot GetTrendReport(int trendReportId, int runId, ref PCErrorResponse pcErrorResponse)
        {
            PCTrendReportRoot pcTrendReportRoot = null;
            try
            {
                string getTrendReportByXMLUrl = string.Format("{0}/{1}/{2}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId, runId);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportByXMLUrl)
                    .Get();

                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcTrendReportRoot = PCTrendReportRoot.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetTrendReport", ex.Message), 1000004);
            }
            return pcTrendReportRoot;
        }


        /// <summary>
        /// Get a Trend report in XML
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        /// <param name="runId">ID of the Run</param>
        public virtual PCTrendReports GetAllTrendReports()
        {
            string getTrendReportByXMLUrl = string.Format("{0}", PCConstants.TREND_REPORT_RESOURCE_NAME);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportByXMLUrl)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return PCTrendReports.XMLToObject(clientResponse.Body);
            }
            return null;
        }

        /// <summary>
        /// Get a Trend report in XML
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        /// <param name="runId">ID of the Run</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTrendReports GetAllTrendReports(ref PCErrorResponse pcErrorResponse)
        {
            PCTrendReports pcTrendReports = null;
            try
            {
                string getTrendReportByXMLUrl = string.Format("{0}", PCConstants.TREND_REPORT_RESOURCE_NAME);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportByXMLUrl)
                    .Get();

                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcTrendReports = PCTrendReports.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetAllTrendReports", ex.Message), 1000005);
            }
            return pcTrendReports;
        }

        /// <summary>
        /// Update Trend report
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        public virtual PCTrendReport GetTrendReportMetaData(string trendReportId)
        {
            string getTrendReportMetaDataUrl = string.Format("{0}/{1}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId);
            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportMetaDataUrl)
                .Get();
            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                PCTrendReport pcTrendReport = PCTrendReport.XMLToObject(clientResponse.Body);
                return pcTrendReport;
            }
            return null;
        }

        /// <summary>
        /// Update Trend report
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual PCTrendReport GetTrendReportMetaData(string trendReportId, ref PCErrorResponse pcErrorResponse)
        {
            PCTrendReport pcTrendReport = null;
            try
            {
                string getTrendReportMetaDataUrl = string.Format("{0}/{1}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId);
                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, getTrendReportMetaDataUrl)
                    .Get();
                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    pcTrendReport = PCTrendReport.XMLToObject(clientResponse.Body);
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "GetTrendReportMetaData", ex.Message), 1000006);
            }
            return pcTrendReport;
        }

        #region local helper

        /// <summary>
        /// extract information from proxyURL
        /// </summary>
        /// <param name="fullFileName">full path + name of the file</param>
        private void SetProxyDataFromURL(string proxyURL)
        {
            try
            {
                string mainStr = "";
                if (!string.ReferenceEquals(proxyURL, null) && proxyURL.Length > 0)
                {
                    string[] urlSplit = proxyURL.Split("://", true);

                    _proxyScheme = urlSplit[0];
                    mainStr = urlSplit[1];
                    if (mainStr.Contains(":"))
                    {
                        _proxyHostName = mainStr.Split(":", true)[0];
                        _proxyPort = int.Parse(mainStr.Split(":", true)[1]);
                    }
                    else
                    {
                        _proxyHostName = mainStr;
                        _proxyPort = 80;
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Error: Validating Proxy URL: " + ex + " Please add a proxy URL in this pattern: http(s)://<host>:<port> or leave blank");
            }
        }

        #endregion

        #region notdone
        //*************************************************************************************************************************
        //*************************************************************************************************************************
        //*********************************************not working, not needed for now*********************************************
        //*************************************************************************************************************************
        //*************************************************************************************************************************
        /// <summary>
        /// Update Trend report
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report to be update</param>
        /// <param name="trendReportRequest">request transfered via TrendReportRequest object</param>
        public virtual bool UpdateTrendReport(string trendReportId, PCTrendReportRequest trendReportRequest)
        {
            string updateTrendReportUrl = string.Format("{0}/{1}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId);

            ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, updateTrendReportUrl)
              .Body(trendReportRequest.ObjectToXml())
              .Post();

            if (Client.Utils.Validate(clientResponse, _validStatusCodes))
            {
                return true;
            }
            return false;
        }


        /// <summary>
        /// Update Trend report
        /// </summary>
        /// <param name="trendReportId">ID of the Trend report to be update</param>
        /// <param name="trendReportRequest">request transfered via TrendReportRequest object</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public virtual bool UpdateTrendReport(string trendReportId, PCTrendReportRequest trendReportRequest, ref PCErrorResponse pcErrorResponse)
        {
            bool updateTrendReport = false;
            try
            {

                string updateTrendReportUrl = string.Format("{0}/{1}", PCConstants.TREND_REPORT_RESOURCE_NAME, trendReportId);

                ClientResponse clientResponse = _restEntity.PCClientRequest(_webProtocol, _pcServer, _proxyHostName, _proxyPort.ToString(), _proxyUser, _proxyPassword, _domain, _project, updateTrendReportUrl)
                  .Body(trendReportRequest.ObjectToXml())
                  .Post();

                if (Client.Utils.Validate(clientResponse, _validStatusCodes))
                    updateTrendReport = true;
                else
                    pcErrorResponse = PCErrorResponse.XMLToObject(clientResponse.Body);
            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "UpdateTrendReport", ex.Message), 1000007);
            }
            return updateTrendReport;
        }

        /// <summary>
        /// Upload VuGen Script
        /// </summary>
        /// <param name="pcScript">PCScript object</param>
        /// <param name="fullFileName">Full File Name of the VuGen script</param>
        public int UploadVugenScript(PCScript pcScript, string fullFileName)
        {
            string pcScriptXml = pcScript.ObjectToXml();
            //to be implemented

            return 0;
        }

        /// <summary>
        /// Upload VuGen Script
        /// </summary>
        /// <param name="pcScript">PCScript object</param>
        /// <param name="fullFileName">Full File Name of the VuGen script</param>
        /// <param name="pcErrorResponse">reference to PCErrorResponse object</param>
        public int UploadVugenScript(PCScript pcScript, string fullFileName, ref PCErrorResponse pcErrorResponse)
        {
            int uploadVugenScript = 0;
            try
            {
                string pcScriptXml = pcScript.ObjectToXml();
                //to be implemented

            }
            catch (Exception ex)
            {
                pcErrorResponse = new PCErrorResponse(string.Format(_pcErrorResponse.ExceptionMessage, "UploadVugenScript", ex.Message), 1000008);
            }
            return uploadVugenScript;
        }
        #endregion

     

    }

}