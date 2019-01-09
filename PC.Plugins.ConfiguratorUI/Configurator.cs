using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PC.Plugins.Common.Rest;
using PC.Plugins.Automation;
using System.IO;

namespace PC.Plugins.ConfiguratorUI
{
    public class Configurator
    {
        private const string END_OF_LOG_FILE = "Test Execution Ended";
        private IPCRestProxy _pcRestProxy;
        private IPCBuilder _pcBuilder;
        private string _pcServerURL;
        private string _pcServerAndPort;
        private string _pcServername;
        private string _webProtocol;
        private string _pcUserName;
        private string _pcPassword;
        private string _domain;
        private string _project;
        private string _testID;
        private string _autoTestInstance;
        private string _testInstanceID;
        private string _pcPostRunAction;
        private string _proxyURL;
        private string _proxyUserName;
        private string _proxyPassword;
        private string _trending;
        private string _trendReportID;
        private string _timeslotDurationHours;
        private string _timeslotDurationMinutes;
        private string _useSLAStatus;
        private string _useVUDs;
        private string _workDirectory = @"C:\Temp\PC.Plugins.Automation.Logs\{0}";
        private string _logFileName = "PC.Plugins.Automation.Logs.log";
        private string _timeslotRepeat;
        private string _timeslotRepeatDelay;
        private string _timeslotRepeatAttempts;
        //private string _description;


        public string PCServerURL
        {
            get { return _pcServerURL; }
            set { _pcServerURL = value; }
        }
        public string PCServerAndPort
        {
            get { return _pcServerAndPort; }
            set { _pcServerAndPort = value; }
        }
        public string PCServername
        {
            get { return _pcServername; }
            set { _pcServername = value; }
        }

        public string WebProtocol
        {
            get { return _webProtocol; }
            set { _webProtocol = value; }
        }
        public string PCUserName
        {
            get { return _pcUserName; }
            set { _pcUserName = value; }
        }

        public string PCPassword
        {
            get { return _pcPassword; }
            set { _pcPassword = value; }
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
        public string TestID
        {
            get { return _testID; }
            set { _testID = value; }
        }
        public string AutoTestInstance
        {
            get { return _autoTestInstance; }
            set { _autoTestInstance = value; }
        }
        public string TestInstanceID
        {
            get { return _testInstanceID; }
            set { _testInstanceID = value; }
        }
        public string PCPostRunAction
        {
            get { return _pcPostRunAction; }
            set { _pcPostRunAction = value; }
        }
        public string ProxyURL
        {
            get { return _proxyURL; }
            set { _proxyURL = value; }
        }
        public string ProxyUserName
        {
            get { return _proxyUserName; }
            set { _proxyUserName = value; }
        }
        public string ProxyPassword
        {
            get { return _proxyPassword; }
            set { _proxyPassword = value; }
        }

        public string Trending
        {
            get { return _trending; }
            set { _trending = value; }
        }

        public string TrendReportID
        {
            get { return _trendReportID; }
            set { _trendReportID = value; }
        }
        public string TimeslotDurationHours
        {
            get { return TimeslotDurationHours; }
            set { _timeslotDurationHours = value; }
        }
        public string TimeslotDurationMinutes
        {
            get { return _timeslotDurationMinutes; }
            set { _timeslotDurationMinutes = value; }
        }

        public string UseSLAStatus
        {
            get { return _useSLAStatus; }
            set { _useSLAStatus = value; }
        }
        public string UseVUDs
        {
            get { return _useVUDs; }
            set { _useVUDs = value; }
        }
        public string WorkDirectory
        {
            get { return _workDirectory; }
            set { _workDirectory = value; }
        }
        public string LogFileName
        {
            get { return _logFileName; }
            set { _logFileName = value; }
        }

        public string _Description
        {
            get { return _workDirectory; }
            set { _workDirectory = value; }
        }

        public string TimeslotRepeat
        {
            get { return _timeslotRepeat; }
            set { _timeslotRepeat = value; }
        }


        public string TimeslotRepeatDelay
        {
            get { return _timeslotRepeatDelay; }
            set { _timeslotRepeatDelay = value; }
        }

        public string TimeslotRepeatAttempts
        {
            get { return _timeslotRepeatAttempts; }
            set { _timeslotRepeatAttempts = value; }
        }




        public Configurator(string pcServerURL, string pcUserName, string pcPassword, string domain, string project,
            string testID, string autoTestInstance, string testInstanceID, string pcPostRunAction,
            string proxyURL, string proxyUserName, string proxyPassword,
            string trending, string trendReportID, string timeslotDurationHours, string timeslotDurationMinutes,
            string useSLAStatus, string useVUDs, string workDirectory = "", string logFileName = "", string description = "", 
            string timeslotRepeat = "DoNotRepeat", string timeslotRepeatDelay = "5", string timeslotRepeatAttempts = "3")
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
            _trending = trending;
            _trendReportID = (trending == "UseTrendReportID" && trendReportID != "Enter Trend Report ID") ? trendReportID : "";
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

            int intTimeslotRepeatDelay;
            int intTimeslotRepeatAttempts;
            _timeslotRepeat = "RepeatWithParameters".Equals(timeslotRepeat)? timeslotRepeat: "DoNotRepeat";
            _timeslotRepeatDelay = int.TryParse(timeslotRepeatDelay, out intTimeslotRepeatDelay) && intTimeslotRepeatDelay > 1 ? timeslotRepeatDelay : "1";
            _timeslotRepeatAttempts = int.TryParse(timeslotRepeatAttempts, out intTimeslotRepeatAttempts) && intTimeslotRepeatAttempts > 2 ? timeslotRepeatAttempts : "2";

            _pcBuilder = new PCBuilder(_pcServerAndPort, _pcServername, _pcUserName, _pcPassword, _domain,
                _project, _testID, _autoTestInstance.ToLower() == "true", _testInstanceID, _timeslotDurationHours, _timeslotDurationMinutes,
                _pcPostRunAction, _useVUDs.ToLower() == "true", _useSLAStatus.ToLower() == "true", _description,
                _trending, _trendReportID, _webProtocol == "https",
                _proxyURL, _proxyUserName, _proxyPassword, _workDirectory, _logFileName, _timeslotRepeat, _timeslotRepeatDelay, _timeslotRepeatAttempts);

            _pcRestProxy = new PCRestProxy(_webProtocol, _pcServerAndPort, domain, project, proxyURL, proxyUserName, proxyPassword);

        }

        public void Perform()
        {
            System.Threading.Thread thread = new System.Threading.Thread(_pcBuilder.Perform);
            thread.Start();
        }

        public bool TestConnection()
        {
            Helper.CheckedConnection = _pcRestProxy.Authenticate(_pcUserName, _pcPassword);
            return Helper.CheckedConnection;
        }


        public static bool IsLogFileEnded(string FullFilename)
        {
            bool isLogFileEnded = true;
            if (File.Exists(FullFilename))
            {
                string contents = File.ReadAllText(FullFilename);
                isLogFileEnded = contents.EndsWith(END_OF_LOG_FILE) || contents.Contains(END_OF_LOG_FILE);
            }

            return isLogFileEnded;
        }

        public static string GetNewContent(string FullFilename)
        {
            string[] newContentArray;
            string[] oldContentArray;
            string newContent = "";

            long lastPositionPreviouslyRead = 0;

            string FullFilenameDuplicated = FullFilename + "duplicated";
            string FullFileNamePreviouslyRead = FullFilename + "previouslyRead";

            if (File.Exists(FullFilename))
            {
                //if file was already read, we continue from the last position
                if (File.Exists(FullFilename + "previouslyRead"))
                {
                    oldContentArray = ReadAllLinesFromPosition(FullFileNamePreviouslyRead, ref lastPositionPreviouslyRead);
                }
                File.Copy(FullFilename, FullFilenameDuplicated);

                newContentArray = ReadAllLinesFromPosition(FullFilename, ref lastPositionPreviouslyRead);
                newContent = newContentArray.Length > 0 ? String.Join("\r\n", newContentArray) : "";

                if (File.Exists(FullFileNamePreviouslyRead))
                {
                    File.Delete(FullFileNamePreviouslyRead);
                }
                File.Move(FullFilenameDuplicated, FullFileNamePreviouslyRead);
            }

            return newContent;
        }

        private static string[] ReadAllLinesFromPosition(string fileName, ref long position)
        {
            using (FileStream fileStream = File.OpenRead(fileName))
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


    }
}
