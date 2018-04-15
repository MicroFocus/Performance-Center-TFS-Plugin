using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PC.Plugins.Common.Rest;
using PC.Plugins.Common.PCEntities;
using PC.Plugins.Common.Constants;
using PC.Plugins.Common.Helper;
using System.IO.Compression;
using System.Runtime.InteropServices;

namespace PC.Plugins.Automation
{
    //[ComVisible(true)]
    class PCClient : IPCClient
    {
        private const string END_OF_LOG_FILE = "Test Execution Ended";
        private int _maxUnlockWait = 200;
        private int _waitInterval = 1000; // milliseconds
        private IPCModel _pcModel = new PCModel();
        private IPCRestProxy _pcRestProxy;
        private bool _loggedIn;
        //private PrintStream logger;
        private FileLog _fileLog;
        private string _workDirectory = @"C:\Temp\PC.Plugins.Automation.Logs\{0}";
        private string _logFileName = @"PC.Plugins.Automation.Logs.log";
        private string _logFullFileName;
        
        public string LogFullFileName => _logFullFileName;

        /// <summary>
        /// constructor defining the different parameters of PCClient
        /// </summary>
        /// <param name="pcModel">IPCModel object</param>
        /// <param name="fileLog">FileLog object already defined</param>
        /// <param name="maxUnlockWait">How long to wait for the reports.zip file to be downloaded (in secondfs). Optional (default 200 seconds)</param>
        public PCClient(IPCModel pcModel, FileLog fileLog, int maxUnlockWait = 200)
        {
            try
            {
                //defining log file
                if (fileLog == null)
                {
                    Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
                    _logFullFileName = Path.Combine(string.Format(_workDirectory, unixTimestamp.ToString()), _logFileName);
                    _fileLog = new FileLog(_logFullFileName);
                }
                else
                {
                    _fileLog = fileLog;
                }

                if (_maxUnlockWait < maxUnlockWait)
                    _maxUnlockWait = maxUnlockWait;

                _fileLog.Write(LogMessageType.Debug, String.Format("PC.Plugins.Automation PCModel has started\n"));

                _pcModel = pcModel;

                if (!string.IsNullOrEmpty(_pcModel.ProxyOutURL))
                {
                    fileLog.Write(LogMessageType.Info, "Using proxy: " + _pcModel.ProxyOutURL);
                }
                _pcRestProxy = new PCRestProxy(_pcModel.isHTTPSProtocol(), _pcModel.PCServerName, _pcModel.Domain, _pcModel.Project, _pcModel.ProxyOutURL, _pcModel.ProxyOutUser, _pcModel.ProxyOutPassword);
                
            }
            catch (Exception e)
            {
                fileLog.Write(LogMessageType.Error, e.Message);
            }

        }

        public bool Login()
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                _fileLog.Write(LogMessageType.Info, string.Format("Trying to login: [PCServer: '{0}://{1}', User: '{2}']", _pcModel.isHTTPSProtocol(), _pcModel.PCServerName, _pcModel.UserName));
                _loggedIn = _pcRestProxy.Authenticate(_pcModel.UserName, _pcModel.Password, ref pcErrorResponse);
            }
            catch (Exception e)
            {
                _fileLog.Write(LogMessageType.Error, "Error: " + e.Message);
                if (pcErrorResponse.ErrorCode > 0)
                    _fileLog.Write(LogMessageType.Error, "\n ExceptionMessage: " + pcErrorResponse.ExceptionMessage + "\n ErrorCode: " + pcErrorResponse.ErrorCode.ToString());
            }
            if(!_loggedIn && pcErrorResponse.ErrorCode > 0)
                _fileLog.Write(LogMessageType.Info, "\n ExceptionMessage: " + pcErrorResponse.ExceptionMessage + "\n ErrorCode: " + pcErrorResponse.ErrorCode.ToString());
            _fileLog.Write(LogMessageType.Info, string.Format("Login {0}", _loggedIn ? "succeeded\n" : "failed\n"));
            return _loggedIn;
        }

        public bool IsLoggedIn() => _loggedIn;

        public int StartRun() {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                int testID = int.Parse(_pcModel.TestId);
                int testInstance = GetCorrectTestInstanceID(testID);
                SetCorrectTrendReportID();

                string msg = string.Format("Executing Load Test:\n====================\nTest ID: {0} \nTest Instance ID: {1} \nTimeslot Duration: {2} \nPost Run Action: {3} \nUse VUDS: {4}\n====================\n", 
                    int.Parse(_pcModel.TestId), testInstance, _pcModel.PCTimeslotDuration, _pcModel.PCPostRunActionsRequest.PostRunAction, _pcModel.isVudsMode());
                _fileLog.Write(LogMessageType.Info, msg);

                PCRunResponse response = _pcRestProxy.StartRun(testID,
                        testInstance,
                        _pcModel.PCTimeslotDuration,
                        ref pcErrorResponse,
                        _pcModel.PCPostRunActionsRequest.PostRunAction,
                        _pcModel.isVudsMode());
                if (response == null && pcErrorResponse != null)
                {
                    _fileLog.Write(LogMessageType.Info, string.Format("{0}, Error Code: {1}",
                        pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                    return 0;
                }
                _fileLog.Write(LogMessageType.Info, string.Format("Run started (TestID: {0}, RunID: {1}, TimeslotID: {2})\n",
                        response.TestID, response.ID, response.TimeslotID));
                if (response.ID>0)
                    return response.ID;                    
            }
            catch (Exception ex)
            {
                if (!_loggedIn && pcErrorResponse.ErrorCode > 0)
                    _fileLog.Write(LogMessageType.Error, "\n ExceptionMessage: " + pcErrorResponse.ExceptionMessage + "\n ErrorCode: " + pcErrorResponse.ErrorCode.ToString());
                _fileLog.Write(LogMessageType.Error, ex.Message);
            }
            return 0;
        }

        private int GetCorrectTestInstanceID(int testID) {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            if (_pcModel.AutoTestInstance){
                try {
                    _fileLog.Write(LogMessageType.Info, "Searching for available Test Instance");
                    PCTestInstances pcTestInstances = _pcRestProxy.GetTestInstancesByTestId(testID, ref pcErrorResponse);
                    int testInstanceID = 0;
                    if (pcTestInstances != null && pcTestInstances.TestInstancesList != null && pcTestInstances.TestInstancesList.Count>0)
                    {
                        PCTestInstance pcTestInstance = pcTestInstances.TestInstancesList[pcTestInstances.TestInstancesList.Count - 1];
                        testInstanceID = pcTestInstance.TestInstanceID;
                        _fileLog.Write(LogMessageType.Info, "Found test instance ID: " + testInstanceID + "\n");
                    }
                    else
                    {
                        _fileLog.Write(LogMessageType.Info, "Could not find available TestInstanceID, Creating Test Instance.");
                        _fileLog.Write(LogMessageType.Info, "Searching for available TestSet");
                        // Get a random TestSet
                        PCTestSets pcTestSets = _pcRestProxy.GetAllTestSets(ref pcErrorResponse);
                        if (pcTestSets !=null && pcTestSets.PCTestSetsList !=null)
                        {
                            PCTestSet pcTestSet = pcTestSets.PCTestSetsList[pcTestSets.PCTestSetsList.Count - 1];
                            int testSetID = pcTestSet.TestSetID;
                            _fileLog.Write(LogMessageType.Info, string.Format("Creating Test Instance with testID: {0} and TestSetID: {1}", testID, testSetID));
                            testInstanceID = _pcRestProxy.CreateTestInstance(testID, testSetID, ref pcErrorResponse);
                            _fileLog.Write(LogMessageType.Info, string.Format("Test Instance with ID : {0} has been created successfully.", testInstanceID));
                        }
                        else
                        {
                            string msg = "No TestSetID available in project, please create a testset from Performance Center UI";
                            _fileLog.Write(LogMessageType.Info, msg);

                        }
                    }
                    return testInstanceID;
                }
                catch (Exception ex)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("getCorrectTestInstanceID failed, reason: {0}",ex));
                    if (pcErrorResponse.ErrorCode > 0)
                    {
                        _fileLog.Write(LogMessageType.Error, string.Format("getCorrectTestInstanceID failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                    }
                    return int.Parse(null);
                }
            }
            return int.Parse(_pcModel.TestInstanceId);
        }


        private void SetCorrectTrendReportID()
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                // If the user selected "Use trend report associated with the test" we want the report ID to be the one from the test
                string msg = "No trend report ID is associated with the test.\n" +
                    "Please turn Automatic Trending on for the test through Performance Center UI.\n" +
                    "Alternatively you can check 'Add run to trend report with ID' on Jenkins job configuration.";
                if (_pcModel.AddRunToTrendReport.Equals("AssociatedTrend"))
                {
                    PCTest pcTest = _pcRestProxy.GetTestData(int.Parse(_pcModel.TestId), ref pcErrorResponse);
                    if (pcTest.ReportId > -1)
                        _pcModel.TrendReportId = pcTest.ReportId.ToString();
                    else
                    {
                        _fileLog.Write(LogMessageType.Error, string.Format("SetCorrectTrendReportID failed, reason: {0}", msg));
                        //throw new PcException(msg);
                    }
                }
            }
            catch (Exception ex)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("SetCorrectTrendReportID failed, reason: {0}", ex));
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("SetCorrectTrendReportID failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
        }


        public string GetTestName()
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                PCTest pcTest = _pcRestProxy.GetTestData(int.Parse(_pcModel.TestId), ref pcErrorResponse);
                return pcTest.Name;
            }
            catch(Exception e)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("getTestName failed, reason: {0}", e.Message));
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("GetTestName failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
                return "";
            }

        }

        public PCRunResponse WaitForRunCompletion(int runId)  {
            try
            {
                return WaitForRunCompletion(runId, 5000);
            }
            catch (Exception ex)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("waitForRunCompletion failed, reason: {0}", ex.Message));
                return null;
            }
        }

        public PCRunResponse WaitForRunCompletion(int runId, int interval)
        {
            PCRunState state = PCRunState.UNDEFINED;
            switch (_pcModel.PCPostRunActionsRequest.PostRunAction) {
                case PCConstants.DONOTCOLLATE:
                    state = PCRunState.BEFORE_COLLATING_RESULTS;
                    break;
                case PCConstants.COLLATERESULTS:
                    state = PCRunState.BEFORE_CREATING_ANALYSIS_DATA;
                    break;
                case PCConstants.COLLATEANDANALYZE:
                    state = PCRunState.FINISHED;
                    break;
            }
            return WaitForRunState(runId, state, interval);
        }


        private PCRunResponse WaitForRunState(int runId, PCRunState completionState, int interval)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                int counter = 0;
                PCRunState[] states = { PCRunState.BEFORE_COLLATING_RESULTS, PCRunState.BEFORE_CREATING_ANALYSIS_DATA };
                PCRunResponse response = null;
                PCRunState lastState = PCRunState.UNDEFINED;
                do {
                    response = _pcRestProxy.GetRunData(runId, ref pcErrorResponse);
                    PCRunState currentState = PCRunState.get(response.RunState);
                    if (lastState.ordinal() < currentState.ordinal())
                    {
                        lastState = currentState;
                        _fileLog.Write(LogMessageType.Info, string.Format("RunID: {0} - State = {1}\n", runId, currentState.Value));
                    }

                    // In case we are in state before collate or before analyze, we will wait 1 minute for the state to change otherwise we exit
                    // because the user probably stopped the run from PC or timeslot has reached the end.
                    if (states.Contains(currentState))
                    {
                        counter++;
                        System.Threading.Thread.Sleep(1000);
                        if (counter > 60) {
                            _fileLog.Write(LogMessageType.Info, string.Format("RunID: {0}  - Stopped from Performance Center side with state = {1}", runId, currentState.Value));
                            break;
                        }
                    }
                    else
                    {
                        counter = 0;
                        System.Threading.Thread.Sleep(interval);

                    }
                }
                while (lastState.ordinal() < completionState.ordinal());
                return response;
            }
            catch (Exception ex)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("WaitForRunState failed, reason: {0}", ex.Message));
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("WaitForRunState failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
                return null;
            }
        }


        public string PublishRunReport(int runId, string reportDirectory)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                PCRunResults runResultsList = _pcRestProxy.GetRunResults(runId, ref pcErrorResponse);
                if (runResultsList.ResultsList != null)
                {
                    foreach (PCRunResult result in runResultsList.ResultsList)
                    {
                        if (result.Name.Equals(PCBuilder.PC_REPORT_ARCHIVE_NAME))
                        {
                            string reportArchiveFullPath = Path.Combine(reportDirectory, PCBuilder.PC_REPORT_ARCHIVE_NAME);
                            _fileLog.Write(LogMessageType.Info, "Publishing analysis report:");
                            bool downloadSucceeded = _pcRestProxy.GetRunResultData(runId, result.ID, reportArchiveFullPath, ref pcErrorResponse);
                            if (downloadSucceeded && File.Exists(reportArchiveFullPath))
                            {
                                _fileLog.Write(LogMessageType.Info, "Result file downloaded successfully to: " + reportArchiveFullPath);
                                string extractedReportDirectory = reportDirectory;
                                if(!Directory.Exists(extractedReportDirectory))
                                    Directory.CreateDirectory(extractedReportDirectory);
                                if (Directory.Exists(reportDirectory))
                                {
                                    WaitForUnlockedFile(reportArchiveFullPath);
                                    ZipFile.ExtractToDirectory(reportArchiveFullPath, extractedReportDirectory);
                                }
                                else
                                    _fileLog.Write(LogMessageType.Info, "Failed to create directory for extracting the report");

                                string reportFile = Path.Combine(extractedReportDirectory, PCBuilder.PC_REPORT_FILENAME);
                                if (File.Exists(reportFile))
                                {
                                    _fileLog.Write(LogMessageType.Info, "Report file extracted and available from: " + reportFile + "\n");
                                    return reportFile;
                                }
                                else
                                    _fileLog.Write(LogMessageType.Info, "Failed to extract report\n");
                            }
                            else
                                _fileLog.Write(LogMessageType.Info, "Failed to download\\create report\n");
                        }
                    }
                }
                _fileLog.Write(LogMessageType.Info, "Failed to get run report\n");
            }
            catch (Exception ex)
            {
                _fileLog.Write(LogMessageType.Error, "failed to get run report\n" + ex.Message);
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("PublishRunReport failed, ExceptionMessage: {0}, ErrorCode: {1}\n", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
            return "";
        }

        public bool Logout()
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            bool logoutSucceeded = false;
            try
            {
                if (!_loggedIn)
                    return true;               
                try
                {
                    logoutSucceeded = _pcRestProxy.Logout(ref pcErrorResponse);
                    _loggedIn = !logoutSucceeded;
                }
                catch (Exception e)
                {
                    _fileLog.Write(LogMessageType.Error, e.Message);
                }
                _fileLog.Write(LogMessageType.Info, string.Format("Logout {0}", logoutSucceeded ? "succeeded\n" : "failed\n"));
            }
            catch (Exception ex)
            {
                _fileLog.Write(LogMessageType.Error, "failed to Logout. " + ex.Message);
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("Logout failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
            return logoutSucceeded;
        }


        public bool StopRun(int runId)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            bool stopRunSucceeded = false;
            try
            {
                _fileLog.Write(LogMessageType.Info, "Stopping run");
                stopRunSucceeded = _pcRestProxy.StopRun(runId, ref pcErrorResponse, "stop");
            }

            catch (Exception e)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("StopRun failed. Error: " +  e.Message));
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("StopRun failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
            _fileLog.Write(LogMessageType.Info, string.Format("Stop run {0}", stopRunSucceeded ? "succeeded" : "failed"));
            if (!stopRunSucceeded && pcErrorResponse.ErrorCode > 0)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("StopRun failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
            }
            return stopRunSucceeded;
        }

        public PCRunEventLog GetRunEventLog(int runId)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                return _pcRestProxy.GetRunEventLog(runId, ref pcErrorResponse);
            }
            catch (Exception e)
            {
                _fileLog.Write(LogMessageType.Error, string.Format("GetRunEventLog failed. Error: "  + e.Message));
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("GetRunEventLog failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
            return null;
        }

        public void AddRunToTrendReport(int runId, String trendReportId)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            PCTrendReportRequest pcTrendReportRequest = new PCTrendReportRequest(_pcModel.Project, runId, null);
            _fileLog.Write(LogMessageType.Info, "Adding run: " + runId + " to trend report: " + trendReportId);
            try
            {
                _pcRestProxy.UpdateTrendReport(trendReportId, pcTrendReportRequest, ref pcErrorResponse);
                _fileLog.Write(LogMessageType.Info, "Publishing run: " + runId + " on trend report: " + trendReportId);
            }
            catch (Exception e)
            {
                _fileLog.Write(LogMessageType.Error, "Failed to add run to trend report: Problem connecting to PC Server. " + e.Message);
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("AddRunToTrendReport failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
        }




        public void WaitForRunToPublishOnTrendReport(int runId, String trendReportId)
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                PCTrendReport pcTrendReport;
                bool publishEnded = false;
                int counter = 0;

                do
                {
                    pcTrendReport = _pcRestProxy.GetTrendReportMetaData(trendReportId, ref pcErrorResponse);

                    if (pcTrendReport == null) break;

                    foreach (TrendReportTrendedRun trendReportTrendedRun in pcTrendReport.TrendedRuns) {

                        if (trendReportTrendedRun.RunID != runId) continue;

                        if (trendReportTrendedRun.State.Equals(PCBuilder.TRENDED) || trendReportTrendedRun.State.Equals(PCBuilder.ERROR)) {
                            publishEnded = true;
                            _fileLog.Write(LogMessageType.Info, "Run: " + runId + " publishing status: " + trendReportTrendedRun.State);
                            break;
                        }
                        else
                        {
                            System.Threading.Thread.Sleep(5000);
                            counter++;
                            if (counter >= 120) {
                                string msg = "Publishing didn't ended after 10 minutes, aborting...";
                                _fileLog.Write(LogMessageType.Error, msg);
                            }
                        }
                    }
                }
                while (!publishEnded && counter < 120);
            }
            catch (Exception e)
            {
                _fileLog.Write(LogMessageType.Error, "Error in waitForRunToPublishOnTrendReport. " + e.Message);
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("WaitForRunToPublishOnTrendReport failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
            }
        }


        public bool DownloadTrendReportAsPdf(string trendReportId, string directory) 
        {
            PCErrorResponse pcErrorResponse = new PCErrorResponse("", 0);
            try
            {
                _fileLog.Write(LogMessageType.Info, "Downloading trend report: " + trendReportId + " in PDF format");
                string filePath = Path.Combine(directory, "trendReport" + trendReportId + ".pdf");
                bool success = _pcRestProxy.GetTrendingPDF(int.Parse(trendReportId), filePath, ref pcErrorResponse);
                if (success)
                    _fileLog.Write(LogMessageType.Info, "Trend report: " + trendReportId + " was successfully downloaded");
                else
                    _fileLog.Write(LogMessageType.Info, "Trend report: " + trendReportId + " was not successfully downloaded");
                WaitForUnlockedFile(filePath);
                return success;
            }
            catch (Exception e)
            {

                _fileLog.Write(LogMessageType.Error, "Failed to download trend report: " + e.Message);
                if (pcErrorResponse.ErrorCode > 0)
                {
                    _fileLog.Write(LogMessageType.Error, string.Format("DownloadTrendReportAsPdf failed, ExceptionMessage: {0}, ErrorCode: {1}", pcErrorResponse.ExceptionMessage, pcErrorResponse.ErrorCode));
                }
                return false;
            }

        }

        private void WaitForUnlockedFile(string fullFilleNamepPossiblyLocked)
        {
            FileInfo fileInfo = new FileInfo(fullFilleNamepPossiblyLocked);
            int count = 0;
            while (IsFileLocked(fileInfo) && count <= _maxUnlockWait)
            {
                if (count == _maxUnlockWait)
                    _fileLog.Write(LogMessageType.Info, string.Format("File is locked for too long ({0} seconds). Not wating anymore.", _maxUnlockWait * _waitInterval / 1000));
                System.Threading.Thread.Sleep(_waitInterval);
                count++;
            }
        }

        private bool IsFileLocked(FileInfo filePossiblyLocked)
        {
            FileStream fileStream = null;

            try
            {
                fileStream = filePossiblyLocked.Open(FileMode.Open, FileAccess.Read, FileShare.None);
            }
            catch (IOException)
            {
                //file is locked
                return true;
            }
            finally
            {
                if (fileStream != null)
                    fileStream.Close();
            }

            //file is not locked
            return false;
        }

        public void PublishTrendReport(String filePath, String trendReportId)
        {

            if (filePath == null) { return; }

            //publish hyerlink in logs
            //string hyperlink = createHyperlunk(filePath, trendReportId);
            _fileLog.Write(LogMessageType.Info, "View trend report " + filePath);

        }

        public void verifySlaStatus(string runSlaStatus)
        {
            if (!runSlaStatus.ToLower().Equals("passed"))
                _fileLog.Write(LogMessageType.Error, string.Format("SLA Status is {0}", runSlaStatus));
        }

        //public FileLog GetFileLog() => _fileLog; 


        //To be called when all is finished
        public void PCClientEnd()
        {
            _fileLog.Write(LogMessageType.Info, END_OF_LOG_FILE);
        }
    }
}
