/*!
 * (c) 2016-2026 OpenText
 * Licensed under the Apache License, Version 2.0
 *
 * MainWindow.xaml.cs — code-behind for PluginsUI
 *
 * Key design choices vs the old PC.Plugins.ConfiguratorUI:
 *  • No references to PC.Plugins.* assemblies — fully standalone.
 *  • "Run" launches node dist/index.js directly with INPUT_* env vars (no PS1 wrapper needed).
 *  • "Test Connection" delegates to Scripts/test-connection.js via node — identical HTTP call to the main task.
 *  • async/await throughout — the UI never blocks.
 *  • Real-time streaming RichTextBox output panel with colour-coded lines.
 *  • Auto-save / auto-restore last session on close / open (%LOCALAPPDATA%\PluginsUI\last-session.json).
 *  • Save / Load configuration (JSON, passwords excluded).
 *  • Stop button to kill the running node process.
 *  • Browse buttons for Artifacts directory and Node dist path.
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

    private readonly LreTaskRunner      _runner   = new();
    private CancellationTokenSource?    _cts;

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    public MainWindow()
    {
        InitializeComponent();
        ApplyConfig(ConfigurationService.Load(_autoSavePath));
        SetStatus("Ready.");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Button handlers
    // ─────────────────────────────────────────────────────────────────────────

    private async void TestConnection_Click(object sender, RoutedEventArgs e)
    {
        var cfg = BuildConfig();
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
        if (_runner.IsRunning)
        {
            MessageBox.Show("A test is already running. Use Stop to cancel it first.",
                "PluginsUI", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        // Validate required fields
        if (!ValidateRequiredFields()) return;

        var cfg          = BuildConfig();
        var password     = PCPassword.Password;
        var proxyPwd     = ProxyPassword.Password;

        _cts = new CancellationTokenSource();
        var progress = new Progress<string>(AppendOutput);

        SetRunning(true);
        AppendOutput($"[{DateTime.Now:HH:mm:ss}] Starting task…");

        try
        {
            var exitCode = await _runner.RunAsync(cfg, password, proxyPwd, progress, _cts.Token);
            SetStatus(exitCode == 0 ? "Task completed successfully." : $"Task exited with code {exitCode}.");
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
        if (!_runner.IsRunning) return;
        _cts?.Cancel();
        _runner.Stop();
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
            Title            = "Save Configuration",
            Filter           = "JSON configuration (*.json)|*.json|All files (*.*)|*.*",
            DefaultExt       = ".json",
            FileName         = "lre-config.json"
        };
        if (dlg.ShowDialog(this) != true) return;

        try
        {
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
            var cfg = ConfigurationService.Load(dlg.FileName);
            ApplyConfig(cfg);
            SetStatus($"Configuration loaded from {Path.GetFileName(dlg.FileName)}.");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not load configuration:\n{ex.Message}",
                "PluginsUI — Load Config", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Browse buttons
    // ─────────────────────────────────────────────────────────────────────────

    private void BrowseArtifacts_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFolderDialog { Title = "Select Artifacts Directory" };
        if (dlg.ShowDialog(this) == true)
            ArtifactsDirectory.Text = dlg.FolderName;
    }

    private void BrowseNodeDist_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Title  = "Select dist/index.js",
            Filter = "JavaScript files (index.js)|index.js|All files (*.*)|*.*"
        };

        // Pre-navigate to likely location
        var guess = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..",
                "angular", "LreCiTask", "dist"));
        if (Directory.Exists(guess)) dlg.InitialDirectory = guess;

        if (dlg.ShowDialog(this) == true)
            NodeDistPath.Text = dlg.FileName;
    }

    private void DetectNodeDist_Click(object sender, RoutedEventArgs e)
    {
        // Run the same resolution the runner uses and show what was found
        var resolved = LreTaskRunner.ResolveDistPath(null);   // ignore any typed value — detect fresh
        if (resolved is not null)
        {
            NodeDistPath.Text = resolved;
            SetStatus($"Auto-detected: {resolved}");
        }
        else
        {
            SetStatus("dist/index.js not found automatically.");
            MessageBox.Show(
                "Could not locate dist\\index.js automatically.\n\n" +
                "Expected location for installer deployment:\n" +
                $"  {Path.Combine(AppContext.BaseDirectory, "dist", "index.js")}\n\n" +
                "Build the angular task first (npm run build in angular\\LreCiTask),\n" +
                "then copy the dist\\ folder next to PluginsUI.exe,\n" +
                "or use Browse… to select the file manually.",
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
            TogglePasswordButton.Content  = "Hide";
            PCPasswordVisible.Text        = PCPassword.Password;
            PCPassword.Visibility         = Visibility.Collapsed;
            PCPasswordVisible.Visibility  = Visibility.Visible;
            PCPasswordVisible.Focus();
        }
        else
        {
            TogglePasswordButton.Content  = "Show";
            PCPassword.Password           = PCPasswordVisible.Text;
            PCPasswordVisible.Visibility  = Visibility.Collapsed;
            PCPassword.Visibility         = Visibility.Visible;
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

    // ─────────────────────────────────────────────────────────────────────────
    // Window events
    // ─────────────────────────────────────────────────────────────────────────

    private void Window_Closing(object sender, CancelEventArgs e)
    {
        if (_runner.IsRunning)
        {
            var result = MessageBox.Show(
                "A test is still running. Stop it and close?",
                "PluginsUI", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (result == MessageBoxResult.No) { e.Cancel = true; return; }
            _runner.Stop();
        }
        _runner.Dispose();

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_autoSavePath)!);
            ConfigurationService.Save(BuildConfig(), _autoSavePath);
        }
        catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"[AutoSave] {ex.Message}"); /* best-effort */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>Read all form fields into a new <see cref="LreConfiguration"/>.</summary>
    private LreConfiguration BuildConfig() => new()
    {
        ServerUrl                = PCServerURL.Text.Trim(),
        UseTokenForAuthentication = UseTokenForAuthentication.IsChecked == true,
        UserName                 = PCUserName.Text.Trim(),
        Domain                   = Domain.Text.Trim(),
        Project                  = Project.Text.Trim(),
        TestId                   = TestID.Text.Trim(),
        AutoTestInstance         = AutoTestInstance.IsChecked == true,
        TestInstanceId           = (SpecifyTestInstance.IsChecked == true) ? TestInstanceID.Text.Trim() : string.Empty,
        ProxyUrl                 = ProxyURL.Text.Trim(),
        ProxyUserName            = ProxyUserName.Text.Trim(),
        PostRunAction            = ((ComboBoxItem?)PostRunAction.SelectedItem)?.Tag?.ToString() ?? "CollateAndAnalyze",
        Trending                 = DoNotTrend.IsChecked == true ? "DoNotTrend"
                                 : AssociatedTrend.IsChecked == true ? "AssociatedTrend"
                                 : "UseTrendReportID",
        TrendReportId            = UseTrendReportID.IsChecked == true ? TrendReportID.Text.Trim() : string.Empty,
        TimeslotDurationMinutes  = ValidateTimeslotDuration(),
        UseVUDs                  = UseVUDs.IsChecked == true,
        UseSLAInStatus           = UseSLAStatus.IsChecked == true,
        TimeslotRepeat           = RepeatWithParameters.IsChecked == true ? "RepeatWithParameters" : "DoNotRepeat",
        TimeslotRepeatDelay      = TimeslotRepeatDelay.Text.Trim(),
        TimeslotRepeatAttempts   = TimeslotRepeatAttempts.Text.Trim(),
        ArtifactsDirectory       = ArtifactsDirectory.Text.Trim(),
        NodeDistPath             = NodeDistPath.Text.Trim(),
        Description              = DescriptionText.Text.Trim()
    };

    /// <summary>Populate the form from a loaded <see cref="LreConfiguration"/>.</summary>
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

        // Post Run Action
        foreach (ComboBoxItem item in PostRunAction.Items)
            if (item.Tag?.ToString() == cfg.PostRunAction) { item.IsSelected = true; break; }

        // Trending
        DoNotTrend.IsChecked      = cfg.Trending == "DoNotTrend";
        AssociatedTrend.IsChecked = cfg.Trending == "AssociatedTrend";
        UseTrendReportID.IsChecked = cfg.Trending == "UseTrendReportID";
        TrendReportID.Text         = cfg.TrendReportId;

        TimeslotDurationMinutes.Text = cfg.TimeslotDurationMinutes;
        UseVUDs.IsChecked            = cfg.UseVUDs;
        UseSLAStatus.IsChecked       = cfg.UseSLAInStatus;

        DoNotRepeat.IsChecked           = cfg.TimeslotRepeat != "RepeatWithParameters";
        RepeatWithParameters.IsChecked  = cfg.TimeslotRepeat == "RepeatWithParameters";
        TimeslotRepeatDelay.Text        = cfg.TimeslotRepeatDelay;
        TimeslotRepeatAttempts.Text     = cfg.TimeslotRepeatAttempts;

        ArtifactsDirectory.Text = cfg.ArtifactsDirectory;
        NodeDistPath.Text       = cfg.NodeDistPath;
        DescriptionText.Text    = cfg.Description;
    }

    private bool ValidateRequiredFields()
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(PCServerURL.Text))  errors.Add("Server URL is required.");
        if (string.IsNullOrWhiteSpace(PCUserName.Text))   errors.Add("User Name is required.");
        if (string.IsNullOrWhiteSpace(Domain.Text))       errors.Add("Domain is required.");
        if (string.IsNullOrWhiteSpace(Project.Text))      errors.Add("Project is required.");
        if (string.IsNullOrWhiteSpace(TestID.Text))       errors.Add("Test ID is required.");

        if (errors.Count == 0) return true;

        MessageBox.Show(string.Join("\n", errors), "PluginsUI — Validation",
            MessageBoxButton.OK, MessageBoxImage.Warning);
        return false;
    }

    private string ValidateTimeslotDuration()
    {
        if (int.TryParse(TimeslotDurationMinutes.Text, out int n))
        {
            if (n < 30)  { TimeslotDurationMinutes.Text = "30";    return "30"; }
            if (n > 28800) { TimeslotDurationMinutes.Text = "28800"; return "28800"; }
            return n.ToString();
        }
        TimeslotDurationMinutes.Text = "30";
        return "30";
    }

    // ── Output colour palette (dark terminal theme) ─────────────────────────
    private static readonly SolidColorBrush _colDefault  = new(Color.FromRgb(0xD4, 0xD4, 0xD4)); // light grey
    private static readonly SolidColorBrush _colError    = new(Color.FromRgb(0xFF, 0x6B, 0x6B)); // soft red
    private static readonly SolidColorBrush _colWarn     = new(Color.FromRgb(0xFF, 0xD7, 0x00)); // gold
    private static readonly SolidColorBrush _colSuccess  = new(Color.FromRgb(0x98, 0xD9, 0x82)); // soft green
    private static readonly SolidColorBrush _colMeta     = new(Color.FromRgb(0x9C, 0xDC, 0xFE)); // light blue

    private void AppendOutput(string line)
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.InvokeAsync(() => AppendOutput(line)); return; }

        // Pick colour based on line prefix / keywords
        SolidColorBrush brush;
        if      (line.StartsWith("[ERR]",  StringComparison.Ordinal))                                   brush = _colError;
        else if (line.StartsWith("[WARN]", StringComparison.Ordinal))                                   brush = _colWarn;
        else if (line.Contains("succeeded",   StringComparison.OrdinalIgnoreCase) ||
                 line.Contains("successfully", StringComparison.OrdinalIgnoreCase) ||
                 line.Contains("completed",    StringComparison.OrdinalIgnoreCase))                     brush = _colSuccess;
        else if (line.StartsWith("[INFO] ───", StringComparison.Ordinal) ||
                 line.StartsWith("[INFO] Node", StringComparison.Ordinal) ||
                 line.StartsWith("[INFO] Artifacts", StringComparison.Ordinal))                         brush = _colMeta;
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
        SetStatus(running ? "Running test…" : StatusText.Text);
    }
}

