# OpenText Enterprise Performance Engineering Integration Tests

This directory contains integration tests that run against a **real LRE server**.

## ⚠️ Important Notes

- **These tests require a live LRE instance**
- **Tests may consume VUD licenses if `executeRun=true`**
- **Credentials are NEVER committed to the repository**

## Setup

### 1. Create Configuration File

```bash
cd integration
cp integration-tests.properties.template integration-tests.properties
```

### 2. Edit Configuration

Edit `integration-tests.properties` with your LRE server details:

```properties
lre.server.url=https://your-lre-server.com:443
lre.domain=DEFAULT
lre.project=YourProject
lre.auth.username=your-username
lre.auth.password=your-password
lre.test.id=1
```

### 3. Run Tests

```bash
# Run all integration tests
npm run test:integration

# Run only read-only tests (no run execution)
npm run test:integration -- --testNamePattern="read-only"

# Run with verbose output
npm run test:integration -- --verbose
```

## Test Suites

### 1. Authentication Tests (`auth.integration.test.ts`)
- ✅ Username/password authentication
- ✅ API token authentication (if configured)
- ✅ Session persistence
- ✅ Logout

### 2. Test Management Tests (`test-management.integration.test.ts`)
- ✅ Get test by ID
- ✅ Get test instances
- ✅ Create test instance (if configured)

### 3. Run Execution Tests (`run-execution.integration.test.ts`)
- ⚠️ Start test run (requires `executeRun=true`)
- ⚠️ Monitor run progress
- ⚠️ Get event logs
- ⚠️ Stop run

### 4. Report Download Tests (`report-download.integration.test.ts`)
- ⚠️ Download run results (requires `downloadReports=true`)
- ⚠️ Extract ZIP files
- ⚠️ Download trend reports

### 5. End-to-End Tests (`e2e.integration.test.ts`)
- ⚠️ Full workflow from authentication to report download

## Configuration Flags

### `integration.test.executeRun`

**Default**: `false`

When `false`:
- ✅ Tests authentication
- ✅ Tests read operations (getTest, getTestInstances)
- ❌ Skips run execution (no VUD license consumption)

When `true`:
- ⚠️ **Warning**: Will execute an actual test run
- ⚠️ **Warning**: Will consume VUD licenses
- ✅ Tests full workflow

### `integration.test.downloadReports`

**Default**: `false`

Requires `executeRun=true`. Downloads and validates report artifacts.

### `integration.test.testCleanup`

**Default**: `true`

Tests cleanup operations (stop run, logout).

## Safety Features

1. **Auto-Skip**: Tests skip automatically if `integration-tests.properties` is missing
2. **Explicit Flags**: Destructive operations require explicit opt-in
3. **Timeout Protection**: All tests have maximum execution time limits
4. **Cleanup**: Tests clean up resources (stop runs, logout) even on failure

## Typical Workflow

### First Time Setup (Safe)

```properties
integration.test.executeRun=false
integration.test.downloadReports=false
```

This mode is **safe** and will only:
- Test authentication
- Read test details
- Read test instances

### Full Integration Testing (Consumes Resources)

```properties
integration.test.executeRun=true
integration.test.downloadReports=true
lre.run.timeslotDurationMinutes=30
```

⚠️ **Warning**: This will:
- Execute a real test
- Consume VUD licenses
- Take at least 30+ minutes

## Troubleshooting

### ❌ "Properties file not found"

**Solution**: Copy the template and configure it:
```bash
cp integration-tests.properties.template integration-tests.properties
```

### ❌ "Authentication failed"

**Check**:
1. Server URL is correct and accessible
2. Credentials are valid
3. Proxy settings (if required)
4. Tenant GUID (if multi-tenant)

### ❌ "Test timeout"

**Solution**: Increase timeout in properties:
```properties
lre.test.maxWaitMinutes=120
```

### ❌ "Cannot find test ID"

**Solution**: Use an existing test ID from your LRE instance:
1. Log into LRE web UI
2. Go to Test Management > Test Plan
3. Find your test ID

## CI/CD Integration

To run integration tests in CI/CD:

```yaml
# GitHub Actions example
- name: Run Integration Tests
  env:
	LRE_SERVER_URL: ${{ secrets.LRE_SERVER_URL }}
	LRE_USERNAME: ${{ secrets.LRE_USERNAME }}
	LRE_PASSWORD: ${{ secrets.LRE_PASSWORD }}
  run: |
	npm run test:integration
```

Store credentials in your CI/CD secrets, not in the properties file.

## Performance Benchmarks

Expected execution times (on successful run):

| Test Suite | Duration (executeRun=false) | Duration (executeRun=true) |
|------------|----------------------------|----------------------------|
| Authentication | 2-5 seconds | 2-5 seconds |
| Test Management | 5-10 seconds | 5-10 seconds |
| Run Execution | N/A (skipped) | 30-60+ minutes |
| Report Download | N/A (skipped) | 2-5 minutes |
| End-to-End | 10-15 seconds | 35-70+ minutes |

## Security Best Practices

1. ✅ **Never commit** `integration-tests.properties`
2. ✅ **Use API tokens** instead of passwords when possible
3. ✅ **Rotate credentials** regularly
4. ✅ **Use dedicated test accounts** with minimal permissions
5. ✅ **Store CI/CD credentials** in secret management systems

## Cleanup

To remove test artifacts:

```bash
cd integration
rm -rf test-results/
rm -rf artifacts/
rm *.log
```
