using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using PC.Plugins.Common.Rest;
using PC.Plugins.Common.Constants;
using PC.Plugins.Common.PCEntities;

namespace PC.Plugins.Common.Test
{
    /// <summary>
	///*
	/// 
	/// @author Daniel Danan
    /// 
    /// Simple application having for purpose the testing of PC.Plugins.Common functions
	/// 
	/// </summary>
    public partial class Test : Form
    {

        //bool AuthenticationStatus = false;
        
        IPCRestProxy pcRestProxy;
        bool _authenticated = false;

        public Test()
        {
            InitializeComponent();
            CustomInit();
        }
        
        private void CustomInit()
        {

        }


        private void Test_Load(object sender, EventArgs e)
        {
            pcRestProxy = new PCRestProxy(
                cmbWebProtocol.Text,
                txtPCServerAndPort.Text,
                txtDomain.Text,
                txtProject.Text,
                txtProxyUrl.Text,
                txtProxyUser.Text,
                txtProxyPassword.Text
                );
            _authenticated = pcRestProxy.Authenticate(txtPCUserName.Text, txtPCPassword.Text);
        }

        private void btnAuthenticate_Click(object sender, EventArgs e)
        {
            pcRestProxy = new PCRestProxy(
                cmbWebProtocol.Text, 
                txtPCServerAndPort.Text, 
                txtDomain.Text, 
                txtProject.Text, 
                txtProxyUrl.Text, 
                txtProxyUser.Text, 
                txtProxyPassword.Text 
                );

            bool authenticated = pcRestProxy.Authenticate(txtPCUserName.Text, txtPCPassword.Text);

            if (authenticated)
            {
                btnAuthenticate.Text = "Authenticated";
                btnAuthenticate.BackColor = Color.Green;
            }
            else
            {
                btnAuthenticate.Text = "Authentication failed";
                btnAuthenticate.BackColor = Color.Red;
            }


        }

        private void btnStartRun_Click(object sender, EventArgs e)
        {
            pcRestProxy = new PCRestProxy(
                cmbWebProtocol.Text,
                txtPCServerAndPort.Text,
                txtDomain.Text,
                txtProject.Text,
                txtProxyUrl.Text,
                txtProxyUser.Text,
                txtProxyPassword.Text
                );
            PC.Plugins.Common.PCEntities.PCRunResponse pcRunResponse = pcRestProxy.StartRun(
                int.Parse(txtPCUserName.Text),
                int.Parse(txtPCPassword.Text), 
                new PC.Plugins.Common.PCEntities.PCTimeslotDuration(10),
                PC.Plugins.Common.Constants.PCConstants.PostRunActions.DoNotCollate.ToString(), 
                false
                );

        }

        private void btnGetAllTestSets_Click(object sender, EventArgs e)
        {

            PCTestSets pcTestSets = pcRestProxy.GetAllTestSets();
            if (pcTestSets != null)
            {
                dgvForAll.DataSource = pcTestSets.PCTestSetsList;
                btnGetAllTestSets.Text = "TestSets received";
                btnGetAllTestSets.BackColor = Color.Green;
            }
            else
            {
                btnGetAllTestSets.Text = "TestSets not received";
                btnGetAllTestSets.BackColor = Color.Red;
            }
        }

        private void btnGetAllTestInstances_Click(object sender, EventArgs e)
        {


            PCTestInstances pcTestInstances = pcRestProxy.GetTestInstancesByTestId(int.Parse(txtTestID.Text));
            if (pcTestInstances != null)
            {
                dgvForAll.DataSource = pcTestInstances.TestInstancesList;
                btnGetAllTestInstances.Text = "TestInstances received";
                btnGetAllTestInstances.BackColor = Color.Green;
            }
            else
            {
                btnGetAllTestInstances.Text = "TestInstances not received";
                btnGetAllTestInstances.BackColor = Color.Red;
            }
        }

        private void btnRunData_Click(object sender, EventArgs e)
        {

            PCRunResponse pcRunResponse = pcRestProxy.GetRunData(int.Parse(txtRunID.Text));
            if (pcRunResponse != null)
            {
                List<PCRunResponse> pcRunResponseList = new List<PCRunResponse>();
                pcRunResponseList.Add(pcRunResponse);
                dgvForAll.DataSource = pcRunResponseList;
                btnRunData.Text = "RunData received";
                btnRunData.BackColor = Color.Green;
            }
            else
            {
                btnRunData.Text = "RunData not received";
                btnRunData.BackColor = Color.Red;
            }


        }

        private void btnTestData_Click(object sender, EventArgs e)
        {

            PCTest pcTest = pcRestProxy.GetTestData(int.Parse(txtTestID.Text));
            if (pcTest != null)
            {
                List<PCTest> pcTestList = new List<PCTest>();
                pcTestList.Add(pcTest);
                dgvForAll.DataSource = pcTestList;
                btnTestData.Text = "TestData received";
                btnTestData.BackColor = Color.Green;
            }
            else
            {
                btnTestData.Text = "TestData not received";
                btnTestData.BackColor = Color.Red;
            }

        }

        private void btnRunResult_Click(object sender, EventArgs e)
        {


            PCRunResults pcRunResults = pcRestProxy.GetRunResults(int.Parse(txtRunID.Text));
            if (pcRunResults != null)
            {
                dgvForAll.DataSource = pcRunResults.ResultsList;
                btnRunResult.Text = "pcRunResults received";
                btnRunResult.BackColor = Color.Green;
            }
            else
            {
                btnRunResult.Text = "TestData not received";
                btnRunResult.BackColor = Color.Red;
            }


        }

        private void btnRunResultData_Click(object sender, EventArgs e)
        {
            PCRunResults pcRunResults = pcRestProxy.GetRunResults(int.Parse(txtRunID.Text));

            
            
            string localFilePath = @"c:\temp\GetRunResultData\";
            bool RunResultDataReturned = true;

            foreach (PCRunResult pcRunResult in pcRunResults.ResultsList)
            {
                RunResultDataReturned = RunResultDataReturned?pcRestProxy.GetRunResultData(int.Parse(txtRunID.Text), pcRunResult.ID, localFilePath + pcRunResult.RunID + "\\"  + pcRunResult.Name) :false;
            }

            if (RunResultDataReturned)
            {
                btnRunResultData.Text = "RunResultData received in " + localFilePath;
                btnRunResultData.BackColor = Color.Green;
            }
            else
            {
                btnRunResultData.Text = "TestData not received";
                btnRunResultData.BackColor = Color.Red;
            }
        }

        private void btnRunEventLog_Click(object sender, EventArgs e)
        {


            PCRunEventLog pcRunEventLog = pcRestProxy.GetRunEventLog(int.Parse(txtRunID.Text));
            if (pcRunEventLog != null)
            {
                dgvForAll.DataSource = pcRunEventLog.RecordsList;
                btnRunEventLog.Text = "pcRunResults received";
                btnRunEventLog.BackColor = Color.Green;
            }
            else
            {
                btnRunEventLog.Text = "TestData not received";
                btnRunEventLog.BackColor = Color.Red;
            }

        }

        private void btnLogout_Click(object sender, EventArgs e)
        {
            bool authenticated = !pcRestProxy.Logout();
            
            btnAuthenticate.Enabled = authenticated;
            if (authenticated)
            {
                btnLogout.Text = "Logout failed";
                btnLogout.BackColor = Color.Red;
            }
            else
            {
                btnLogout.Text = "Logout Succeeded";
                btnLogout.BackColor = Color.Green;
            }
        }

        private void btnStopRun_Click(object sender, EventArgs e)
        {
            bool runStopped = pcRestProxy.StopRun(int.Parse(txtRunID.Text), "stop");
            if (runStopped)
            {
                btnStopRun.Text = "Run Stopped received";
                btnStopRun.BackColor = Color.Green;
            }
            else
            {
                btnStopRun.Text = "Run not stopped";
                btnStopRun.BackColor = Color.Red;
            }
        }

        private void btnCreateTestInstance_Click(object sender, EventArgs e)
        {
            int testInstance = pcRestProxy.CreateTestInstance(int.Parse(txtTestID.Text), int.Parse(txtTestSetID.Text));
            if(testInstance!=0)
            {
                btnCreateTestInstance.Text = "TestInstance " + testInstance + " created";
                btnCreateTestInstance.BackColor = Color.Green;
            }
            else
            {
                btnCreateTestInstance.Text = "TestInstance Not create";
                btnCreateTestInstance.BackColor = Color.Red;
            }
        }

        private void btnTrendReport_Click(object sender, EventArgs e)
        {
            string fullFileName = @"C:\Temp\GetTrendingPDF\7\trendreport6.pdf";
            bool trendReportReturned = pcRestProxy.GetTrendingPDF(int.Parse(txtTrendReportID.Text), fullFileName);
            if (trendReportReturned)
            {
                btnTrendReport.Text = "TrendReport downloaded";
                btnTrendReport.BackColor = Color.Green;
            }
            else
            {
                btnTrendReport.Text = "TrendReport not downloaded";
                btnTrendReport.BackColor = Color.Red;
            }

        }

        private void btnStartRun_Click_1(object sender, EventArgs e)
        {
            int testInstanceId = int.Parse(txtTestInstanceID.Text);
            PCTimeslotDuration timeslotDuration = new PCTimeslotDuration(30);
            string postRunAction = "Collate And Analyze";
            bool vudsMode = false;
            PCRunResponse pcRunResponse = pcRestProxy.StartRun(int.Parse(txtTestID.Text), testInstanceId, timeslotDuration, postRunAction, vudsMode);
            if (pcRunResponse != null)
            {
                List<PCRunResponse> pcRunResponseList = new List<PCRunResponse>();
                pcRunResponseList.Add(pcRunResponse);
                dgvForAll.DataSource = pcRunResponseList;
                btnStartRun.Text = "RunID " + pcRunResponse.ID + " created";
                btnStartRun.BackColor = Color.Green;
            }
            else
            {
                btnStartRun.Text = "no run started";
                btnStartRun.BackColor = Color.Red;
            }
        }

        private void btnTrendReportByXml_Click(object sender, EventArgs e)
        {

            PCTrendReportRoot trendReportRoot = pcRestProxy.GetTrendReport(int.Parse(txtTrendReportID.Text), int.Parse(txtRunID.Text));
            if (trendReportRoot != null)
            {
                RootTransactionsDataRow[] rootTransactionsDataRowArray = trendReportRoot.TransactionsData;
                List<RootTransactionsDataRow> rootTransactionsDataRowlist = rootTransactionsDataRowArray.OfType<RootTransactionsDataRow>().ToList();
                dgvForAll.DataSource = rootTransactionsDataRowlist;
                btnTrendReportByXml.Text = "trend report received";
                btnTrendReportByXml.BackColor = Color.Green;
            }
            else
            {
                btnTrendReportByXml.Text = "Failed to get trend report";
                btnTrendReportByXml.BackColor = Color.Red;
            }
        }

        private void btnAllTrendReports_Click(object sender, EventArgs e)
        {

            PCTrendReports trendReports = pcRestProxy.GetAllTrendReports();
            if (trendReports!= null)
            {
                dgvForAll.DataSource = trendReports.TrendReport;
                btnAllTrendReports.Text = "All trend reports received";
                btnAllTrendReports.BackColor = Color.Green;
            }
            else
            {
                btnAllTrendReports.Text = "All trend reports not received";
                btnAllTrendReports.BackColor = Color.Red;
            }
        }

        private void btnUpdateTrendReports_Click(object sender, EventArgs e)
        {
            PCTimeInterval startTime = new PCTimeInterval(1,2,36,8);
            PCTimeInterval endTime = new PCTimeInterval(1,3,45,19);
            PCTrendedRange trendedRange = new PCTrendedRange(startTime, endTime);
            PCTrendReportRequest trendReportRequest = new PCTrendReportRequest(txtProject.Text, int.Parse(txtRunID.Text), trendedRange);
            bool trendReportUpdated = pcRestProxy.UpdateTrendReport(txtTrendReportID.Text, trendReportRequest);
            if (trendReportUpdated)
            {
                btnUpdateTrendReports.Text = "TrendReport updated";
                btnUpdateTrendReports.BackColor = Color.Green;
            }
            else
            {
                btnUpdateTrendReports.Text = "TrendReport not updated";
                btnUpdateTrendReports.BackColor = Color.Red;
            }
        }

        private void btnTrendReportMetadata_Click(object sender, EventArgs e)
        {
            
            PCTrendReport pcTrendedRuns = pcRestProxy.GetTrendReportMetaData(txtTrendReportID.Text);
            if (pcTrendedRuns!=null)
            {
                dgvForAll.DataSource = pcTrendedRuns.TrendedRuns;
                btnTrendReportMetadata.Text = "TrendReport updated";
                btnTrendReportMetadata.BackColor = Color.Green;
            }
            else
            {
                btnTrendReportMetadata.Text = "TrendReport not updated";
                btnTrendReportMetadata.BackColor = Color.Red;
            }
        }

        private void btnUploadScript_Click(object sender, EventArgs e)
        {
            PCScript pcScript = new PCScript("subject\\mynewscript", true, true, true);
            int vuGentestID = pcRestProxy.UploadVugenScript(pcScript, @"C:\Users\dananda\Desktop\SUT_01_EventsSimulationUtility_leonid.zip");
            if (vuGentestID != 0)
            {
                //dgvForAll.DataSource = pcTrendedRuns.TrendedRuns;
                btnUploadScript.Text = "script uploaded";
                btnUploadScript.BackColor = Color.Green;
            }
            else
            {
                btnUploadScript.Text = "script not uploaded";
                btnUploadScript.BackColor = Color.Red;
            }
        }
    }
}
