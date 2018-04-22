using PC.Plugins.Common.PCEntities;

namespace PC.Plugins.Common.Rest
{
    public interface IPCRestProxy
    {
        bool Authenticate(string userName, string password);
        bool Authenticate(string userName, string password, ref PCErrorResponse pcErrorResponse);
        int CreateTestInstance(int testId, int testSetId);
        int CreateTestInstance(int testId, int testSetId, ref PCErrorResponse pcErrorResponse);
        PCTestSets GetAllTestSets();
        PCTestSets GetAllTestSets(ref PCErrorResponse pcErrorResponse);
        PCTrendReports GetAllTrendReports();
        PCTrendReports GetAllTrendReports(ref PCErrorResponse pcErrorResponse);
        PCRunResponse GetRunData(int runId);
        PCRunResponse GetRunData(int runId, ref PCErrorResponse pcErrorResponse);
        PCRunEventLog GetRunEventLog(int runId);
        PCRunEventLog GetRunEventLog(int runId, ref PCErrorResponse pcErrorResponse);
        bool GetRunResultData(int runId, int resultId, string fullFileName);
        bool GetRunResultData(int runId, int resultId, string fullFileName, ref PCErrorResponse pcErrorResponse);
        PCRunResults GetRunResults(int runId);
        PCRunResults GetRunResults(int runId, ref PCErrorResponse pcErrorResponse);
        PCTest GetTestData(int testId);
        PCTest GetTestData(int testId, ref PCErrorResponse pcErrorResponse);
        PCTestInstances GetTestInstancesByTestId(int testI);
        PCTestInstances GetTestInstancesByTestId(int testId, ref PCErrorResponse pcErrorResponse);
        bool GetTrendingPDF(int trendReportId, string fullFileName);
        bool GetTrendingPDF(int trendReportId, string fullFileName, ref PCErrorResponse pcErrorResponse);
        PCTrendReportRoot GetTrendReport(int trendReportId, int runId);
        PCTrendReportRoot GetTrendReport(int trendReportId, int runId, ref PCErrorResponse pcErrorResponse);
        PCTrendReport GetTrendReportMetaData(string trendReportId);
        PCTrendReport GetTrendReportMetaData(string trendReportId, ref PCErrorResponse pcErrorResponse);
        bool Logout();
        bool Logout(ref PCErrorResponse pcErrorResponse);
        PCRunResponse StartRun(int testId, int testInstanceId, PCTimeslotDuration timeslotDuration, string postRunAction = "Collate And Analyze", bool vudsMode = false);
        PCRunResponse StartRun(int testId, int testInstanceId, PCTimeslotDuration timeslotDuration, ref PCErrorResponse pcErrorResponse, string postRunAction = "Collate And Analyze", bool vudsMode = false);
        bool StopRun(int runId, string stopMode = "stop", bool releaseTimeslot = true, string postRunAction = "Do Not Collate");
        bool StopRun(int runId, ref PCErrorResponse pcErrorResponse, string stopMode = "stop", bool releaseTimeslot = true, string postRunAction = "Do Not Collate");
        bool UpdateTrendReport(string trendReportId, PCTrendReportRequest trendReportRequest);
        bool UpdateTrendReport(string trendReportId, PCTrendReportRequest trendReportRequest, ref PCErrorResponse pcErrorResponse);
        int UploadVugenScript(PCScript pcScript, string fullFileName);
        int UploadVugenScript(PCScript pcScript, string fullFileName, ref PCErrorResponse pcErrorResponse);
        PCTest GetTest(int testId, ref PCErrorResponse pcErrorResponse);
    }
}