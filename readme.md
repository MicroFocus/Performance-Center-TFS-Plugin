# Performance Center plugin for Microsoft Team Foundation Server CI

This plugin integrates Performance Center with Microsoft Team Foundation Server (TFS), enabling the TFS CI build process to trigger the execution of load tests designed on a Performance Center server.

This extension currently supports:

- Performance Center 12.56

##### System prerequisites:

To use this plugin you must have:

- Performance Center server designed to run load tests on Performance Center hosts.
- PowerShell version 4.0 or later.

##### Install the Performance Center Plugin Extension

Before you can run Performance Center tests as part of your build on a
TFS CI system, you have to install the Extension on your TFS server. 

1. Download the .vsix file and upload it to your TFS Manage extension section (http://&lt;tfs_server_and_port&gt;/tfs/_gallery/manage). You can also find the extension in the VisualStudio Marketplace.
2. Install the extension to your team project collection.

##### **Run a Performance Center test from TFS build process’s task**

1. Go to the build definition of your TFS collection and add the Performance Center task.
2. Provide the required input for the Performance Center task. To avoid conflicts with the way TFS manages secret input, this task performs minimal validations to ensure the input is correct.
3. Run the Build.

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
|**PC.TFS.BuildTask**| Project defining the extension that will be used in TFS.|

 

For more details, see the [Performance Center TFS Extension wiki](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/wiki).



 

 

 

 

 