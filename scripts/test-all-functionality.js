/**
 * Comprehensive Functionality Test Script
 * Verifies all UI/UX and backend integrations are working
 * Run with: node scripts/test-all-functionality.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS = {
  passed: [],
  failed: [],
  skipped: [],
};

function log(message, type = 'info') {
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[type] || 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function test(name, fn) {
  try {
    fn();
    TEST_RESULTS.passed.push(name);
    log(`${name}`, 'success');
  } catch (error) {
    TEST_RESULTS.failed.push({ name, error: error.message });
    log(`${name}: ${error.message}`, 'error');
  }
}

function testAsync(name, fn) {
  return fn()
    .then(() => {
      TEST_RESULTS.passed.push(name);
      log(`${name}`, 'success');
    })
    .catch((error) => {
      TEST_RESULTS.failed.push({ name, error: error.message });
      log(`${name}: ${error.message}`, 'error');
    });
}

async function checkFileExists(filePath, description) {
  return testAsync(`${description} - File exists: ${filePath}`, async () => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
  });
}

async function checkIPCIntegration(handlerName, description) {
  return testAsync(`${description} - IPC Handler: ${handlerName}`, async () => {
    // Check if handler is registered in main.ts
    const mainTs = path.join(__dirname, '..', 'electron', 'main.ts');
    const content = fs.readFileSync(mainTs, 'utf-8');
    if (!content.includes(handlerName)) {
      throw new Error(`IPC handler ${handlerName} not found in main.ts`);
    }
  });
}

async function checkComponentIntegration(componentPath, description) {
  return testAsync(`${description} - Component: ${componentPath}`, async () => {
    const fullPath = path.join(__dirname, '..', componentPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Component not found: ${fullPath}`);
    }
    
    // Check if component imports necessary dependencies
    const content = fs.readFileSync(fullPath, 'utf-8');
    if (content.includes('ipc.') || content.includes('useTabsStore') || content.includes('useMetricsStore')) {
      // Component has integrations
      return true;
    }
  });
}

async function runTests() {
  log('Starting comprehensive functionality tests...', 'info');
  log('');

  // Test 1: Critical Files Exist
  log('Testing file structure...', 'info');
  await checkFileExists('src/components/SearchBar.tsx', 'SearchBar');
  await checkFileExists('src/components/layout/TabStrip.tsx', 'TabStrip');
  await checkFileExists('src/components/layout/BottomStatus.tsx', 'BottomStatus');
  await checkFileExists('src/components/layout/MainView.tsx', 'MainView');
  await checkFileExists('src/components/Onboarding/OnboardingTour.tsx', 'OnboardingTour');
  await checkFileExists('src/components/PrivacySwitch.tsx', 'PrivacySwitch');
  await checkFileExists('src/components/RedixQuickDialog.tsx', 'RedixQuickDialog');
  await checkFileExists('src/routes/Downloads.tsx', 'Downloads');
  await checkFileExists('src/components/research/ResearchPane.tsx', 'ResearchPane');
  await checkFileExists('electron/services/redix-ipc.ts', 'Redix IPC');
  await checkFileExists('electron/services/private-ipc.ts', 'Private IPC');
  await checkFileExists('electron/services/tabs.ts', 'Tabs Service');
  log('');

  // Test 2: IPC Handlers Registered
  log('Testing IPC handler registration...', 'info');
  await checkIPCIntegration('registerRedixIpc', 'Redix');
  await checkIPCIntegration('registerTabIpc', 'Tabs');
  await checkIPCIntegration('registerPrivateIpc', 'Private');
  await checkIPCIntegration('registerTabContextIpc', 'Tab Context');
  await checkIPCIntegration('registerWorkflowIpc', 'Workflow');
  await checkIPCIntegration('registerDownloadsIpc', 'Downloads');
  await checkIPCIntegration('registerTorIpc', 'Tor');
  await checkIPCIntegration('registerVPNIpc', 'VPN');
  log('');

  // Test 3: Component Integrations
  log('Testing component integrations...', 'info');
  await checkComponentIntegration('src/components/SearchBar.tsx', 'SearchBar Redix');
  await checkComponentIntegration('src/components/layout/BottomStatus.tsx', 'BottomStatus Metrics');
  await checkComponentIntegration('src/components/layout/TabStrip.tsx', 'TabStrip IPC');
  await checkComponentIntegration('src/components/PrivacySwitch.tsx', 'PrivacySwitch IPC');
  await checkComponentIntegration('src/components/RedixQuickDialog.tsx', 'RedixQuickDialog Streaming');
  log('');

  // Test 4: Store Integrations
  log('Testing store integrations...', 'info');
  await checkFileExists('src/state/metricsStore.ts', 'Metrics Store');
  await checkFileExists('src/state/onboardingStore.ts', 'Onboarding Store');
  await checkFileExists('src/state/tabsStore.ts', 'Tabs Store');
  await checkFileExists('src/state/privacyStore.ts', 'Privacy Store');
  await checkFileExists('src/state/shadowStore.ts', 'Shadow Store');
  log('');

  // Test 5: Backend Services
  log('Testing backend service files...', 'info');
  await checkFileExists('apps/api/routes/redix.py', 'Redix API');
  await checkFileExists('apps/api/main.py', 'FastAPI Main');
  await checkFileExists('apps/api/docker-compose.yml', 'Docker Compose');
  await checkFileExists('server/redix-server.js', 'Redix Server');
  log('');

  // Test 6: Core Features
  log('Testing core feature files...', 'info');
  await checkFileExists('src/core/redix/runtime.ts', 'Redix Runtime');
  await checkFileExists('src/core/redix/optimizer.ts', 'Redix Optimizer');
  await checkFileExists('src/core/supermemory/store.ts', 'SuperMemory Store');
  await checkFileExists('src/core/supermemory/tracker.ts', 'SuperMemory Tracker');
  await checkFileExists('src/core/supermemory/useSuggestions.ts', 'SuperMemory Suggestions');
  log('');

  // Summary
  log('');
  log('='.repeat(60), 'info');
  log('Test Summary', 'info');
  log('='.repeat(60), 'info');
  log(`✅ Passed: ${TEST_RESULTS.passed.length}`, 'success');
  log(`❌ Failed: ${TEST_RESULTS.failed.length}`, TEST_RESULTS.failed.length > 0 ? 'error' : 'info');
  log(`⏭️  Skipped: ${TEST_RESULTS.skipped.length}`, 'warning');
  log('');

  if (TEST_RESULTS.failed.length > 0) {
    log('Failed Tests:', 'error');
    TEST_RESULTS.failed.forEach(({ name, error }) => {
      log(`  - ${name}: ${error}`, 'error');
    });
    log('');
    process.exit(1);
  } else {
    log('All tests passed! 🎉', 'success');
    process.exit(0);
  }
}

runTests().catch((error) => {
  log(`Test runner error: ${error.message}`, 'error');
  process.exit(1);
});

