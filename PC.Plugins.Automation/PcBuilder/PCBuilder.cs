using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PC.Plugins.Common.PCEntities;
using PC.Plugins.Common.Constants;
using PC.Plugins.Common.Helper;
using System.Runtime.InteropServices;

namespace PC.Plugins.Automation
{
    public class PCBuilder : IPCBuilder
    {


        List<string> listOfEndedRunState = new List<string> {
            EnumerationHelper.GetEnumDescription((PCConstants.RunStates)PCConstants.RunStates.Canceled),
            EnumerationHelper.GetEnumDescription((PCConstants.RunStates)PCConstants.RunStates.Finished),
            EnumerationHelper.GetEnumDescription((PCConstants.RunStates)PCConstants.RunStates.RunFailure),
            EnumerationHelper.GetEnumDescription((PCConstants.RunStates)PCConstants.RunStates.FailedCollatingResults),
            EnumerationHelper.GetEnumDescription((PCConstants.RunStates)PCConstants.RunStates.PendingCreatingAnalysisData)
            };

        private const string ARTIFACTSDIRECTORYNAME = "archive";
        public const string ARTIFCTSRESOURCENAME = "artifact";
        //public const string runReportStructure = "{0}/performanceTestsReports/pcRun";
        //public const string TREND_REPORT_STRUCTURE = "{0}/{1}/performanceTestsReports/TrendReports";
        public const string PC_REPORT_ARCHIVE_NAME = "Reports.zip";
        public const string PC_REPORT_FILENAME = "Report.html";
        public const string RUNID_BUILD_VARIABLE = "HP_RUN_ID";
        public const string TRENDED = "Trended";
        public const string PENDING = "Pending";
        public const string PUBLISHING = "Publishing";
        public const string ERROR = "Error";
        private string _workDirectory = @"C:\Temp\PC.Plugins.Automation.Logs\{0}";
        private string _logFileName = @"PC.Plugins.Automation.Logs.log";
        private string _userName;
        private string _password;
        private string _timeslotDurationHours;
        private string _timeslotDurationMinutes;
        private bool _statusBySLA;
        private FileLog _fileLog;
        private IPCModel _pcModel;
        private string _logFullFileName;

        public string LogFullFileName => _logFullFileName;

        public PCBuilder(
            string serverAndPort,
            string pcServerName,
            string userName,
            string password,
            string domain,
            string project,
            string testId,
            bool autoTestInstance,
            string testInstanceID,
            string timeslotDurationHours,
            string timeslotDurationMinutes,
            string pcPostRunActionsRequest,
            bool vudsMode,
            bool statusBySLA,
            string description,
            string addRunToTrendReport,
            string trendReportId,
            bool HTTPSProtocol,
            string proxyOutURL,
            string proxyOutUser,
            string proxyOutPassword,
            string workDirectory = "",
            string logFileName = "",
            string timeslotRepeat = "DoNotRepeat",
            string timeslotRepeatDelay = "5",
            string timeslotRepeatAttempts = "3")
        {

            Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
            _workDirectory = !String.IsNullOrWhiteSpace(workDirectory) ? workDirectory : String.Format(_workDirectory, unixTimestamp.ToString());
            _logFileName = !String.IsNullOrWhiteSpace(logFileName) ? logFileName : _logFileName; ;
            _logFullFileName = Path.Combine(_workDirectory, _logFileName);
            _fileLog = new FileLog(_logFullFileName);
            _userName = userName;
            _password = password; 
            _timeslotDurationHours = timeslotDurationHours;
            _timeslotDurationMinutes = timeslotDurationMinutes;
            _statusBySLA = statusBySLA;

            _pcModel =
                    new PCModel(
                            serverAndPort,
                            pcServerName,
                            userName,
                            password,
                            domain,
                            project,
                            testId,
                            autoTestInstance,
                            testInstanceID,
                            timeslotDurationHours,
                            timeslotDurationMinutes,
                            new PCPostRunActionsRequest(true, pcPostRunActionsRequest),
                            vudsMode,
                            description,
                            addRunToTrendReport,
                            trendReportId,
                            HTTPSProtocol,
                            proxyOutURL,
                            proxyOutUser,
                            proxyOutPassword,
                            timeslotRepeat,
                            timeslotRepeatDelay,
                            timeslotRepeatAttempts);
        }


        private bool beforeRun(PCClient pcClient) => ValidatePcForm() && pcClient.Login();

        private bool ValidatePcForm()
        {
            bool valide = !String.IsNullOrWhiteSpace(_pcModel.PCServerAndPort) && !String.IsNullOrWhiteSpace(_pcModel.PCServerAndPort) && !String.IsNullOrWhiteSpace(_pcModel.UserName)
            && !String.IsNullOrWhiteSpace(_pcModel.Domain) && !String.IsNullOrWhiteSpace(_pcModel.TestId) && !String.IsNullOrWhiteSpace((!_pcModel.AutoTestInstance) ? _pcModel.TestInstanceId : "ok");

            if (valide)
                return false;
            return true;
        }

        public void Perform()
        {
            IPCClient pcClient = new PCClient(_pcModel, _fileLog);
            try
            {
                bool authenticated = pcClient.Login();
                int runID;
                if (authenticated)
                {
                    runID = pcClient.StartRun();
                    if (runID == 0)
                    {
                        pcClient.Logout();
                        return;
                    }
                }
                else
                    return;

                string testName = pcClient.GetTestName();
                PCRunResponse pcRunResponse = null;
                if (runID > 0)
                    pcRunResponse = pcClient.WaitForRunCompletion(runID);

                if (pcRunResponse != null)
                {
                    //analysis report
                    string pcReportFile = (pcRunResponse.RunState == EnumerationHelper.GetEnumDescription(PCConstants.RunStates.Finished)) ? pcClient.PublishRunReport(runID, _workDirectory) : "";

                    // Adding the trend report section if ID has been set
                    if (_pcModel.GetAddRunToTrendReport.Equals("UseTrendReportID") && !string.IsNullOrWhiteSpace(_pcModel.TrendReportId) && pcRunResponse.RunState != EnumerationHelper.GetEnumDescription(PCConstants.RunStates.RunFailure))
                    {
                        bool addRunToTrendReportSuccess = pcClient.AddRunToTrendReport(runID, _pcModel.TrendReportId);
                        if (addRunToTrendReportSuccess)
                        {
                            System.Threading.Thread.Sleep(5000);
                            pcClient.WaitForRunToPublishOnTrendReport(runID, _pcModel.TrendReportId);
                            System.Threading.Thread.Sleep(5000);
                            pcClient.DownloadTrendReportAsPdf(_pcModel.TrendReportId, _workDirectory);
                        }
                    }

                    // Adding the trend report if the Associated Trend report is selected.
                    if (_pcModel.GetAddRunToTrendReport.Equals("AssociatedTrend") && pcRunResponse.RunState != EnumerationHelper.GetEnumDescription(PCConstants.RunStates.RunFailure))
                    {
                        bool addRunToTrendReportSuccess = pcClient.AddRunToTrendReport(runID, _pcModel.TrendReportId);
                        if (addRunToTrendReportSuccess)
                        {
                            System.Threading.Thread.Sleep(5000);
                            pcClient.WaitForRunToPublishOnTrendReport(runID, _pcModel.TrendReportId);
                            System.Threading.Thread.Sleep(5000);
                            pcClient.DownloadTrendReportAsPdf(_pcModel.TrendReportId, _workDirectory);
                        }
                    }
                    if (_statusBySLA && pcRunResponse.RunState == EnumerationHelper.GetEnumDescription(PCConstants.RunStates.Finished))
                        pcClient.verifySlaStatus(pcRunResponse.RunSLAStatus);
                }
                pcClient.Logout();
            }
            catch { }
            finally
            {
                //important ending to mark the end of the task for log report parsing!!
                pcClient.PCClientEnd();
            }
        }
    }
}
