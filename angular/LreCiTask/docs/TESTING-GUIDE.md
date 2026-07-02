# Testing the Pure TypeScript Implementation

## Quick Start

### 1. Install Dependencies

```bash
cd PC.TFS.BuildTask/LreCiExtension/LreCiTask
npm install
```

### 2. Compile TypeScript

```bash
npm run build
```

This will compile all `.ts` files to `.js` in the same directory structure.

### 3. Test the LreClient

Create a test file `PC.TFS.BuildTask/LreCiExtension/LreCiTask/test.js`:

```javascript
const { LreClient } = require('./src/lre/LreClient');

async function testLreClient() {
	const config = {
		serverUrl: 'https://your-lre-server.com',
		domain: 'DEFAULT',
		project: 'YourProject',
		useToken: false,
		username: 'your-username',
		password: 'your-password',
		// tenant: 'your-tenant-guid',
		// proxyUrl: 'http://proxy:8080'
	};

	const client = new LreClient(config);

	try {
		console.log('Authenticating...');
		const authenticated = await client.authenticate();
		console.log(`Authentication: ${authenticated ? 'SUCCESS' : 'FAILED'}`);

		if (!authenticated) {
			return;
		}

		console.log('Fetching test ID 1...');
		const test = await client.getTest(1);
		console.log('Test:', test);
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error));
	} finally {
		if (client.isLoggedIn()) {
			await client.logout();
		}
	}
}

testLreClient();
```

Run it:
```bash
node test.js
```

---

## Validation Commands

The secure build now uses lightweight validation commands instead of a Jest toolchain.

Run static validation:

```bash
npm test
npm run lint
npm run build
```

Run dependency auditing:

```bash
npm run security:audit
```

Run safe real-server verification using `integration/integration-tests.properties`:

```bash
npm run test:integration:safe
```

Run full real execution verification only when you intentionally want to start a real run:

```bash
npm run test:integration
```

---

## Manual Integration Testing

### Test Against Real LRE Server

1. **Update credentials** in `test.js`
2. **Ensure LRE server is accessible** from your network
3. **Run the test**:
   ```bash
   node test.js
   ```

### Expected Output (Success):

```
Authenticating...
Authentication: SUCCESS

Fetching test ID 1...
Test: {
  ID: 1,
  Name: 'WebTours Performance Test',
  TestFolderPath: '/Subject/Performance/'
}

Fetching test instances for test ID 1...
Instances: {
  TestInstancesList: [
	{ TestInstanceID: 10, TestID: 1, TestSetId: 5 }
  ]
}

Logging out...
Done!
```

---

## Debugging Tips

### Enable Debug Logging

In your Azure DevOps pipeline, set:
```yaml
variables:
  SYSTEM_DEBUG: true
```

Or in your test script:
```javascript
process.env.SYSTEM_DEBUG = 'true';
```

This will show all `tl.debug()` messages from the LreClient.

### Check Cookies

```javascript
console.log('Cookies:', client.cookieJar.getCookiesSync('https://your-lre-server.com'));
```

### Inspect Raw XML

Add to LreClient methods:
```typescript
tl.debug(`Request XML: ${xmlString}`);
tl.debug(`Response XML: ${response.data}`);
```

---

## Common Issues & Solutions

### ❌ "Cannot find module 'axios-cookiejar-support'"

**Solution**: Run `npm install`

### ❌ "Authentication failed: No response from server"

**Possible Causes**:
1. LRE server URL is incorrect
2. Proxy is blocking the request
3. LRE server is down or unreachable

**Debug**:
```javascript
const config = {
	...yourConfig,
	proxyUrl: undefined // Temporarily disable proxy
};
```

### ❌ "XML parsing failed"

**Cause**: LRE returned HTML error page instead of XML

**Debug**:
```typescript
console.log('Raw response:', response.data);
```

### ❌ TypeScript compilation errors

**Solution**:
```bash
npm run clean
npm install
npm run build
```

---

## Next Steps

Once the basic client is working:

1. ✅ Test authentication (both username/password and token)
2. ✅ Test getTest() with a real test ID
3. ✅ Test getTestInstances()
4. ⏳ Implement Step 5: LreTestRunner
5. ⏳ Test full end-to-end workflow

---

## Performance Testing

### Measure Authentication Time

```javascript
console.time('auth');
await client.authenticate();
console.timeEnd('auth');
// Expected: < 2 seconds
```

### Measure Run Polling Overhead

```javascript
const runId = 123;
for (let i = 0; i < 10; i++) {
	console.time(`poll-${i}`);
	await client.getRunData(runId);
	console.timeEnd(`poll-${i}`);
}
// Expected: < 500ms per poll
```

---

## CI/CD Integration Test

Create `.github/workflows/test-lre-client.yml` (if using GitHub):

```yaml
name: Test LRE Client

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: |
          cd PC.TFS.BuildTask/LreCiExtension/LreCiTask
          npm install

      - name: Run tests
        run: |
          cd PC.TFS.BuildTask/LreCiExtension/LreCiTask
          npm test

      - name: Build
        run: |
          cd PC.TFS.BuildTask/LreCiExtension/LreCiTask
          npm run build
```

This ensures the TypeScript code compiles and tests pass on every commit.
