/**
 * Local test runner for the LRE task
 * Allows testing the task outside of Azure DevOps pipeline environment
 */

const path = require('path');

const [nodeMajor] = process.versions.node.split('.').map(Number);
if (Number.isNaN(nodeMajor) || nodeMajor < 20) {
  console.error(`Node.js 20 or newer is required. Current version: ${process.versions.node}`);
  process.exit(1);
}

// Mock Azure DevOps task library inputs
process.env.SYSTEM_TASKINSTANCEID = 'test-instance-123';
process.env.SYSTEM_JOBID = 'test-job-456';
process.env.BUILD_BUILDID = 'test-build-789';
process.env.BUILD_ARTIFACTSTAGINGDIRECTORY = path.join(__dirname, 'test-artifacts');

// Set input variables - customize these for your test
const inputs = {
  descriptionString: 'Local Test Run',
  varPCServer: 'http://MyServer:80',
  varUseTokenForAuthentication: 'false',
  varUserName: 'admin',
  varPassWord: 'password',
  varDomain: 'DEFAULT',
  varProject: 'MyProject',
  varTestID: '1',
  varAutoTestInstance: 'true',
  varTestInstID: '',
  varProxyUrl: '',
  varProxyUser: '',
  varProxyPassword: '',
  varPostRunAction: 'CollateAndAnalyze',
  varTrending: 'DoNotTrend',
  varTrendReportID: '',
  varTimeslotDuration: '30',
  varUseVUDs: 'false',
  varUseSLAInStatus: 'false',
  vartimeslotRepeat: 'DoNotRepeat',
  varTimeslotRepeatDelay: '',
  varTimeslotRepeatAttempts: '',
  varArtifactsDir: path.join(__dirname, 'test-artifacts')
};

// Set environment variables for task inputs
Object.keys(inputs).forEach(key => {
  process.env[`INPUT_${key.toUpperCase()}`] = inputs[key];
});

// Create artifacts directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(inputs.varArtifactsDir)) {
  fs.mkdirSync(inputs.varArtifactsDir, { recursive: true });
}

console.log('Testing LRE Task with the following configuration:');
console.log(JSON.stringify(inputs, null, 2));
console.log(`\nArtifacts directory: ${inputs.varArtifactsDir}`);
console.log('\nRunning task...\n');

// Load and run the task
try {
  require('./LreCiTask/dist/index.js');
} catch (error) {
  console.error('Error running task:', error);
  process.exit(1);
}

