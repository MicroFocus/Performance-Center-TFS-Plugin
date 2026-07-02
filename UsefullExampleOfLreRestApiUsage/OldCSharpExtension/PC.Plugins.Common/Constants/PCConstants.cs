using System.ComponentModel;

namespace PC.Plugins.Common.Constants
{
    public class PCConstants
    {
        public const string PC_API_XMLNS = "http://www.hp.com/PC/REST/API";
        public const string BASE_PC_API_URL = "LoadTest/rest";
        public const string BASE_PC_API_AUTHENTICATION_URL = BASE_PC_API_URL + "/authentication-point";
        public const string AUTHENTICATION_LOGIN_URL = BASE_PC_API_AUTHENTICATION_URL + "/authenticate";
        public const string AUTHENTICATION_WITH_TOKEN_LOGIN_URL = BASE_PC_API_AUTHENTICATION_URL + "/authenticateclient";
        public const string AUTHENTICATION_LOGOUT_URL = BASE_PC_API_AUTHENTICATION_URL + "/logout";
        public const string PC_API_RESOURCES_TEMPLATE = BASE_PC_API_URL + "/domains/%s/projects/%s";
        public const string RUNS_RESOURCE_NAME = "Runs";
        public const string TESTS_RESOURCE_NAME = "tests";
        public const string TEST_INSTANCES_NAME = "testinstances";
        public const string TEST_SETS_NAME = "testsets";
        public const string RESULTS_RESOURCE_NAME = "Results";
        public const string EVENTLOG_RESOURCE_NAME = "EventLog";
        public const string TREND_REPORT_RESOURCE_NAME = "TrendReports";
        public const string TREND_REPORT_RESOURCE_SUFFIX = "data";
        public const string SCRIPTS = "Scripts";
        public const string COLLATERESULTS = "Collate Results";
        public const string COLLATEANDANALYZE = "Collate And Analyze";
        public const string DONOTCOLLATE = "Do Not Collate";

        public enum PostRunActions
        {
            [DescriptionAttribute("Collate results")]
            CollateResults,
            [DescriptionAttribute("Collate And Analyze")]
            CollateAnalyze,
            [DescriptionAttribute("Do not collate")]
            DoNotCollate
        }

        public enum PostRunActionValue
        {
            [DescriptionAttribute("Collate Results")]
            CollateResults,
            [DescriptionAttribute("Collate And Analyze")]
            CollateAndAnalyze,
            [DescriptionAttribute("Do Not Collate")]
            DoNotCollate
        }

        public enum RunStates
        {
            [DescriptionAttribute("Before Collating Results")]
            BeforeCollating,
            [DescriptionAttribute("Before Creating Analysis Data")]
            BeforeCreatingAnalysisData,
            [DescriptionAttribute("Canceled")]
            Canceled,
            [DescriptionAttribute("Collating Results")]
            CollatingResults,
            [DescriptionAttribute("Creating Analysis Data")]
            CreatingAnalysisData,
            [DescriptionAttribute("Failed Collating Results")]
            FailedCollatingResults,
            [DescriptionAttribute("Failed Creating Analysis Data")]
            FailedCreatingAnalysisData,
            [DescriptionAttribute("Initializing")]
            Initializing,
            [DescriptionAttribute("Pending Creating Analysis Data")]
            PendingCreatingAnalysisData,
            [DescriptionAttribute("Run Failure")]
            RunFailure,
            [DescriptionAttribute("Running")]
            Running,
            [DescriptionAttribute("Stopping")]
            Stopping,
            [DescriptionAttribute("Finished")]
            Finished
        }

    }
}
