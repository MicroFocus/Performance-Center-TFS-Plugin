# OpenText Enterprise Performance Engineering CI plugin for Azure DevOps Server

The "<b>OpenText Enterprise Performance Engineering CI</b>" extension integrates tests designed in OpenText Enterprise Performance Engineering projects with Azure DevOps Server pipelines' build.

##### **System prerequisites:**

To use this plugin you must have:

- OpenText Enterprise Performance Engineering server designed to run load tests on Lab hosts.
- PowerShell version 4.0 or later.

##### **Install the "OpenText Enterprise Performance Engineering CI" extension:**

Before you can run load tests as part of your build on a Azure DevOps CI build process, you have to install the OpenText Enterprise Performance Engineering CI extension on your Azure DevOps Server. 

1. Download the extension: you can either download the file "[Micro-Focus.PCIntegration-1.0.4.vsix](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/blob/master/Extension/Micro-Focus.PCIntegration-1.0.4.vsix) and upload it to your Azure DevOps Manage Extensions section (http://&lt;tfs_server_and_port&gt;/tfs/_gallery/manage)" or download it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. Install the extension to your team project collection.

##### **Run a load test from Azure DevOps build process’s task**

1. Go to the build definition of your Azure DevOps collection and add the "<b>OpenText Enterprise Performance Engineering task</b>" to a pipeline.
2. Provide the required input for the task. <b>Note</b>: To avoid conflicts with the way Azure DevOps manages secret input, this task performs minimal validations and therefore does not ensure the input is correct.
3. Run the Azure DevOps CI Build.

##### **GitHub repository projects**

This GitHub repository contains the following projects which are used to build the OpenText Enterprise Performance Engineering Plugin Extension for Azure DevOps:


| **Project Name** | **Description** |
|---------------------------|----------------------------------------------------|
 **PC.Plugins.Automation** | Project handling a build task. |
|**PC.Plugins.Common.Test**|Test project for PC.Plugins.Common project. This is a simple UI that requires some valid inputs to verify the functions defined and  implemented in PC.Plugins.Common.|
|**PC.Plugins.Common**| Project with the most common Rest API operations used to trigger a load test, to monitor the run to the end of execution, to download Analysis and Trend Reports.|
|**PC.Plugins.Configurator**| Project supporting different types of functions called from PowerShell which trigger a build execution from PC.Plugins.Automation.|
|**PC.Plugins.ConfiguratorUI**|Similar to PC.Plugins.Configurator, this standalone tool has a UI in which you enter values to run a build execution from PC.Plugins.Automation. It then opens a PowerShell window to display the build progression.
|**PC.Plugins.Installer.CA**|Custom actions definitions for PC.Plugins.Installer (currently empty).|
|**PC.Plugins.Installer**|Installer containing PC.Plugins.Common.dll, PC.Plugins.Automation.dll, PC.Plugins.Configurator.dll, and PC.Plugins.ConfiguratorUI.exe.|
|**PC.TFS.BuildTask**| Project defining the extension that will be used in Azure DevOps / TFS.|

 

For more details, see the [OpenText Enterprise Performance Engineering Azure DevOps Extension wiki](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/wiki).



 

 

 

 

 
