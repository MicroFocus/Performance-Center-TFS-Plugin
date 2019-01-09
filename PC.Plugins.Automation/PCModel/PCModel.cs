using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using PC.Plugins.Common.PCEntities;
using System.Security;
using System.Runtime.InteropServices;


namespace PC.Plugins.Automation
{
    //[ComVisible(true)]
    public class PCModel : IPCModel
    {
        private string _pcServerAndPort;
        private string _pcServerName;
        private string _userName;
        private string _password;
        private string _domain;
        private string _project;
        private string _testId;
        private bool _autoTestInstance;
        private string _testInstanceId;
        private PCTimeslotDuration _pcTimeslotDuration;
        private PCPostRunActionsRequest _pcPostRunActionsRequest;
        private bool _vudsMode;
        private string _description;
        private string _addRunToTrendReport;
        private string _trendReportId;
        private bool _httpsProtocol;
        private string _proxyOutURL;
        private string _proxyOutUser;
        private string _proxyOutPassword;
        private string _buildParameters;
        private string _timeslotRepeat;
        private string _timeslotRepeatDelay;
        private string _timeslotRepeatAttempts;

        public PCModel(string pcServerAndPort, string pcServerName, string userName, string password, string domain, string project,
                   String testId, bool autoTestInstanceID, string testInstanceId, string timeslotDurationHours, string timeslotDurationMinutes,
                   PCPostRunActionsRequest pcPostRunActionsRequest, bool vudsMode, string description, string addRunToTrendReport, string trendReportId,
                   bool httpsProtocol, string proxyOutURL, string proxyOutUser, string proxyOutPassword,
                   string timeslotRepeat, string timeslotRepeatDelay, string timeslotRepeatAttempts)
        {

            this._pcServerAndPort = pcServerAndPort;
            this._pcServerName = pcServerName.Replace(" ", "");
            this._userName = userName.Replace(" ", "");
            //this._password = setPassword(almPassword);
            this._password = password;
            this._domain = domain.Replace(" ", "");
            this._project = project.Replace(" ", "");
            this._testId = testId.Replace(" ", "");
            this._autoTestInstance = autoTestInstanceID;
            this._testInstanceId = testInstanceId;
            this._pcTimeslotDuration = new PCTimeslotDuration(timeslotDurationHours, timeslotDurationMinutes);
            this._pcPostRunActionsRequest = pcPostRunActionsRequest;
            this._vudsMode = vudsMode;
            this._description = description;
            this._addRunToTrendReport = addRunToTrendReport;
            this._httpsProtocol = httpsProtocol;
            this._trendReportId = trendReportId;
            this._proxyOutURL = proxyOutURL;
            this._proxyOutUser = proxyOutUser;
            this._proxyOutPassword = proxyOutPassword;
            this._buildParameters = "";
            this._timeslotRepeat = "RepeatWithParameters".Equals(timeslotRepeat) ? timeslotRepeat : "DoNotRepeat";
            this._timeslotRepeatDelay = verifyIntegerAndlimits(timeslotRepeatDelay, 1, 10, 1);
            this._timeslotRepeatAttempts = verifyIntegerAndlimits(timeslotRepeatAttempts, 2, 10, 2);

        }

        public PCModel() { }

        public string PCServerAndPort
        {
            get { return _pcServerAndPort; }
            set { _pcServerAndPort = value; }
        }

        public string PCServerName
        {
            get { return _pcServerName; }
            set { _pcServerName = value; }
        }

        public string UserName
        {
            get { return _userName; }
            set { _userName = value; }
        }

        public string Password
        {
            get { return _password; }
            set { _password = value; }
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

        public string TestId
        {
            get { return _testId; }
            set { _testId = value; }
        }

        public bool AutoTestInstance
        {
            get { return _autoTestInstance; }
            set { _autoTestInstance = value; }
        }

        public string TestInstanceId
        {
            get { return _testInstanceId; }
            set { _testInstanceId = value; }
        }

        public PCTimeslotDuration PCTimeslotDuration
        {
            get { return _pcTimeslotDuration; }
            set { _pcTimeslotDuration = value; }
        }

        public PCPostRunActionsRequest PCPostRunActionsRequest
        {
            get { return _pcPostRunActionsRequest; }
            set { _pcPostRunActionsRequest = value; }
        }

        public bool VUDsMode
        {
            get { return _vudsMode; }
            set { _vudsMode = value; }
        }

        public string Description
        {
            get { return _description; }
            set { _description = value; }
        }

        public string AddRunToTrendReport
        {
            get { return _addRunToTrendReport; }
            set { _addRunToTrendReport = value; }
        }

        public string TrendReportId
        {
            get { return _trendReportId; }
            set { _trendReportId = value; }
        }

        public bool HTTPSProtocol
        {
            get { return _httpsProtocol; }
            set { _httpsProtocol = value; }
        }

        public string ProxyOutURL
        {
            get { return _proxyOutURL; }
            set { _proxyOutURL = value; }
        }

        public string ProxyOutUser
        {
            get { return _proxyOutUser; }
            set { _proxyOutUser = value; }
        }

        public string ProxyOutPassword
        {
            get { return _proxyOutPassword; }
            set { _proxyOutPassword = value; }
        }

        public string BuildParameters
        {
            get { return _buildParameters; }
            set { _buildParameters = value; }
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

        public string isHTTPSProtocol()
        {
            if (!HTTPSProtocol)
                return "http";
            return "https";
        }

        public bool isVudsMode() => this._vudsMode;

        public string GetAddRunToTrendReport
        {
            get { return _addRunToTrendReport; }
        }

        public string runParamsToString()
        {

            string vudsModeString = (_vudsMode) ? "true" : "false";
            string trendString = ("USE_ID").Equals(_addRunToTrendReport) ? String.Format(", TrendReportID = '{0}'", _trendReportId) : "";

            return String.Format("[PCServer='{0}', User='{0}', Domain='{0}', Project='{0}', TestID='{0}', " +
                            "TestInstanceID='{0}', TimeslotDuration='{0}', PostRunAction='{0}', " +
                            "VUDsMode='{0}'{0}, HTTPSProtocol='{0}']",

                    _pcServerName, _userName, _domain, _project, _testId,
                    _testInstanceId, _pcTimeslotDuration, _pcPostRunActionsRequest.ObjectToXml(),
                    vudsModeString, trendString, HTTPSProtocol);
        }

        private string verifyIntegerAndlimits(string strValue, int min, int max, int defaultValue)
        {
            try
            {
                int intValue;
                string newValue = defaultValue.ToString();
                int.TryParse(strValue.Replace(" ", ""), out intValue);
                if (intValue < min)
                    newValue = min.ToString();
                else if (intValue > max)
                    newValue = max.ToString();
                else
                    newValue = intValue.ToString();
                return newValue;
            }
            catch
            {
                return defaultValue.ToString();
            }
        }
    }
}
