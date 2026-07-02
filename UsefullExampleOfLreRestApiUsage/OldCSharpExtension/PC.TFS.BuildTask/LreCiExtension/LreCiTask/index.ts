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
		const varAutoTestInstance: string = tl.getInput('varAutoTestInstance', false) ?? 'true';
		const varTestInstID: string = tl.getInput('varTestInstID', false) ?? '';
		const varPostRunAction: string = tl.getInput('varPostRunAction', false) ?? 'CollateAndAnalyze';
		const varProxyUrl: string = tl.getInput('varProxyUrl', false) ?? '';
		const varProxyUser: string = tl.getInput('varProxyUser', false) ?? '';
		const varProxyPassword: string = tl.getInput('varProxyPassword', false) ?? '';
		const varTrending: string = tl.getInput('varTrending', false) ?? 'DoNotTrend';
		const varTrendReportID: string = tl.getInput('varTrendReportID', false) ?? '';
		const varTimeslotDuration: string = tl.getInput('varTimeslotDuration', false) ?? '30';
		const varUseVUDs: string = tl.getInput('varUseVUDs', false) ?? 'false';
		const varUseSLAInStatus: string = tl.getInput('varUseSLAInStatus', false) ?? 'false';
		const varArtifactsDir: string = tl.getInput('varArtifactsDir', false) ?? '';
		const varTimeslotRepeat: string = tl.getInput('varTimeslotRepeat', false) ?? 'DoNotRepeat';
		const varTimeslotRepeatDelay: string = tl.getInput('varTimeslotRepeatDelay', false) ?? '1';
		const varTimeslotRepeatAttempts: string = tl.getInput('varTimeslotRepeatAttempts', false) ?? '2';
		const varUseTokenForAuthentication: string = tl.getInput('varUseTokenForAuthentication', false) ?? 'false';

		if ([varPCServer, varUserName, varPassword, varDomain, varProject, varTestID].includes('bad')) {
			tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
			return;
		}
		var artifactoryDirVerified = verifyArtifactoryPath(varArtifactsDir);

		process.env.VARPCSERVER = varPCServer;
		process.env.VARUSERNAME = varUserName;
		process.env.VARPASSWORD = varPassword;
		process.env.VARDOMAIN = varDomain;
		process.env.VARPROJECT = varProject;
		process.env.VARTESTID = varTestID;
		process.env.VARAUTOTESTINSTANCE = varAutoTestInstance;
		process.env.VARTESTINSTID = varTestInstID;
		process.env.VARPOSTRUNACTION = varPostRunAction;
		process.env.VARPROXYURL = varProxyUrl;
		process.env.VARPROXYUSER = varProxyUser;
		process.env.VARPROXYPASSWORD = varProxyPassword;
		process.env.VARTRENDING = varTrending;
		process.env.VARTRENDREPORTID = varTrendReportID;
		process.env.VARTIMESLOTDURATION = varTimeslotDuration;
		process.env.VARUSEVUDS = varUseVUDs;
		process.env.VARUSESLAINSTATUS = varUseSLAInStatus;
		process.env.VARARTIFACTSDIR = artifactoryDirVerified;
		process.env.VARTIMESLOTREPEAT = varTimeslotRepeat;
		process.env.VARTIMESLOTREPEATDELAY = varTimeslotRepeatDelay;
		process.env.VARTIMESLOTREPEATATTEMPTS = varTimeslotRepeatAttempts;
		process.env.VARUSETOKENFORAUTHENTICATION = varUseTokenForAuthentication;

		await ExecutePcLocalTask();
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

/**
 * The artifactory should not contain a parameter because this would mean 
 * it does not correspond to a valid environment variable.
 * Therefore, this mnethod can be used, if this happens, to perform the following:
 * - the pipeline workspace will be used instead of the provided value
 * - and if the pipeline workspace itself does not exist, no path for artifactory will be used.
 * @param varArtifactsDir
 * @returns
 */
function verifyArtifactoryPath(varArtifactsDir: string) {
    var artifactoryDirVerified = varArtifactsDir;
    var paramsInArtifactoryDirVerified = artifactoryDirVerified.match(/\(([^}]*)\)/);
    if (paramsInArtifactoryDirVerified) {
        let pipelineWorkspace = process.env.PIPELINE_WORKSPACE;
        if (pipelineWorkspace) {
            artifactoryDirVerified = pipelineWorkspace.concat("\\LreTest");
        } else {
            artifactoryDirVerified = "LreTest";
        }
    }
    return artifactoryDirVerified;
}

async function ExecutePcLocalTask() {
	const scriptPath = path.join(__dirname, "lreLocalTask.ps1");
	const psCommand = `& "${scriptPath}"`;
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