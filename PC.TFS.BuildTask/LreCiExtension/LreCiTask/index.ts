import tl = require('azure-pipelines-task-lib/task');
import * as path from "path";

var errorLevel: number = 0;

async function run() {
    try {
        const varPCServer: string = tl.getInput('varPCServer', true) ?? '';
		const varUserName: string = tl.getInput('varUserName', true) ?? '';
		const varPassword: string = tl.getInput('varPassword', true) ?? '';
		const varDomain: string = tl.getInput('varDomain', true) ?? '';
		const varProject: string = tl.getInput('varProject', true) ?? '';
		const varTestID: string = tl.getInput('varTestID', true) ?? '';
		const varAutoTestInstance: string = tl.getInput('varAutoTestInstance', false) ?? '';
		const varTestInstID: string = tl.getInput('varTestInstID', false) ?? '';
		const varPostRunAction: string = tl.getInput('varPostRunAction', false) ?? '';
		const varProxyUrl: string = tl.getInput('varProxyUrl', false) ?? '';
		const varProxyUser: string = tl.getInput('varProxyUser', false) ?? '';
		const varProxyPassword: string = tl.getInput('varProxyPassword', false) ?? '';
		const varTrending: string = tl.getInput('varTrending', false) ?? '';
		const varTrendReportID: string = tl.getInput('varTrendReportID', false) ?? '';
		const varTimeslotDuration: string = tl.getInput('varTimeslotDuration', false) ?? '';
		const varUseVUDs: string = tl.getInput('varUseVUDs', false) ?? '';
		const varUseSLAInStatus: string = tl.getInput('varUseSLAInStatus', false) ?? '';
		const varArtifactsDir: string = tl.getInput('varArtifactsDir', false) ?? '';
		const varTimeslotRepeat: string = tl.getInput('varTimeslotRepeat', false) ?? '';
		const varTimeslotRepeatDelay: string = tl.getInput('varTimeslotRepeatDelay', false) ?? '';
		const varTimeslotRepeatAttempts: string = tl.getInput('varTimeslotRepeatAttempts', false) ?? '';
		const varUseTokenForAuthentication: string = tl.getInput('varUseTokenForAuthentication', false) ?? '';

		if ([varPCServer, varUserName, varPassword, varDomain, varProject, varTestID].includes('bad')) {
			tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
			return;
		}
		// console.log('start running on ', 
			// "varPCServer='", varPCServer, "', ", "\r\n",
			// "varUserName='", varUserName, "', ", "\r\n",
			// "varPassword='********', ", "\r\n",
			// "varDomain='",	varDomain, "', ", "\r\n",
			// "varProject='",	varProject, "', ", "\r\n",
			// "varTestID='",	varTestID, "', ", "\r\n",
			// "varAutoTestInstance='",	varAutoTestInstance, "', ", "\r\n",
			// "varTestInstID='", varTestInstID, "', ", "\r\n",
			// "varPostRunAction='", varPostRunAction, "', ", "\r\n",
			// "varProxyUrl='",	varProxyUrl, "', ", "\r\n",
			// "varProxyUser='", varProxyUser, "', ", "\r\n",
			// "varProxyPassword='********', ", "\r\n",
			// "varTrending='", varTrending, "', ", "\r\n",
			// "varTrendReportID='", varTrendReportID, "', ", "\r\n",
			// "varTimeslotDuration='", varTimeslotDuration, "', ", "\r\n",
			// "varUseVUDs='", varUseVUDs, "', ", "\r\n",
			// "varUseSLAInStatus='", varUseSLAInStatus, "', ", "\r\n",
			// "varArtifactsDir='", varArtifactsDir, "', ", "\r\n",
			// "varTimeslotRepeat='", varTimeslotRepeat, "', ", "\r\n",
			// "varTimeslotRepeatDelay='", varTimeslotRepeatDelay, "', ", "\r\n",
			// "varTimeslotRepeatAttempts='", varTimeslotRepeatAttempts, "', ", "\r\n",
			// "varUseTokenForAuthentication='", varUseTokenForAuthentication, "'", "\r\n");
		await ExecutePcLocalTask(	
			varPCServer, 
			varUserName,
			varPassword,
			varDomain,
			varProject,
			varTestID,
			varAutoTestInstance,
			varTestInstID,
			varPostRunAction,
			varProxyUrl,
			varProxyUser,
			varProxyPassword,
			varTrending,
			varTrendReportID,
			varTimeslotDuration,
			varUseVUDs,
			varUseSLAInStatus,
			varArtifactsDir,
			varTimeslotRepeat,
			varTimeslotRepeatDelay,
			varTimeslotRepeatAttempts,
			varUseTokenForAuthentication);
        // console.log('finished running on ', varPCServer);
		if(errorLevel != 0) {
			errorLevel = 0;
			throw new Error("Failed running")
		}
    } catch(err) {
        if (err instanceof Error) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        } else {
			console.log(err);
            tl.setResult(tl.TaskResult.Failed, 'Unexpected error');
        }
    }
}

async function ExecutePcLocalTask(
	varPCServer: string, 
	varUserName:string, 
	varPassword: string, 
	varDomain: string,
	varProject: string,
	varTestID: string ,
	varAutoTestInstance: string,
	varTestInstID: string,
	varPostRunAction: string,
	varProxyUrl: string,
	varProxyUser: string,
	varProxyPassword: string,
	varTrending: string,
	varTrendReportID: string,
	varTimeslotDuration: string,
	varUseVUDs: string,
	varUseSLAInStatus: string,
	varArtifactsDir: string,
	varTimeslotRepeat: string,
	varTimeslotRepeatDelay: string,
	varTimeslotRepeatAttempts: string,
	varUseTokenForAuthentication: string) {
	const scriptPath = path.join(__dirname, "lreLocalTask.ps1");
	const psCommand = `& "${scriptPath}" ` + 
		`-varPCServer "${varPCServer}" ` +
		`-varUserName "${varUserName}" ` +
		`-varPassword "${varPassword}" ` +
		`-varDomain "${varDomain}" ` +
		`-varProject "${varProject}" ` +
		`-varTestID "${varTestID}" ` +
		`-varAutoTestInstance "${varAutoTestInstance}" ` +
		`-varTestInstID "${varTestInstID}" ` +
		`-varPostRunAction "${varPostRunAction}" ` +
		`-varProxyUrl "${varProxyUrl}" ` +
		`-varProxyUser "${varProxyUser}" ` +
		`-varProxyPassword "${varProxyPassword}" ` +
		`-varTrending "${varTrending}" ` +
		`-varTrendReportID "${varTrendReportID}" ` +
		`-varTimeslotDuration "${varTimeslotDuration}" ` +
		`-varUseVUDs "${varUseVUDs}" ` +
		`-varUseSLAInStatus "${varUseSLAInStatus}" ` +
		`-varArtifactsDir "${varArtifactsDir}" ` +
		`-varTimeslotRepeat "${varTimeslotRepeat}" ` +
		`-varTimeslotRepeatDelay "${varTimeslotRepeatDelay}" ` +
		`-varTimeslotRepeatAttempts "${varTimeslotRepeatAttempts}" ` +
		`-varUseTokenForAuthentication "${varUseTokenForAuthentication}"`;
	await execPsCommand(psCommand);
}

async function execPsCommand(command: string):Promise<string> {
	return new Promise<string>(resolve => {
			var spawn = require("child_process").spawn,child;
			var consoleOutput: string = "";
			child = spawn("powershell.exe",[command]);
			child.stdout.on("data",function(data: string) {
				if(data) {
					console.log(data.toString());
					consoleOutput += data.toString();
				}
			});
			child.stderr.on("data",function(data: string) {
				if(data){
					const err: string = `Errors: ${data.toString()}`;
					console.log(err);
					consoleOutput += err;
				}
				errorLevel += 1;
			});
			child.on("exit",function() {
				resolve(consoleOutput);
			});
			child.stdin.end();
		});
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
	console.log('Task was interrupted');
	// Perform cleanup or additional actions here
	tl.setResult(tl.TaskResult.Failed, 'Task was interrupted');
  });
  

run();