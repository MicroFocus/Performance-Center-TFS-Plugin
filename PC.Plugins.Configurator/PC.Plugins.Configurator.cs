using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PC.Plugins.Common.Rest;
using PC.Plugins.Automation;


namespace PC.Plugins.Configurator
{
    public class Configurator
    {
        private const string PREVIOUSLYREAD = "previouslyRead";
        private const string END_OF_LOG_FILE = "Test Execution Ended";
        private static IPCRestProxy _pcRestProxy;
        private static IPCBuilder _pcBuilder;
        private static string _pcServerURL;
        private static string _pcServerAndPort;
        private static string _pcServername;
        private static string _webProtocol;
        private static string _pcUserName;
        private static string _pcPassword;
        private static string _domain;
        private static string _project;
        private static string _testID;
        private static string _autoTestInstance;
        private static string _testInstanceID;
        private static string _pcPostRunAction;
        private static string _proxyURL;
        private static string _proxyUserName;
        private static string _proxyPassword;
        private static string _trending;
        private static string _trendReportID;
        private static string _timeslotDurationHours;
        private static string _timeslotDurationMinutes;
        private static string _useSLAStatus;
        private static string _useVUDs;
        private static string _workDirectory = @"C:\Temp\PC.Plugins.Automation.Logs\{0}";
        private static string _logFileName = "PC.Plugins.Automation.Logs.log";
        //private static string _description;

        public static string PCServerURL
        {
            get { return _pcServerURL; }
            set { _pcServerURL = value; }
        }
        public static string PCServerAndPort
        {
            get { return _pcServerAndPort; }
            set { _pcServerAndPort = value; }
        }
        public static string PCServername
        {
            get { return _pcServername; }
            set { _pcServername = value; }
        }

        public static string WebProtocol
        {
            get { return _webProtocol; }
            set { _webProtocol = value; }
        }
        public static string PCUserName
        {
            get { return _pcUserName; }
            set { _pcUserName = value; }
        }

        public static string PCPassword
        {
            get { return _pcPassword; }
            set { _pcPassword = value; }
        }
        public static string Domain
        {
            get { return _domain; }
            set { _domain = value; }
        }
        public static string Project
        {
            get { return _project; }
            set { _project = value; }
        }
        public static string TestID
        {
            get { return _testID; }
            set { _testID = value; }
        }
        public static string AutoTestInstance
        {
            get { return _autoTestInstance; }
            set { _autoTestInstance = value; }
        }
        public static string TestInstanceID
        {
            get { return _testInstanceID; }
            set { _testInstanceID = value; }
        }
        public static string PCPostRunAction
        {
            get { return _pcPostRunAction; }
            set { _pcPostRunAction = value; }
        }
        public static string ProxyURL
        {
            get { return _proxyURL; }
            set { _proxyURL = value; }
        }
        public static string ProxyUserName
        {
            get { return _proxyUserName; }
            set { _proxyUserName = value; }
        }
        public static string ProxyPassword
        {
            get { return _proxyPassword; }
            set { _proxyPassword = value; }
        }

        public static string Trending
        {
            get { return _trending; }
            set { _trending = value; }
        }

        public static string TrendReportID
        {
            get { return _trendReportID; }
            set { _trendReportID = value; }
        }
        public static string TimeslotDurationHours
        {
            get { return TimeslotDurationHours; }
            set { _timeslotDurationHours = value; }
        }
        public static string TimeslotDurationMinutes
        {
            get { return _timeslotDurationMinutes; }
            set { _timeslotDurationMinutes = value; }
        }

        public static string UseSLAStatus
        {
            get { return _useSLAStatus; }
            set { _useSLAStatus = value; }
        }
        public static string UseVUDs
        {
            get { return _useVUDs; }
            set { _useVUDs = value; }
        }
        public static string WorkDirectory
        {
            get { return _workDirectory; }
            set { _workDirectory = value; }
        }
        public static string LogFileName
        {
            get { return _logFileName; }
            set { _logFileName = value; }
        }

        public static string _Description
        {
            get { return _workDirectory; }
            set { _workDirectory = value; }
        }

        public Configurator()
        {
        }

        //public Configurator(string pcServerURL, string pcUserName, string pcPassword, string domain, string project,
        //    string testID, string autoTestInstance, string testInstanceID, string pcPostRunAction,
        //    string proxyURL, string proxyUserName, string proxyPassword,
        //    string trending, string trendReportID, string timeslotDurationHours, string timeslotDurationMinutes,
        //    string useSLAStatus, string useVUDs, string workDirectory = "", string logFileName = "", string description = "")
        //{
        //    _pcServerAndPort = pcServerURL.Trim().Replace("https://", "").Replace("http://", "");
        //    _pcServername = (_pcServerAndPort.LastIndexOf(':') == -1) ? _pcServerAndPort : _pcServerAndPort.Substring(0, (_pcServerAndPort.LastIndexOf(':')));
        //    _webProtocol = pcServerURL.Trim().StartsWith("https") ? "https" : "http";
        //    _pcUserName = pcUserName;
        //    _pcPassword = pcPassword;
        //    _domain = domain;
        //    _project = project;
        //    _testID = testID;
        //    _autoTestInstance = autoTestInstance;
        //    _testInstanceID = (autoTestInstance.ToLower() == "false" && testInstanceID != "Enter Test Instance ID") ? testInstanceID : "";
        //    _pcPostRunAction = pcPostRunAction;
        //    _proxyURL = proxyURL;
        //    _proxyUserName = proxyUserName;
        //    _proxyPassword = proxyPassword;
        //    _trending = trending;
        //    _trendReportID = (trending == "UseTrendReportID" && trendReportID != "Enter Trend Report ID") ? trendReportID : "";
        //    _timeslotDurationHours = timeslotDurationHours;
        //    _timeslotDurationMinutes = String.IsNullOrWhiteSpace(timeslotDurationMinutes) ? "30" : timeslotDurationMinutes;
        //    _useSLAStatus = useSLAStatus;
        //    _useVUDs = useVUDs;
        //    if (!string.IsNullOrWhiteSpace(workDirectory))
        //        _workDirectory = workDirectory;
        //    else
        //    {
        //        Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
        //        _workDirectory = string.Format(_workDirectory, unixTimestamp.ToString());
        //    }
        //    if (!string.IsNullOrWhiteSpace(logFileName))
        //        _logFileName = logFileName;
        //    var _description = description;

        //    _pcBuilder = new PCBuilder(_pcServerAndPort, _pcServername, _pcUserName, _pcPassword, _domain,
        //        _project, _testID, _autoTestInstance.ToLower() == "true", _testInstanceID, _timeslotDurationHours, _timeslotDurationMinutes,
        //        _pcPostRunAction, _useVUDs.ToLower() == "true", _useSLAStatus.ToLower() == "true", _description,
        //        _trending, _trendReportID, _webProtocol == "https",
        //        _proxyURL, _proxyUserName, _proxyPassword, _workDirectory, _logFileName);

        //    _pcRestProxy = new PCRestProxy(_webProtocol, _pcServerAndPort, domain, project, proxyURL, proxyUserName, proxyPassword);
        //}

        public static string Perform(string pcServerURL, string pcUserName, string pcPassword, string domain, string project,
            string testID, string autoTestInstance, string testInstanceID, string pcPostRunAction,
            string proxyURL, string proxyUserName, string proxyPassword,
            string trending, string trendReportID, string timeslotDurationHours, string timeslotDurationMinutes,
            string useSLAStatus, string useVUDs, string workDirectory = "", string logFileName = "", string description = "")
        {
            _pcServerAndPort = pcServerURL.Trim().Replace("https://", "").Replace("http://", "");
            _pcServername = (_pcServerAndPort.LastIndexOf(':') == -1) ? _pcServerAndPort : _pcServerAndPort.Substring(0, (_pcServerAndPort.LastIndexOf(':')));
            _webProtocol = pcServerURL.Trim().StartsWith("https") ? "https" : "http";
            _pcUserName = pcUserName;
            _pcPassword = pcPassword;
            _domain = domain;
            _project = project;
            _testID = testID;
            _autoTestInstance = autoTestInstance;
            _testInstanceID = (autoTestInstance.ToLower() == "false" && testInstanceID != "Enter Test Instance ID") ? testInstanceID : "";
            _pcPostRunAction = pcPostRunAction;
            _proxyURL = proxyURL;
            _proxyUserName = proxyUserName;
            _proxyPassword = proxyPassword;
            _trending = (string.IsNullOrWhiteSpace(trending) || (pcPostRunAction.Equals("DoNotCollate")))? "DoNotTrend" : trending;
            _trendReportID = (_trending == "UseTrendReportID" && trendReportID != "Enter Trend Report ID") ? trendReportID : "";
            _timeslotDurationHours = timeslotDurationHours;
            _timeslotDurationMinutes = String.IsNullOrWhiteSpace(timeslotDurationMinutes) ? "30" : timeslotDurationMinutes;
            _useSLAStatus = useSLAStatus;
            _useVUDs = useVUDs;
            if (!string.IsNullOrWhiteSpace(workDirectory))
                _workDirectory = workDirectory;
            else
            {
                Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
                _workDirectory = string.Format(_workDirectory, unixTimestamp.ToString());
            }
            if (!string.IsNullOrWhiteSpace(logFileName))
                _logFileName = logFileName;
            var _description = description;

            string message = "";
            ValidateInputFieldsSupposedToBePositiveInteger(ref message);
            if (string.IsNullOrEmpty(message))
            {
                _pcBuilder = new PCBuilder(_pcServerAndPort, _pcServername, _pcUserName, _pcPassword, _domain,
                    _project, _testID, _autoTestInstance.ToLower() == "true", _testInstanceID, _timeslotDurationHours, _timeslotDurationMinutes,
                    _pcPostRunAction, _useVUDs.ToLower() == "true", _useSLAStatus.ToLower() == "true", _description,
                    _trending, _trendReportID, _webProtocol == "https",
                    _proxyURL, _proxyUserName, _proxyPassword, _workDirectory, _logFileName);
                _pcRestProxy = new PCRestProxy(_webProtocol, _pcServerAndPort, domain, project, proxyURL, proxyUserName, proxyPassword);
                Perform();
                return Path.Combine(_workDirectory, _logFileName);
            }
            else
            {
                throw new Exception(message);
            }
        }

        public static void Perform()
        {
            System.Threading.Thread thread = new System.Threading.Thread(_pcBuilder.Perform);
            thread.Start();
            //_pcBuilder.Perform();
        }

        public static bool TestConnection(string pcServerURL, string pcUserName, string pcPassword, string proxyURL, string proxyUserName, string proxyPassword)
        {
            _webProtocol = pcServerURL.Trim().StartsWith("https") ? "https" : "http";
            _pcServerAndPort = pcServerURL.Trim().Replace("https://", "").Replace("http://", "");
            _pcUserName = pcUserName;
            _pcPassword = pcPassword;
            _proxyURL = proxyURL;
            _proxyUserName = proxyUserName;
            _proxyPassword = proxyPassword;

            _pcRestProxy = new PCRestProxy(_webProtocol, _pcServerAndPort, "", "", proxyURL, proxyUserName, proxyPassword);

            return _pcRestProxy.Authenticate(_pcUserName, _pcPassword);
        }

        public static bool IsLogFileEnded(string fullFilename)
        {
            bool isLogFileEnded = true;
            string FullFilenameDuplicated = fullFilename + "duplicated";

            try
            {
                if (File.Exists(fullFilename))
                    File.Copy(fullFilename, FullFilenameDuplicated);
                if (File.Exists(FullFilenameDuplicated))
                {
                    string contents = File.ReadAllText(FullFilenameDuplicated);
                    isLogFileEnded = contents.EndsWith(END_OF_LOG_FILE) || contents.Contains(END_OF_LOG_FILE);
                }
            }
            catch
            {
                isLogFileEnded = false;
            }
            finally
            {
                if (File.Exists(FullFilenameDuplicated))
                    File.Delete(FullFilenameDuplicated);
            }
            return isLogFileEnded;
        }

        public static string GetNewContent(string fullFilename)
        {
            string[] newContentArray;
            string[] oldContentArray;
            string newContent = "";
            long lastPositionPreviouslyRead = 0;

            string FullFilenameDuplicated = fullFilename + "duplicated";
            string FullFileNamePreviouslyRead = fullFilename + PREVIOUSLYREAD;

            if (File.Exists(fullFilename))
            {
                bool isPreviouslyReadFileExist = File.Exists(FullFileNamePreviouslyRead);
                if (isPreviouslyReadFileExist)
                    oldContentArray = ReadAllLinesFromPosition(FullFileNamePreviouslyRead, ref lastPositionPreviouslyRead);

                File.Copy(fullFilename, FullFilenameDuplicated);
                newContentArray = ReadAllLinesFromPosition(fullFilename, ref lastPositionPreviouslyRead);
                newContent = newContentArray.Length > 0 ? String.Join("\r\n", newContentArray) : "";
                if (isPreviouslyReadFileExist)
                    File.Delete(FullFileNamePreviouslyRead);
                File.Move(FullFilenameDuplicated, FullFileNamePreviouslyRead);
            }
            return newContent;
        }

        public static string SayCoucou() => "Coucou";

        public static string GetTaskStatus(string FullFilename)
        {
            if (string.IsNullOrEmpty(FullFilename))
                return "Task did not end correctly";
            string[] ContentArray;
            long position = 0;
            ContentArray = ReadAllLinesFromPosition(FullFilename, ref position);
            foreach (string line in ContentArray)
            {
                if (line.ToLower().Contains("error") || line.ToLower().Contains("failed"))
                    return line;
            }
            string lastLine = ContentArray[ContentArray.Length - 1];
            if (!(lastLine.EndsWith(END_OF_LOG_FILE) || lastLine.Contains(END_OF_LOG_FILE)))
                return "Task did not end correctly";
            return null;
        }

        public static void DeleteUnusedFilesFromArtifact(string logFullFilename)
        {
            if (string.IsNullOrEmpty(logFullFilename))
                return;
            string logFullFileNamePreviouslyRead = Path.Combine(logFullFilename + PREVIOUSLYREAD);
            if (File.Exists(logFullFileNamePreviouslyRead))
                File.Delete(logFullFileNamePreviouslyRead);
            string reportFullFileName = Path.Combine(Path.GetDirectoryName(logFullFilename), "Reports.zip");
            if (File.Exists(reportFullFileName))
                File.Delete(reportFullFileName);
        }

        private static string[] ReadAllLinesFromPosition(string FullFilename, ref long position)
        {
            using (FileStream fileStream = File.OpenRead(FullFilename))
            {
                fileStream.Position = position;

                using (StreamReader streamReader = new StreamReader(fileStream))
                {
                    string line = null;
                    List<string> lines = new List<string>();
                    while ((line = streamReader.ReadLine()) != null)
                    {
                        lines.Add(line);
                    }
                    position = fileStream.Position;
                    return lines.ToArray();
                }
            }
        }
        private static void ValidateInputFieldsSupposedToBePositiveInteger(ref string message)
        {
            int intTestID=0;
            bool isTestIDNumeric = int.TryParse(_testID, out intTestID);
            if (!isTestIDNumeric || intTestID <= 0)
            {
                message = "Error: The Test ID value must be a positive number. ";
            }

            if (_autoTestInstance.ToLower() != "true")
            {
                int intTestInstanceID=0;
                bool isTestInstanceIDNumeric = int.TryParse(_testInstanceID, out intTestInstanceID);
                if (!isTestInstanceIDNumeric || intTestInstanceID<=0)
                {
                    string strTestInstanceIDError = "The Test Instance ID value must be a positive number when selecting the \"Manual Selection\" option for the \"Test Instance\" field. ";
                    message = (!string.IsNullOrEmpty(message))? message + strTestInstanceIDError: "Error: " + strTestInstanceIDError;
                }
            }

            if (_pcPostRunAction == "CollateAndAnalyze" && _trending == "UseTrendReportID")
            {
                int intTrendReportID=0;
                bool isTrendReportIDNumeric = int.TryParse(_trendReportID, out intTrendReportID);
                if (!isTrendReportIDNumeric || intTrendReportID <= 0)
                {
                    string strTrendReportIDError = "The Trend Report ID value must be a positive number when selecting the \"Collate And Analyze\" option for \"Post Run Action\" field and \"Add run to Trend report with ID\" option for \"Trending\" field.";
                    message = (!string.IsNullOrEmpty(message)) ? message + strTrendReportIDError : "Error: " + strTrendReportIDError;
                }
            }

            int intTimeSlotDuration;
            bool isTimeSlotDurationNumeric = int.TryParse(_timeslotDurationMinutes, out intTimeSlotDuration);
            if (!isTimeSlotDurationNumeric || intTimeSlotDuration <= 0)
            {
                _timeslotDurationMinutes = "30";
            }
            else if (intTimeSlotDuration> 28800)
            {
                _timeslotDurationMinutes = "28800";
            }
        }
    }
}
