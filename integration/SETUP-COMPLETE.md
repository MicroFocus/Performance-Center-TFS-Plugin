# Integration Test Suite - Complete Setup

## 📦 What Was Created

I've created a comprehensive integration test suite based on your directory structure at `C:\Git\plugin\Performance-Center-TFS-Plugin\integration\`.

### File Structure

```
C:\Git\plugin\Performance-Center-TFS-Plugin\
│
├── integration/                                    ✅ Your existing directory
│   ├── .gitignore                                  ✅ NEW - Protects credentials
│   ├── README.md                                   ✅ NEW - Full documentation
│   ├── QUICK-START.md                              ✅ NEW - Getting started guide
│   │
│   ├── integration-tests.properties.template       ✅ YOU CREATED - Perfect!
│   ├── integration-tests.properties                ❌ NOT TRACKED (in .gitignore)
│   │
│   ├── __tests__/                                  ✅ NEW - Test suites
│   │   ├── auth.integration.test.ts                ✅ Authentication tests
│   │   ├── test-management.integration.test.ts     ✅ Test/instance tests
│   │   └── run-execution.integration.test.ts       ✅ Run execution tests (⚠️ uses VUDs)
│   │
│   └── test-utils/                                 ✅ NEW - Test utilities
│       ├── PropertiesLoader.ts                     ✅ Reads .properties file
│       ├── global-setup.ts                         ✅ Test suite initialization
│       └── global-teardown.ts                      ✅ Test suite cleanup
│
├── PC.TFS.BuildTask/LreCiExtension/LreCiTask/
│   ├── package.json                                ✅ UPDATED - Added test scripts
│   ├── jest.integration.config.js                  ✅ NEW - Integration test config
│   └── ...
│
└── .gitignore                                      ✅ UPDATED - Added integration/

```

---

## 🎯 What Each Test Suite Does

### 1. **Authentication Tests** (`auth.integration.test.ts`)

**Tests 6 scenarios:**
- ✅ Successful authentication with configured credentials
- ✅ Failed authentication with invalid credentials  
- ✅ Session persistence across multiple requests
- ✅ Logout functionality
- ✅ Multi-tenant authentication (if configured)
- ✅ Proxy authentication (if configured)

**Safe**: ✅ No destructive operations  
**Duration**: ~10-15 seconds

---

### 2. **Test Management Tests** (`test-management.integration.test.ts`)

**Tests 5 scenarios:**
- ✅ Retrieve test by ID
- ✅ Retrieve test instances for a test
- ✅ Create new test instance
- ✅ Handle non-existent test gracefully
- ✅ Retrieve test with auto-trend report info

**Safe**: ✅ Only reads data (except createTestInstance)  
**Duration**: ~15-20 seconds

---

### 3. **Run Execution Tests** (`run-execution.integration.test.ts`)

⚠️ **Warning**: These tests are **DISABLED by default** and will **SKIP** unless you set:
```properties
integration.test.executeRun=true
```

**Tests 4 scenarios:**
- ⚠️ Start a test run (consumes VUD license)
- ⚠️ Monitor run state changes (polling)
- ⚠️ Retrieve run event logs
- ⚠️ Stop a running test

**Safe**: ❌ **Destructive** - Executes real tests  
**Duration**: ~30-60+ minutes (depends on test duration)  
**Cost**: VUD licenses

---

## 🔧 How to Run

### Step 1: Setup (One-Time)

```powershell
# Navigate to integration directory
cd C:\Git\plugin\Performance-Center-TFS-Plugin\integration

# Copy your template (you already created this!)
cp integration-tests.properties.template integration-tests.properties

# Edit with your actual credentials
notepad integration-tests.properties
```

### Step 2: Install Dependencies

```powershell
cd ..\PC.TFS.BuildTask\LreCiExtension\LreCiTask
npm install
```

### Step 3: Build TypeScript

```powershell
npm run build
```

### Step 4: Run Tests

```powershell
# Safe mode - Only authentication and read operations
npm run test:integration

# Full workflow (⚠️ executes actual test runs!)
# Only do this if you edited integration-tests.properties:
#   integration.test.executeRun=true
npm run test:integration
```

---

## 🛡️ Safety Features

### 1. **Auto-Skip if No Configuration**
If `integration-tests.properties` doesn't exist, ALL tests are skipped:
```
⚠️  Skipping integration tests: integration-tests.properties not found
```

### 2. **Explicit Opt-In for Destructive Tests**
Run execution tests require explicit configuration:
```properties
integration.test.executeRun=true  # Must be explicitly set
```

Default is `false` (safe mode).

### 3. **Git Protection**
`integration-tests.properties` is in `.gitignore` - credentials will NEVER be committed.

### 4. **Visual Warnings**
When destructive operations are enabled, you see:
```
⚠️⚠️⚠️  RUN EXECUTION TESTS ENABLED  ⚠️⚠️⚠️
   This will execute a REAL test and consume VUD licenses!
   Server: https://your-lre-server.com
   Duration: 30 minutes
```

### 5. **Automatic Cleanup**
Even if tests fail, cleanup runs:
- Stops any running tests created during the test
- Logs out of LRE session

---

## 📊 Test Execution Modes

### Mode 1: Safe (Default)

```properties
integration.test.executeRun=false
integration.test.downloadReports=false
```

**What runs:**
- ✅ Authentication (8 tests)
- ✅ Test management (5 tests)
- ❌ Run execution (0 tests - skipped)

**Duration**: ~30 seconds  
**Cost**: $0 (no VUD usage)  
**Risk**: ✅ None

---

### Mode 2: Full Integration

```properties
integration.test.executeRun=true
integration.test.downloadReports=true
```

**What runs:**
- ✅ Authentication (8 tests)
- ✅ Test management (5 tests)
- ⚠️ Run execution (4 tests)

**Duration**: ~30-60+ minutes  
**Cost**: ⚠️ VUD licenses consumed  
**Risk**: ⚠️ Executes real test

---

## 🎨 Example Output (Safe Mode)

```
═══════════════════════════════════════════════════════════════
🧪  OpenText Enterprise Performance Engineering Integration Test Suite
═══════════════════════════════════════════════════════════════

✅ Configuration loaded successfully

📋 Test Configuration:
   Server: https://lre-dev.yourcompany.com
   Project: DEFAULT/PerformanceTests
   Proxy: None
   Tenant: None

🔑 Authentication:
   Method: Username/Password
   Username: test-user

🧪 Test Scope:
   Test ID: 42
   TestSet ID: 10
   Test Instance: Will be created

⚙️  Test Behavior:
   Execute Runs: ❌ DISABLED (SAFE MODE)
   Download Reports: ❌ DISABLED
   Test Cleanup: ✅ ENABLED

───────────────────────────────────────────────────────────────

🔗 Testing against: https://lre-dev.yourcompany.com
📦 Project: DEFAULT/PerformanceTests
🔑 Auth method: Username/Password

 PASS  integration/__tests__/auth.integration.test.ts (8.2 s)
  LRE Authentication Integration Tests
	✓ should authenticate successfully (3.2 s)
	✓ should fail authentication with invalid credentials (2.1 s)
	✓ should maintain session across multiple requests (8.9 s)
	✓ should handle logout correctly (2.8 s)

✅ Retrieved test: WebTours Load Test (ID: 42)
   Path: /Subject/Performance/

✅ Found 3 test instances for test ID 42
   First instance ID: 125
   TestSetId: 10

 PASS  integration/__tests__/test-management.integration.test.ts (12.4 s)
  LRE Test Management Integration Tests
	✓ should retrieve test by ID (1.9 s)
	✓ should retrieve test instances for a test (2.1 s)
	✓ should create a new test instance (4.6 s)
	✓ should handle non-existent test gracefully (1.2 s)
	✓ should retrieve test with auto-trend report info (2.6 s)

⚠️  Skipping run execution tests: integration.test.executeRun=false

═══════════════════════════════════════════════════════════════
✅  Integration Test Suite Complete
═══════════════════════════════════════════════════════════════

Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        20.6 s
```

---

## 🔍 Verify Your Setup

Before running tests, verify your configuration file looks like this:

```properties
# Required fields
lre.server.url=https://your-lre.com          # ✅ Your actual LRE server
lre.domain=DEFAULT                            # ✅ Your domain
lre.project=YourProject                       # ✅ Your project
lre.auth.username=your-user                   # ✅ Your username
lre.auth.password=your-password               # ✅ Your password
lre.test.id=1                                 # ✅  A real test ID
lre.testset.id=1                              # ✅ A real testset ID

# Safety flags (keep these defaults for first run)
integration.test.executeRun=false             # ✅ SAFE
integration.test.downloadReports=false        # ✅ SAFE
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `integration/QUICK-START.md` | **Start here** - Quick setup guide |
| `integration/README.md` | Complete integration test documentation |
| `integration/integration-tests.properties.template` | Configuration template (you created this!) |
| `PC.TFS.BuildTask/.../docs/TESTING-GUIDE.md` | General testing guide |
| `PC.TFS.BuildTask/.../docs/IMPLEMENTATION-PROGRESS.md` | Overall implementation status |

---

## ✅ Next Steps

1. **Copy and configure** your properties file:
   ```powershell
   cd integration
   cp integration-tests.properties.template integration-tests.properties
   # Edit integration-tests.properties
   ```

2. **Install dependencies**:
   ```powershell
   cd ..\PC.TFS.BuildTask\LreCiExtension\LreCiTask
   npm install
   ```

3. **Build TypeScript**:
   ```powershell
   npm run build
   ```

4. **Run safe integration tests**:
   ```powershell
   npm run test:integration
   ```

5. **If all passes** ✅:
   - Your TypeScript LreClient is working!
   - Your LRE connection is validated!
   - Ready to continue with Step 5 (LreTestRunner)

---

## 🚀 What This Enables

With passing integration tests, you have:

✅ **Validated** that TypeScript can talk to your LRE server  
✅ **Confirmed** authentication works  
✅ **Tested** test retrieval and instance management  
✅ **Proven** the architecture is sound  
✅ **Built confidence** to continue the full TypeScript migration

You're now ready to implement the remaining orchestration logic (Steps 5-13) with confidence that the foundation works!
