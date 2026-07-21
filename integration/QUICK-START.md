# Integration Tests - Quick Start Guide

## ✅ You've already created the template! Here's how to use it:

### Step 1: Copy your template

```powershell
cd C:\Git\plugin\Performance-Center-TFS-Plugin\integration
cp integration-tests.properties.template integration-tests.properties
```

### Step 2: Edit `integration-tests.properties`

Fill in your actual LRE values:

```properties
lre.server.url=https://your-actual-server.com:443
lre.domain=DEFAULT
lre.project=YourActualProject
lre.auth.username=your-actual-username
lre.auth.password=your-actual-password
lre.test.id=1  # Use a real test ID from your LRE
lre.testset.id=1  # Use a real testset ID
```

### Step 3: Install dependencies

```powershell
cd ..\PC.TFS.BuildTask\LreCiExtension\LreCiTask
npm install
```

### Step 4: Build TypeScript

```powershell
npm run build
```

### Step 5: Run integration tests!

```powershell
# Run all integration tests (safe mode - no test execution)
npm run test:integration

# Or run in extra-safe mode
npm run test:integration:safe
```

## What will run?

With default settings (`integration.test.executeRun=false`):

✅ **Authentication tests** (~10 seconds)
- Username/password authentication
- Session persistence
- Logout

✅ **Test management tests** (~15 seconds)  
- Get test by ID
- Get test instances
- Create test instance (if needed)

❌ **Run execution tests** - SKIPPED (safe!)
❌ **Report download tests** - SKIPPED (safe!)

### To test FULL workflow (⚠️ uses VUD licenses):

Edit `integration-tests.properties`:

```properties
integration.test.executeRun=true
integration.test.downloadReports=true
```

Then run:
```powershell
npm run test:integration
```

⚠️ This will execute a REAL test run!

## Expected Output (Safe Mode)

```
═══════════════════════════════════════════════════════════════
🧪  OpenText Enterprise Performance Engineering Integration Test Suite
═══════════════════════════════════════════════════════════════

✅ Configuration loaded successfully

📋 Test Configuration:
   Server: https://your-server.com
   Project: DEFAULT/YourProject
   Proxy: None
   Tenant: None

🔑 Authentication:
   Method: Username/Password
   Username: your-username

🧪 Test Scope:
   Test ID: 1
   TestSet ID: 1
   Test Instance: Will be created

⚙️  Test Behavior:
   Execute Runs: ❌ DISABLED (SAFE MODE)
   Download Reports: ❌ DISABLED
   Test Cleanup: ✅ ENABLED

───────────────────────────────────────────────────────────────

 PASS  integration/__tests__/auth.integration.test.ts
  LRE Authentication Integration Tests
	✓ should authenticate successfully (3421 ms)
	✓ should fail authentication with invalid credentials (2134 ms)
	✓ should maintain session across multiple requests (8765 ms)
	✓ should handle logout correctly (2987 ms)

 PASS  integration/__tests__/test-management.integration.test.ts
  LRE Test Management Integration Tests
	✓ should retrieve test by ID (1876 ms)
	✓ should retrieve test instances for a test (2134 ms)
	✓ should create a new test instance (4567 ms)
	✓ should handle non-existent test gracefully (1234 ms)

Test Suites: 2 passed, 2 total
Tests:       8 passed, 8 total
Time:        28.3 s
```

## Troubleshooting

### ❌ "Properties file not found"

You need to create it:
```powershell
cp integration-tests.properties.template integration-tests.properties
```

### ❌ "Authentication failed"

Check these in `integration-tests.properties`:
- Server URL is correct
- Username/password are correct
- Domain and project names match LRE

### ❌ "Cannot find test ID"

Your test ID doesn't exist in LRE. Get a valid one:
1. Log into the Enterprise Performance Engineering web UI
2. Go to **Test Management** > **Test Plan**
3. Find your test, note the ID
4. Update `lre.test.id` in properties file

### ❌ TypeScript compilation errors

```powershell
npm run clean
npm install
npm run build
```

## Next Steps

Once integration tests pass:

1. ✅ Your LreClient is working with a real server!
2. ✅ Continue implementing Step 5 (LreTestRunner)
3. ✅ Build the complete solution

## Need Help?

Check these files:
- `integration/README.md` - Full integration test documentation
- `integration/integration-tests.properties.template` - All available configuration options
- `PC.TFS.BuildTask/LreCiExtension/LreCiTask/docs/TESTING-GUIDE.md` - General testing guide
