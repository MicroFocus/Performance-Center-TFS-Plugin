using PC.Plugins.Common.PCEntities;

namespace PC.Plugins.Automation
{
    public interface IPCModel
    {
        string AddRunToTrendReport { get; set; }
        bool AutoTestInstance { get; set; }
        string BuildParameters { get; set; }
        string Description { get; set; }
        string Domain { get; set; }
        bool HTTPSProtocol { get; set; }
        string Password { get; set; }
        PCPostRunActionsRequest PCPostRunActionsRequest { get; set; }
        string PCServerAndPort { get; set; }
        string PCServerName { get; set; }
        PCTimeslotDuration PCTimeslotDuration { get; set; }
        string Project { get; set; }
        string ProxyOutPassword { get; set; }
        string ProxyOutURL { get; set; }
        string ProxyOutUser { get; set; }
        string TestId { get; set; }
        string TestInstanceId { get; set; }
        string TrendReportId { get; set; }
        string UserName { get; set; }
        bool VUDsMode { get; set; }
        string GetAddRunToTrendReport { get; }
        string isHTTPSProtocol();
        bool isVudsMode();
        string TimeslotRepeat { get; set; }
        string TimeslotRepeatDelay { get; set; }
        string TimeslotRepeatAttempts { get; set; }


    }
}