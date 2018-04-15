using PC.Plugins.Common.PCEntities;

namespace PC.Plugins.Automation
{
    interface IPCClient
    {
        void AddRunToTrendReport(int runId, string trendReportId);
        bool DownloadTrendReportAsPdf(string trendReportId, string directory);
        PCRunEventLog GetRunEventLog(int runId);
        string GetTestName();
        bool IsLoggedIn();
        bool Login();
        bool Logout();
        string PublishRunReport(int runId, string reportDirectory);
        void PublishTrendReport(string filePath, string trendReportId);
        int StartRun();
        bool StopRun(int runId);
        PCRunResponse WaitForRunCompletion(int runId);
        PCRunResponse WaitForRunCompletion(int runId, int interval);
        void WaitForRunToPublishOnTrendReport(int runId, string trendReportId);
        void PCClientEnd();
        void verifySlaStatus(string runSlaStatus);

        //FileLog GetFileLog();
    }
}