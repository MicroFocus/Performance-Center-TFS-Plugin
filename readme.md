# Performance Center CI extension for Microsoft Team Foundation Server

The "<b>Performance Center CI</b>" extension integrates Performance Center with Microsoft Team Foundation Server (TFS), enabling the TFS CI build process to trigger the execution of load tests designed on a Performance Center server.

This extension currently supports:

- Performance Center 12.56.

##### **System prerequisites:**

To use this plugin you must have:

- Performance Center server designed to run load tests on Performance Center hosts.
- PowerShell version 4.0 or later.

##### **Install the "Performance Center CI" extension:**

Before you can run Performance Center tests as part of your build on a TFS CI build process, you have to install the Performance Center CI extension on your TFS. 

1. Download the "<b>Performance Center CI</b>" extension: you can either download the file "[Micro-Focus.PCIntegration-1.0.1.vsix](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/blob/master/Extension/Micro-Focus.PCIntegration-1.0.1.vsix) and upload it to your TFS Manage Extensions section (http://&lt;tfs_server_and_port&gt;/tfs/_gallery/manage)" or download it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. Install the "<b>Performance Center CI</b>" extension to your team project collection.

##### **Run a Performance Center test from TFS build process’s task**

1. Go to the build definition of your TFS collection and add the "<b>Performance Center task</b>".
2. Provide the required input for the "<b>Performance Center task</b>". <b>Note</b>: To avoid conflicts with the way TFS manages secret input, this task performs minimal validations and therefore does not ensure the input is correct.
3. Run the TFS CI Build.

##### **GitHub repository projects**

This GitHub repository contains the following projects which are used to build the Performance Center Plugin Extension for TFS:


| **Project Name** | **Description** |
|---------------------------|----------------------------------------------------|
 **PC.Plugins.Automation** | Project handling a build task. |
|**PC.Plugins.Common.Test**|Test project for PC.Plugins.Common project. This is a simple UI that requires some valid inputs to verify the functions defined and  implemented in PC.Plugins.Common.|
|**PC.Plugins.Common**| This is the most common Rest API operation which is used to run and monitor a Performance Center test execution, and to download Analysis and Trend Reports.|
|**PC.Plugins.Configurator**| Project supporting different types of functions called from PowerShell which trigger a build execution from PC.Plugins.Automation.|
|**PC.Plugins.ConfiguratorUI**|Similar to PC.Plugins.Configurator, this standalone tool has a UI in which you enter values to run a build execution from PC.Plugins.Automation. It then opens a PowerShell window to display the build progression.
|**PC.Plugins.Installer.CA**|Custom actions definitions for PC.Plugins.Installer (currently empty).|
|**PC.Plugins.Installer**|Installer containing PC.Plugins.Common.dll, PC.Plugins.Automation.dll, PC.Plugins.Configurator.dll, and PC.Plugins.ConfiguratorUI.exe.|
|**PC.TFS.BuildTask**| Project defining the "Performance Center CI" extension that will be used in TFS.|

 

For more details, see the [Performance Center TFS Extension wiki](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/wiki).



 

 

 

 

 