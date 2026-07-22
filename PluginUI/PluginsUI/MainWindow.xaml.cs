/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 *
 * MainWindow.xaml.cs — code-behind for PluginsUI
 *
 * Key design choices:
 *  • TabControl — Tab 0 "CI Test Run" (LreCiTask), Tab 1 "Workspace Sync" (LreWorkspaceSyncTask).
 *  • Connection and Proxy sections are shared above the tab control.
 *  • Run/Stop buttons at the bottom work for whichever tab is active.
 *  • Two separate auto-save paths: last-session.json (CI) and last-session-sync.json (Sync).
 *  • Save Config / Load Config operates on the currently active tab's config only.
 *  • No references to PC.Plugins.* assemblies — fully standalone.
 *  • async/await throughout — the UI never blocks.
 *  • Real-time streaming RichTextBox output with colour-coded lines.
 */

using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Microsoft.Win32;
using PluginsUI.Models;
using PluginsUI.Services;

namespace PluginsUI;

public partial class MainWindow : Window
{
    // ─────────────────────────────────────────────────────────────────────────
    // Fields
    // ─────────────────────────────────────────────────────────────────────────

    private static readonly string _autoSavePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PluginsUI", "last-session.json");

    private static readonly string _autoSaveSyncPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PluginsUI", "last-session-sync.json");

    private readonly LreTaskRunner          _runner     = new();
    private readonly LreWorkspaceSyncRunner _syncRunner = new();
    private CancellationTokenSource?        _cts;

    private bool IsSyncTab => TaskTabControl.SelectedIndex == 1;

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    public MainWindow()
    {
        InitializeComponent();
        ApplyConfig(ConfigurationService.Load<LreConfiguration>(_autoSavePath));
        ApplySyncConfig(ConfigurationService.Load<LreSyncConfiguration>(_autoSaveSyncPath));
        SetStatus("Ready.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Button handlers
    // ─────────────────────────────────────────────────────────────────────────

    private async void TestConnection_Click(object sender, RoutedEventArgs e)
    {
        var cfg = BuildConfig();          // connection fields are shared — reuse CI build
        SetStatus("Testing connection…");
        TestConnectionButton.IsEnabled = false;

        try
        {
            var (ok, msg) = await LreConnectionTester.TestAsync(
                cfg.ServerUrl,
                cfg.UserName,
                PCPassword.Password,
                cfg.UseTokenForAuthentication,
                cfg.ProxyUrl,
                cfg.ProxyUserName,
                ProxyPassword.Password,
                nodeDistPath: string.IsNullOrWhiteSpace(cfg.NodeDistPath) ? null : cfg.NodeDistPath);

            if (ok)
            {
                SetStatus("Connection successful.");
                MessageBox.Show(msg, "PluginsUI — Connection Test",
                    MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                SetStatus("Connection failed.");
                MessageBox.Show(msg, "PluginsUI — Connection Test",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
        catch (Exception ex)
        {
            SetStatus("Error.");
            MessageBox.Show(ex.Message, "PluginsUI — Connection Test",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            TestConnectionButton.IsEnabled = true;
        }
    }

    private async void Run_Click(object sender, RoutedEventArgs e)
    {
        if (_runner.IsRunning || _syncRunner.IsRunning)
        {
            MessageBox.Show("A task is already running. Use Stop to cancel it first.",
                "PluginsUI", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        if (!ValidateRequiredFields()) return;

        _cts = new CancellationTokenSource();
        var progress = new Progress<string>(AppendOutput);

        SetRunning(true);

        try
        {
            if (IsSyncTab)
            {
                var cfg        = BuildSyncConfig();
                var password   = PCPassword.Password;
                var proxyPwd   = ProxyPassword.Password;

                AppendOutput($"[{DateTime.Now:HH:mm:ss}] Starting workspace sync…");
                var exitCode = await _syncRunner.RunAsync(cfg, password, proxyPwd, progress, _cts.Token);
                SetStatus(exitCode == 0 ? "Sync completed successfully." : $"Sync exited with code {exitCode}.");
            }
            else
            {
                var cfg        = BuildConfig();
                var password   = PCPassword.Password;
                var proxyPwd   = ProxyPassword.Password;

                AppendOutput($"[{DateTime.Now:HH:mm:ss}] Starting task…");
                var exitCode = await _runner.RunAsync(cfg, password, proxyPwd, progress, _cts.Token);
                SetStatus(exitCode == 0 ? "Task completed successfully." : $"Task exited with code {exitCode}.");
            }
        }
        catch (Exception ex)
        {
            AppendOutput($"[ERROR] {ex.Message}");
            SetStatus("Task failed with an exception.");
        }
        finally
        {
            SetRunning(false);
            _cts?.Dispose();
            _cts = null;
        }
    }

    private void Stop_Click(object sender, RoutedEventArgs e)
    {
        if (!_runner.IsRunning && !_syncRunner.IsRunning) return;
        _cts?.Cancel();
        _runner.Stop();
        _syncRunner.Stop();
        SetStatus("Stopping…");
    }

    private void Close_Click(object sender, RoutedEventArgs e) => Close();

    private void ClearOutput_Click(object sender, RoutedEventArgs e)
        => OutputTextBox.Document.Blocks.Clear();

    // ─────────────────────────────────────────────────────────────────────────
    // Save / Load config
    // ─────────────────────────────────────────────────────────────────────────

    private void SaveConfig_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new SaveFileDialog
        {
            Title      = "Save Configuration",
            Filter     = "JSON configuration (*.json)|*.json|All files (*.*)|*.*",
            DefaultExt = ".json",
            FileName   = IsSyncTab ? "lre-sync-config.json" : "lre-config.json"
        };
        if (dlg.ShowDialog(this) != true) return;

        try
        {
            if (IsSyncTab)
                ConfigurationService.Save(BuildSyncConfig(), dlg.FileName);
            else
                ConfigurationService.Save(BuildConfig(), dlg.FileName);

            SetStatus($"Configuration saved to {Path.GetFileName(dlg.FileName)}.");
            MessageBox.Show(
                $"Configuration saved.\n\nNote: passwords are not included in the saved file.",
                "PluginsUI — Save Config",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not save configuration:\n{ex.Message}",
                "PluginsUI — Save Config", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void LoadConfig_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Title  = "Load Configuration",
            Filter = "JSON configuration (*.json)|*.json|All files (*.*)|*.*"
        };
        if (dlg.ShowDialog(this) != true) return;

        try
        {
            if (IsSyncTab)
            {
                var cfg = ConfigurationService.Load<LreSyncConfiguration>(dlg.FileName);
                ApplySyncConfig(cfg);
            }
            else
            {
                var cfg = ConfigurationService.Load<LreConfiguration>(dlg.FileName);
                ApplyConfig(cfg);
            }
            SetStatus($"Configuration loaded from {Path.GetFileName(dlg.FileName)}.");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not load configuration:\n{ex.Message}",
                "PluginsUI — Load Config", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Browse buttons — CI task
    // ─────────────────────────────────────────────────────────────────────────

    private void BrowseArtifacts_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { Title = "Select Artifacts Directory (CI Task)" };
        if (dlg.ShowDialog(this) == true)
            ArtifactsDirectory.Text = dlg.FolderName;
    }

    private void BrowseNodeDist_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Title  = "Select LreCiTask index.js (bootstrap)",
            Filter = "JavaScript files (index.js)|index.js|All files (*.*)|*.*"
        };
        var guess = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..",
                "angular", "LreCiTask"));
        if (Directory.Exists(guess)) dlg.InitialDirectory = guess;

        if (dlg.ShowDialog(this) == true)
            NodeDistPath.Text = dlg.FileName;
    }

    private void DetectNodeDist_Click(object sender, RoutedEventArgs e)
    {
        var resolved = LreTaskRunner.ResolveDistPath(null);
        if (resolved is not null)
        {
            NodeDistPath.Text = resolved;
            SetStatus($"Auto-detected: {resolved}");
        }
        else
        {
            SetStatus("LreCiTask index.js not found automatically.");
            MessageBox.Show(
                "Could not locate LreCiTask index.js automatically.\n\n" +
                "Build the angular task first:\n" +
                "  cd angular && npm install && npm run build\n\n" +
                "Then use Browse… to select the file manually.",
                "PluginsUI — Detect",
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Browse buttons — Workspace Sync task
    // ─────────────────────────────────────────────────────────────────────────

    private void BrowseSyncWorkspace_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { Title = "Select Workspace Directory to Scan" };
        if (dlg.ShowDialog(this) == true)
            SyncWorkspaceDir.Text = dlg.FolderName;
    }

    private void BrowseSyncArtifacts_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { Title = "Select Artifacts Directory (Sync Task)" };
        if (dlg.ShowDialog(this) == true)
            SyncArtifactsDirectory.Text = dlg.FolderName;
    }

    private void BrowseSyncNodeDist_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Title  = "Select LreWorkspaceSyncTask index.js (bootstrap)",
            Filter = "JavaScript files (index.js)|index.js|All files (*.*)|*.*"
        };
        var guess = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..",
                "angular", "LreWorkspaceSyncTask"));
        if (Directory.Exists(guess)) dlg.InitialDirectory = guess;

        if (dlg.ShowDialog(this) == true)
            SyncNodeDistPath.Text = dlg.FileName;
    }

    private void DetectSyncNodeDist_Click(object sender, RoutedEventArgs e)
    {
        var resolved = LreWorkspaceSyncRunner.ResolveDistPath(null);
        if (resolved is not null)
        {
            SyncNodeDistPath.Text = resolved;
            SetStatus($"Auto-detected: {resolved}");
        }
        else
        {
            SetStatus("LreWorkspaceSyncTask index.js not found automatically.");
            MessageBox.Show(
                "Could not locate LreWorkspaceSyncTask index.js automatically.\n\n" +
                "Build the angular sync task first:\n" +
                "  cd angular && npm install && npm run build\n\n" +
                "Then use Browse… to select the file manually.",
                "PluginsUI — Detect",
                MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Form interaction handlers
    // ─────────────────────────────────────────────────────────────────────────

    private void TogglePassword_Click(object sender, RoutedEventArgs e)
    {
        if (TogglePasswordButton.Content is string label && label == "Show")
        {
            TogglePasswordButton.Content = "Hide";
            PCPasswordVisible.Text       = PCPassword.Password;
            PCPassword.Visibility        = Visibility.Collapsed;
            PCPasswordVisible.Visibility = Visibility.Visible;
            PCPasswordVisible.Focus();
        }
        else
        {
            TogglePasswordButton.Content = "Show";
            PCPassword.Password          = PCPasswordVisible.Text;
            PCPasswordVisible.Visibility = Visibility.Collapsed;
            PCPassword.Visibility        = Visibility.Visible;
        }
    }

    private void TestInstance_Checked(object sender, RoutedEventArgs e)
    {
        if (TestInstanceID is null) return;
        var isManual = SpecifyTestInstance.IsChecked == true;
        TestInstanceID.IsEnabled = isManual;
        if (!isManual) TestInstanceID.Clear();
    }

    private void Trending_Checked(object sender, RoutedEventArgs e)
    {
        if (TrendReportID is null) return;
        var useId = UseTrendReportID.IsChecked == true;
        TrendReportID.IsEnabled = useId;
        if (!useId) TrendReportID.Clear();
    }

    private void TimeslotRepeat_Checked(object sender, RoutedEventArgs e)
    {
        if (TimeslotRepeatDelay is null || TimeslotRepeatAttempts is null) return;
        var repeat = RepeatWithParameters.IsChecked == true;
        TimeslotRepeatDelay.IsEnabled    = repeat;
        TimeslotRepeatAttempts.IsEnabled = repeat;
        if (!repeat)
        {
            TimeslotRepeatDelay.Clear();
            TimeslotRepeatAttempts.Clear();
        }
    }

    private void PostRunAction_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TrendingGroup is null) return;
        var tag = ((ComboBoxItem?)PostRunAction.SelectedItem)?.Tag?.ToString();
        TrendingGroup.IsEnabled = tag != "DoNotCollate";
        if (tag == "DoNotCollate" && DoNotTrend is not null)
            DoNotTrend.IsChecked = true;
    }

    private void TaskTab_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        // Update Run button tooltip to reflect the active task
        if (RunButton is null) return;
        RunButton.ToolTip = IsSyncTab
                ? "Sync workspace scripts to Enterprise Performance Engineering"
            : "Run the performance test";
        SetStatus("Ready.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Window events
    // ─────────────────────────────────────────────────────────────────────────

    private void Window_Closing(object sender, CancelEventArgs e)
    {
        if (_runner.IsRunning || _syncRunner.IsRunning)
        {
            var result = MessageBox.Show(
                "A task is still running. Stop it and close?",
                "PluginsUI", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (result == MessageBoxResult.No) { e.Cancel = true; return; }
            _runner.Stop();
            _syncRunner.Stop();
        }
        _runner.Dispose();
        _syncRunner.Dispose();

        try
        {
            var dir = Path.GetDirectoryName(_autoSavePath)!;
            Directory.CreateDirectory(dir);
            ConfigurationService.Save(BuildConfig(), _autoSavePath);
            ConfigurationService.Save(BuildSyncConfig(), _autoSaveSyncPath);
        }
        catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AutoSave] {ex.Message}"); /* best-effort */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers — build / apply configs
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Read form fields into a new <see cref="LreConfiguration"/> (CI task).</summary>
    private LreConfiguration BuildConfig() => new()
    {
        ServerUrl                 = PCServerURL.Text.Trim(),
        UseTokenForAuthentication = UseTokenForAuthentication.IsChecked == true,
        UserName                  = PCUserName.Text.Trim(),
        Domain                    = Domain.Text.Trim(),
        Project                   = Project.Text.Trim(),
        TestId                    = TestID.Text.Trim(),
        AutoTestInstance          = AutoTestInstance.IsChecked == true,
        TestInstanceId            = (SpecifyTestInstance.IsChecked == true) ? TestInstanceID.Text.Trim() : string.Empty,
        ProxyUrl                  = ProxyURL.Text.Trim(),
        ProxyUserName             = ProxyUserName.Text.Trim(),
        PostRunAction             = ((ComboBoxItem?)PostRunAction.SelectedItem)?.Tag?.ToString() ?? "CollateAndAnalyze",
        Trending                  = DoNotTrend.IsChecked == true ? "DoNotTrend"
                                  : AssociatedTrend.IsChecked == true ? "AssociatedTrend"
                                  : "UseTrendReportID",
        TrendReportId             = UseTrendReportID.IsChecked == true ? TrendReportID.Text.Trim() : string.Empty,
        TimeslotDurationMinutes   = ValidateTimeslotDuration(),
        UseVUDs                   = UseVUDs.IsChecked == true,
        UseSLAInStatus            = UseSLAStatus.IsChecked == true,
        TimeslotRepeat            = RepeatWithParameters.IsChecked == true ? "RepeatWithParameters" : "DoNotRepeat",
        TimeslotRepeatDelay       = TimeslotRepeatDelay.Text.Trim(),
        TimeslotRepeatAttempts    = TimeslotRepeatAttempts.Text.Trim(),
        ArtifactsDirectory        = ArtifactsDirectory.Text.Trim(),
        NodeDistPath              = NodeDistPath.Text.Trim(),
        Description               = DescriptionText.Text.Trim()
    };

    /// <summary>Read form fields into a new <see cref="LreSyncConfiguration"/> (Workspace Sync task).</summary>
    private LreSyncConfiguration BuildSyncConfig() => new()
    {
        ServerUrl                 = PCServerURL.Text.Trim(),
        UseTokenForAuthentication = UseTokenForAuthentication.IsChecked == true,
        UserName                  = PCUserName.Text.Trim(),
        Domain                    = Domain.Text.Trim(),
        Project                   = Project.Text.Trim(),
        ProxyUrl                  = ProxyURL.Text.Trim(),
        ProxyUserName             = ProxyUserName.Text.Trim(),
        WorkspaceDir              = SyncWorkspaceDir.Text.Trim(),
        RuntimeOnly               = SyncRuntimeOnly.IsChecked == true,
        ParallelUploads           = ValidateParallelUploads(),
        SuccessThreshold          = ValidateSuccessThreshold(),
        BaseCommitSha             = SyncBaseCommitSha.Text.Trim(),
        ArtifactsDirectory        = SyncArtifactsDirectory.Text.Trim(),
        NodeDistPath              = SyncNodeDistPath.Text.Trim(),
        Description               = SyncDescriptionText.Text.Trim()
    };

    /// <summary>Populate the CI form from a loaded <see cref="LreConfiguration"/>.</summary>
    private void ApplyConfig(LreConfiguration cfg)
    {
        PCServerURL.Text              = cfg.ServerUrl;
        UseTokenForAuthentication.IsChecked = cfg.UseTokenForAuthentication;
        PCUserName.Text               = cfg.UserName;
        Domain.Text                   = cfg.Domain;
        Project.Text                  = cfg.Project;
        TestID.Text                   = cfg.TestId;
        AutoTestInstance.IsChecked    = cfg.AutoTestInstance;
        SpecifyTestInstance.IsChecked = !cfg.AutoTestInstance;
        TestInstanceID.Text           = cfg.TestInstanceId;
        ProxyURL.Text                 = cfg.ProxyUrl;
        ProxyUserName.Text            = cfg.ProxyUserName;

        foreach (ComboBoxItem item in PostRunAction.Items)
            if (item.Tag?.ToString() == cfg.PostRunAction) { item.IsSelected = true; break; }

        DoNotTrend.IsChecked       = cfg.Trending == "DoNotTrend";
        AssociatedTrend.IsChecked  = cfg.Trending == "AssociatedTrend";
        UseTrendReportID.IsChecked = cfg.Trending == "UseTrendReportID";
        TrendReportID.Text         = cfg.TrendReportId;

        TimeslotDurationMinutes.Text = cfg.TimeslotDurationMinutes;
        UseVUDs.IsChecked            = cfg.UseVUDs;
        UseSLAStatus.IsChecked       = cfg.UseSLAInStatus;

        DoNotRepeat.IsChecked          = cfg.TimeslotRepeat != "RepeatWithParameters";
        RepeatWithParameters.IsChecked = cfg.TimeslotRepeat == "RepeatWithParameters";
        TimeslotRepeatDelay.Text       = cfg.TimeslotRepeatDelay;
        TimeslotRepeatAttempts.Text    = cfg.TimeslotRepeatAttempts;

        ArtifactsDirectory.Text = cfg.ArtifactsDirectory;
        NodeDistPath.Text       = cfg.NodeDistPath;
        DescriptionText.Text    = cfg.Description;
    }

    /// <summary>Populate the Sync form from a loaded <see cref="LreSyncConfiguration"/>.</summary>
    private void ApplySyncConfig(LreSyncConfiguration cfg)
    {
        // Connection fields: only overwrite if the CI tab hasn't already set them
        // (prefer not to clobber whatever ApplyConfig() already set)
        if (string.IsNullOrWhiteSpace(PCServerURL.Text) || PCServerURL.Text == "https://MyServer:443")
        {
            PCServerURL.Text = cfg.ServerUrl;
            UseTokenForAuthentication.IsChecked = cfg.UseTokenForAuthentication;
            PCUserName.Text  = cfg.UserName;
            Domain.Text      = cfg.Domain;
            Project.Text     = cfg.Project;
        }
        if (string.IsNullOrWhiteSpace(ProxyURL.Text))
        {
            ProxyURL.Text      = cfg.ProxyUrl;
            ProxyUserName.Text = cfg.ProxyUserName;
        }

        SyncWorkspaceDir.Text       = cfg.WorkspaceDir;
        SyncRuntimeOnly.IsChecked   = cfg.RuntimeOnly;
        SyncParallelUploads.Text    = cfg.ParallelUploads.ToString();
        SyncSuccessThreshold.Text   = cfg.SuccessThreshold;
        SyncBaseCommitSha.Text      = cfg.BaseCommitSha;
        SyncArtifactsDirectory.Text = cfg.ArtifactsDirectory;
        SyncNodeDistPath.Text       = cfg.NodeDistPath;
        SyncDescriptionText.Text    = cfg.Description;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────────────────────────────

    private bool ValidateRequiredFields()
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(PCServerURL.Text))  errors.Add("Server URL is required.");
        if (string.IsNullOrWhiteSpace(PCUserName.Text))   errors.Add("User Name is required.");
        if (string.IsNullOrWhiteSpace(Domain.Text))       errors.Add("Domain is required.");
        if (string.IsNullOrWhiteSpace(Project.Text))      errors.Add("Project is required.");

        if (!IsSyncTab)
        {
            if (string.IsNullOrWhiteSpace(TestID.Text))   errors.Add("Test ID is required.");
        }
        else
        {
            if (string.IsNullOrWhiteSpace(SyncWorkspaceDir.Text))
                errors.Add("Workspace directory is required.");
        }

        if (errors.Count == 0) return true;

        MessageBox.Show(string.Join("\n", errors), "PluginsUI — Validation",
            MessageBoxButton.OK, MessageBoxImage.Warning);
        return false;
    }

    private string ValidateTimeslotDuration()
    {
        if (int.TryParse(TimeslotDurationMinutes.Text, out int n))
        {
            if (n < 30)    { TimeslotDurationMinutes.Text = "30";    return "30"; }
            if (n > 28800) { TimeslotDurationMinutes.Text = "28800"; return "28800"; }
            return n.ToString();
        }
        TimeslotDurationMinutes.Text = "30";
        return "30";
    }

    private int ValidateParallelUploads()
    {
        if (int.TryParse(SyncParallelUploads.Text, out int n))
        {
            n = Math.Clamp(n, 1, 20);
            SyncParallelUploads.Text = n.ToString();
            return n;
        }
        SyncParallelUploads.Text = "1";
        return 1;
    }

    /// <summary>
    /// Returns the success threshold as a string suitable for the INPUT_VARSUCCESSTHRESHOLD env var.
    /// Empty string → not set → the task uses its default (50%).
    /// An integer in [0, 100] → passed through as-is.
    /// An integer outside [0, 100] → cleared to empty (let the task fall back to 50%).
    /// Non-numeric input → cleared to empty.
    /// </summary>
    private string ValidateSuccessThreshold()
    {
        var raw = SyncSuccessThreshold.Text.Trim();
        if (string.IsNullOrEmpty(raw)) return "";
        if (int.TryParse(raw, out int n))
        {
            if (n >= 0 && n <= 100) return n.ToString();
            // Out of range → fall back to default; clear the field to signal "not set"
            SyncSuccessThreshold.Text = "";
            return "";
        }
        SyncSuccessThreshold.Text = "";
        return "";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Output colour palette (dark terminal theme)
    // ─────────────────────────────────────────────────────────────────────────

    private static readonly SolidColorBrush _colDefault = new(Color.FromRgb(0xD4, 0xD4, 0xD4));
    private static readonly SolidColorBrush _colError   = new(Color.FromRgb(0xFF, 0x6B, 0x6B));
    private static readonly SolidColorBrush _colWarn    = new(Color.FromRgb(0xFF, 0xD7, 0x00));
    private static readonly SolidColorBrush _colSuccess = new(Color.FromRgb(0x98, 0xD9, 0x82));
    private static readonly SolidColorBrush _colMeta    = new(Color.FromRgb(0x9C, 0xDC, 0xFE));

    private void AppendOutput(string line)
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.InvokeAsync(() => AppendOutput(line)); return; }

        SolidColorBrush brush;
        if      (line.StartsWith("[ERR]",  StringComparison.Ordinal))                                   brush = _colError;
        else if (line.StartsWith("[WARN]", StringComparison.Ordinal))                                   brush = _colWarn;
        else if (line.Contains("succeeded",   StringComparison.OrdinalIgnoreCase) ||
                 line.Contains("successfully", StringComparison.OrdinalIgnoreCase) ||
                 line.Contains("completed",    StringComparison.OrdinalIgnoreCase))                     brush = _colSuccess;
        else if (line.StartsWith("[INFO] ───", StringComparison.Ordinal) ||
                 line.StartsWith("[INFO] Node", StringComparison.Ordinal) ||
                 line.StartsWith("[INFO] Artifacts", StringComparison.Ordinal) ||
                 line.StartsWith("[INFO] Workspace", StringComparison.Ordinal))                         brush = _colMeta;
        else                                                                                             brush = _colDefault;

        var para = new Paragraph(new Run(line) { Foreground = brush })
        {
            Margin     = new Thickness(0),
            LineHeight = 16
        };

        OutputTextBox.Document.Blocks.Add(para);
        OutputTextBox.ScrollToEnd();
    }

    private void SetStatus(string text)
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.InvokeAsync(() => SetStatus(text)); return; }
        StatusText.Text = text;
    }

    private void SetRunning(bool running)
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.InvokeAsync(() => SetRunning(running)); return; }
        RunButton.IsEnabled            = !running;
        StopButton.IsEnabled           =  running;
        TestConnectionButton.IsEnabled = !running;
        LoadConfigButton.IsEnabled     = !running;
        TaskTabControl.IsEnabled       = !running;   // prevent tab switching during run
        SetStatus(running
            ? (IsSyncTab ? "Syncing workspace…" : "Running test…")
            : StatusText.Text);
    }
}

