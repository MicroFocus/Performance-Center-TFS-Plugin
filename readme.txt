##Micro Focus Performance Center - Team Foundation Server Extension

#This GitHub repository contains the following projects:
1. PC.Plugins.Common - Most common Rest API operation used to run and monitor a Performance Center test execution + download analysis and trend reports.
2. PC.Plugins.Common.Test - Test project for PC.Plugins.Common project (very simplistic UI requiring some valid input to verify the functionality of the functions defined and implemented in PC.Plugins.Common).
3. PC.Plugins.Automation - Project handling a build task.
4. PC.Plugins.Configurator - Project supporting different type of functions called from PowerShell and eventually triggerring a build execution from PC.Plugins.Automation.
5. PC.Plugins.ConfiguratorUI - Similar to PC.Plugins.Configurator, this standalone tool is proposing a UI in which values can be provided to run a build  execution from PC.Plugins.Automation and then open a powershell window to display the build progression.
6. PC.Plugins.Installer - installer containing PC.Plugins.Common.dll, PC.Plugins.Automation.dll, PC.Plugins.Configurator.dll and PC.Plugins.ConfiguratorUI.exe.
7. PC.Plugins.Installer.CA - custom actions defitions for PC.Plugins.Installer (currently empty).
8. PC.TFS.BuildTask - project defining the extension that will be used in TFS.

All those projects have for purpose to contribute to the build of the "Performance Center Testing Extension for Team Foundation Server".



#Welcome to the Performance Center Testing Extension for Team Foundation Server

This plugin allows the Microsoft Team Foundation Server CI build process to trigger the execution of load tests designed in a Performance Center server. 

This extension currently supports:
•	Performance Center 12.56

System prerequisites:
•	Performance Center server designed to run load tests in Performance Center Hosts.
•	PowerShell version 4.0 or higher.

Install the Performance Center Testing Extension
•	You must have Administrator privileges to install the Extension.
•	Download the .vsix file and upload it to your TFS Manage extension section (http://<tfs_server_and_port>/tfs/_gallery/manage). You can also access the extension from VisualStudio Marketplace.
•	Install the extension to your team project collection.

Launch and execute a Performance Center test from TFS build process’s task
•	Go to the build definition of your TFS collection and add the Performance Center task.
•	Provide the required input to the Performance Center task. To avoid conflicts with the way TFS manage secret input, this task does minimal validations to the input and it is therefore under end-user’s responsibility to make sure the input is correct.
•	Run the Build.