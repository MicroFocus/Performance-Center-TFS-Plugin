/*!
* (c) 2016-2018 EntIT Software LLC, a OpenText company
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace PC.Plugins.ConfiguratorUI
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        #region fields
        Configurator _configurator;
        private string _instanceId = Guid.NewGuid().ToString();
        private string _workDirectory = @"C:\Temp\PC.Plugins.Automation.Logs\{0}";
        private string _logFileName = "PC.Plugins.Automation.Logs.log";
        #endregion

        #region constructor
        public MainWindow()
        {
            try
            {
                Helper.CheckedConnection = false;
                InitializeComponent();
            }
            catch { }
        }
        #endregion

        private void TestConnectionButton_OnClick(object sender, RoutedEventArgs e)
        {
            ReadFields();
            try
            {
                if (String.IsNullOrEmpty(PCServerURL.Text) || String.IsNullOrEmpty(PCUserName.Text))
                {
                    MessageBox.Show("To test the connection, the PC URL and Username (with adequate password) need to be specified.", "PC.Plugins.ConfiguratorUI", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.OK);
                    return;
                }
                Helper.CheckedConnection = _configurator.TestConnection();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "PC.Plugins.ConfiguratorUI", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.OK);
                return;
            }
            if (Helper.CheckedConnection)
                MessageBox.Show("Connection successfull", "PC.Plugins.ConfiguratorUI", MessageBoxButton.OK, MessageBoxImage.Information, MessageBoxResult.OK);
            else
                MessageBox.Show("Connection Failed", "PC.Plugins.ConfiguratorUI", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.OK);
        }


        private void RunButton_OnClick(object sender, RoutedEventArgs e)
        {
            try
            {
                ReadFields();
                System.Threading.Thread thread = new System.Threading.Thread(_configurator.Perform);
                thread.Start();
                string reportfile = System.IO.Path.Combine(_workDirectory, _logFileName);
                DisplayReportInPSConsole(System.IO.Path.Combine(reportfile));
            }
            catch (Exception ex)
            {
                const string error = "Error while trying to run the test from the plugin. Error: {0}. \n {1}";
                MessageBox.Show(string.Format(error, ex.Message, ex), "PC.Plugins.ConfiguratorUI", MessageBoxButton.OK, MessageBoxImage.Error, MessageBoxResult.OK);
            }
        }

        private void ReadFields()
        {
            string pcServerURL = PCServerURL.Text;
            bool useTokenForAuthentication = UseTokenForAuthentication.IsChecked == true;
            string pcServerAndPort = PCServerURL.Text.Trim().Replace("https://", "").Replace("http://", "");
            string pcServername = (pcServerAndPort.LastIndexOf(':') == -1) ? pcServerAndPort : pcServerAndPort.Substring(0, (pcServerAndPort.LastIndexOf(':')));
            string webProtocol = PCServerURL.Text.Trim().StartsWith("https") ? "https" : "http";
            string pcUserName = PCUserName.Text;
            string pcPassword = PCPassword.Password;
            string domain = Domain.Text;
            string project = Project.Text;
            string testID = TestID.Text;
            bool autoTestInstance = AutoTestInstance.IsChecked == true;
            string testInstanceID = (autoTestInstance == false && TestInstanceID.Text != "Enter Test Instance ID") ? TestInstanceID.Text : "";
            string pcPostRunAction = PostRunAction.SelectionBoxItem.ToString();
            string proxyURL = ProxyURL.Text;
            string proxyUserName = ProxyUserName.Text;
            string proxyPassword = ProxyPassword.Password;
            string trending = (DoNotTrend.IsChecked == true) ? "DoNotTrend" : (AssociatedTrend.IsChecked == true) ? "AssociatedTrend" : "UseTrendReportID";
            string trendReportID = (trending == "UseTrendReportID" && TrendReportID.Text != "Enter Trend Report ID") ? TrendReportID.Text : "";
            string timeslotDurationHours = "";
            string timeslotDurationMinutes = ValidateTimeSlotDuration();
            bool useSLAStatus = UseSLAStatus.IsChecked == true;
            bool useVUDs = UseVUDs.IsChecked == true;
            string description = "";
            string timeslotRepeat = (DoNotRepeat.IsChecked ?? true) ? "DoNotRepeat" : "RepeatWithParameters";
            string timeslotRepeatDelay = TimeslotRepeatDelay.Text;
            string timeslotRepeatAttempts = TimeslotRepeatAttempts.Text;

            Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
            _workDirectory = string.Format(_workDirectory, unixTimestamp.ToString());

            _configurator = new Configurator(pcServerURL, useTokenForAuthentication.ToString(), pcUserName, pcPassword, domain, project, testID,
                autoTestInstance.ToString(), testInstanceID, pcPostRunAction, 
                proxyURL, proxyUserName, proxyPassword,
                trending, trendReportID, timeslotDurationHours, timeslotDurationMinutes,
                useSLAStatus.ToString(), useVUDs.ToString(), _workDirectory, _logFileName, description,
                timeslotRepeat, timeslotRepeatDelay, timeslotRepeatAttempts);
        }

        private void MainWindow_OnClosing(object sender, CancelEventArgs e)
        {
        }

        private void CancelButton_OnClick(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        private void MainWindow_OnMouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
                this.DragMove();
        }

        private void HandleTestInstanceCheck(object sender, RoutedEventArgs e)
        {
            try
            {
                if (TestInstanceID != null)
                {
                    RadioButton rb = sender as RadioButton;
                    TestInstanceID.IsEnabled = (rb.Name == "SpecifyTestInstance");
                    TestInstanceID.Text = (rb.Name == "SpecifyTestInstance") ? "Enter Test Instance ID" : "";
                    TestInstanceID.SelectAll();
                    MoveToNextUIElement(e);
                }
            }
            catch
            { }
        }

        private void HandleTrendCheck(object sender, RoutedEventArgs e)
        {
            try
            {
                if (TrendReportID != null)
                {
                    RadioButton rb = sender as RadioButton;
                    TrendReportID.IsEnabled = (rb.Name == "UseTrendReportID");
                    TrendReportID.Text = (rb.Name == "UseTrendReportID") ? "Enter Trend Report ID" : "";
                    TrendReportID.SelectAll();
                    MoveToNextUIElement(e);
                }
            }
            catch
            { }
        }

        private void HandleTimeslotRepeat(object sender, RoutedEventArgs e)
        {
            try
            {
                if (TimeslotRepeatDelay != null && TimeslotRepeatAttempts != null)
                {
                    RadioButton rb = sender as RadioButton;
                    TimeslotRepeatDelay.IsEnabled = (rb.Name == "RepeatWithParameters");
                    TimeslotRepeatAttempts.IsEnabled = (rb.Name == "RepeatWithParameters");
                    TimeslotRepeatDelay.Text = (rb.Name == "RepeatWithParameters") ? "Enter the delay between attempts" : "";
                    TimeslotRepeatAttempts.Text = (rb.Name == "RepeatWithParameters") ? "Enter the number of attempts" : "";
                    TimeslotRepeatDelay.SelectAll();
                    TimeslotRepeatAttempts.SelectAll();
                    MoveToNextUIElement(e);
                }
            }
            catch
            { }
        }

        void MoveToNextUIElement(RoutedEventArgs e)
        {
            // Creating a FocusNavigationDirection object and setting it to a
            // local field that contains the direction selected.
            FocusNavigationDirection focusDirection = FocusNavigationDirection.Next;

            // MoveFocus takes a TraveralReqest as its argument.
            TraversalRequest request = new TraversalRequest(focusDirection);

            // Gets the element with keyboard focus.
            UIElement elementWithFocus = Keyboard.FocusedElement as UIElement;

            // Change keyboard focus.
            if (elementWithFocus != null)
            {
                if (elementWithFocus.MoveFocus(request)) e.Handled = true;
            }
        }

        void DisplayReportInPSConsole (string reportFile)
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = string.Format("Get-Content -Path {0} -Wait", reportFile);
            Process process = new Process();
            process.StartInfo = psi;
            process.Start();
        }

        private void DoNotCollate_Selected(object sender, RoutedEventArgs e)
        {
            DoNotTrend.IsChecked = true;
            TrendPanel.IsEnabled = false;
        }

        private void DoNotCollate_Not_Selected(object sender, RoutedEventArgs e)
        {
            if(TrendPanel!= null)
                TrendPanel.IsEnabled = true;
        }

        private string ValidateTimeSlotDuration ()
        {
            string timeslotDurationMinutes = "30";
            if (string.IsNullOrWhiteSpace(TimeslotDurationMinutes.Text))
            {
                TimeslotDurationMinutes.Text = timeslotDurationMinutes;
            }
            else
            {
                int n;
                bool isTimeslotDurationMinutesNumeric = int.TryParse(TimeslotDurationMinutes.Text, out n);
                if (!isTimeslotDurationMinutesNumeric)
                {
                    TimeslotDurationMinutes.Text = "30";
                }
                else
                {
                    if (int.Parse(TimeslotDurationMinutes.Text) < 30)
                    {
                        TimeslotDurationMinutes.Text = "30";
                    }
                    else
                    {
                        if (int.Parse(TimeslotDurationMinutes.Text) > 28800)
                        {
                            timeslotDurationMinutes = "28800";
                            TimeslotDurationMinutes.Text = "28800";
                        }
                        else
                        {
                            timeslotDurationMinutes = TimeslotDurationMinutes.Text;
                        }
                    }
                }
            }
            return timeslotDurationMinutes;
        }
    }
}
