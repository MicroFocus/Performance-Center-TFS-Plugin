# LoadRunner Enterprise CI plugin for Azure DevOps / Microsoft Team Foundation Server

The "<b>LoadRunner Enterprise CI</b>" extension integrates LoadRunner Enterprise with Azure DevOps / Microsoft Team Foundation Server (TFS), enabling the Azure DevOps / TFS CI build process to trigger the execution of load tests designed on a LoadRunner Enterprise server.

This extension currently supports:

- Performance Center 12.56.

##### **System prerequisites:**

To use this plugin you must have:

- LoadRunner Enterprise server designed to run load tests on LoadRunner Enterprise hosts.
- PowerShell version 4.0 or later.

##### **Install the "LoadRunner Enterprise CI" extension:**

Before you can run LoadRunner Enterprise tests as part of your build on a Azure DevOps / TFS CI build process, you have to install the LoadRunner Enterprise CI extension on your TFS. 

1. Download the "<b>LoadRunner Enterprise CI</b>" extension: you can either download the file "[Micro-Focus.PCIntegration-1.0.3.vsix](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/blob/master/Extension/Micro-Focus.PCIntegration-1.0.3.vsix) and upload it to your TFS Manage Extensions section (http://&lt;tfs_server_and_port&gt;/tfs/_gallery/manage)" or download it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/).
2. Install the "<b>LoadRunner Enterprise CI</b>" extension to your team project collection.

##### **Run a LoadRunner Enterprise test from Azure DevOps / TFS build process’s task**

1. Go to the build definition of your Azure DevOps / TFS collection and add the "<b>LoadRunner Enterprise task</b>".
2. Provide the required input for the "<b>LoadRunner Enterprise task</b>". <b>Note</b>: To avoid conflicts with the way Azure DevOps / TFS manages secret input, this task performs minimal validations and therefore does not ensure the input is correct.
3. Run the Azure DevOps / TFS CI Build.

##### **GitHub repository projects**

This GitHub repository contains the following projects which are used to build the LoadRunner Enterprise Plugin Extension for Azure DevOps / TFS:


| **Project Name** | **Description** |
|---------------------------|----------------------------------------------------|
 **PC.Plugins.Automation** | Project handling a build task. |
|**PC.Plugins.Common.Test**|Test project for PC.Plugins.Common project. This is a simple UI that requires some valid inputs to verify the functions defined and  implemented in PC.Plugins.Common.|
|**PC.Plugins.Common**| This is the most common Rest API operation which is used to run and monitor a LoadRunner Enterprise test execution, and to download Analysis and Trend Reports.|
|**PC.Plugins.Configurator**| Project supporting different types of functions called from PowerShell which trigger a build execution from PC.Plugins.Automation.|
|**PC.Plugins.ConfiguratorUI**|Similar to PC.Plugins.Configurator, this standalone tool has a UI in which you enter values to run a build execution from PC.Plugins.Automation. It then opens a PowerShell window to display the build progression.
|**PC.Plugins.Installer.CA**|Custom actions definitions for PC.Plugins.Installer (currently empty).|
|**PC.Plugins.Installer**|Installer containing PC.Plugins.Common.dll, PC.Plugins.Automation.dll, PC.Plugins.Configurator.dll, and PC.Plugins.ConfiguratorUI.exe.|
|**PC.TFS.BuildTask**| Project defining the "LoadRunner Enterprise CI" extension that will be used in Azure DevOps / TFS.|

 

For more details, see the [LoadRunner Enterprise Azure DevOps / TFS Extension wiki](https://github.com/MicroFocus/Performance-Center-TFS-Plugin/wiki).



 

 

 

 

 
