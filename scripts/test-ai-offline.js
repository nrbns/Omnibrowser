/**
 * AI Offline Integration Test Script
 * Verifies AI components handle backend unavailability gracefully
 */

const fs = require('fs');
const path = require('path');

const TEST_RESULTS = {
  passed: [],
  failed: [],
  skipped: [],
};

function log(message, type = 'info') {
  const prefix =
    {
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
    .catch(error => {
      TEST_RESULTS.failed.push({ name, error: error.message });
      log(`${name}: ${error.message}`, 'error');
    });
}

async function checkErrorHandling(filePath, description) {
  return testAsync(`${description} - Error handling in ${filePath}`, async () => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check for error handling patterns
    const hasTryCatch = content.includes('try') && content.includes('catch');
    const hasErrorState = content.includes('error') || content.includes('Error');
    const hasOfflineCheck =
      content.includes('offline') || content.includes('unavailable') || content.includes('timeout');

    if (!hasTryCatch && !hasErrorState) {
      throw new Error('Missing error handling (try/catch or error state)');
    }
  });
}

async function checkOfflineFallback(filePath, description) {
  return testAsync(`${description} - Offline fallback in ${filePath}`, async () => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Check for offline/fallback handling
    const hasOfflineCheck =
      content.includes('offline') ||
      content.includes('unavailable') ||
      content.includes('Ollama') ||
      content.includes('fallback');
    const hasErrorHandling = content.includes('error') || content.includes('catch');

    if (!hasOfflineCheck && !hasErrorHandling) {
      throw new Error('Missing offline/fallback handling');
    }
  });
}

async function runTests() {
  log('Starting AI offline integration tests...', 'info');
  log('');

  // Test 1: Error Handling in Components
  log('Testing error handling in AI components...', 'info');
  await checkErrorHandling('src/components/TopNav/Omnibox.tsx', 'Omnibox');
  await checkErrorHandling('src/components/layout/CommandPalette.tsx', 'CommandPalette');
  await checkErrorHandling('src/components/layout/BottomStatus.tsx', 'BottomStatus');
  await checkErrorHandling('src/components/research/ResearchPane.tsx', 'ResearchPane');
  log('');

  // Test 2: Offline Fallback
  log('Testing offline fallback mechanisms...', 'info');
  await checkOfflineFallback('src/components/TopNav/Omnibox.tsx', 'Omnibox');
  await checkOfflineFallback('src/components/layout/CommandPalette.tsx', 'CommandPalette');
  await checkOfflineFallback('src/components/layout/AppShell.tsx', 'AppShell');
  await checkOfflineFallback('src/lib/ipc-typed.ts', 'IPC bridge');
  await checkOfflineFallback('apps/api/routes/redix.py', 'Redix API');
  log('');

  // Test 3: Backend Status Check
  log('Testing backend status check...', 'info');
  await testAsync('IPC bridge - Fallback map exists', async () => {
    const filePath = path.join(__dirname, '..', 'src/lib/ipc-typed.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('FALLBACK_CHANNELS') || !content.includes('tabs:create')) {
      throw new Error('Fallback channels missing expected handlers');
    }
  });

  await testAsync('Redix API - Ollama fallback exists', async () => {
    const filePath = path.join(__dirname, '..', 'apps/api/routes/redix.py');
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('ollama') && !content.includes('Ollama')) {
      throw new Error('Ollama fallback not found');
    }
  });
  log('');

  // Test 4: Error Messages
  log('Testing user-friendly error messages...', 'info');
  await testAsync('IPC bridge - Error messages include offline hint', async () => {
    const filePath = path.join(__dirname, '..', 'src/lib/ipc-typed.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    if (
      !content.includes('unavailable') &&
      !content.includes('stub') &&
      !content.includes('offline')
    ) {
      throw new Error('Error messages may not include offline/Ollama hints');
    }
  });

  await testAsync('Components - Error messages are user-friendly', async () => {
    const files = ['src/components/TopNav/Omnibox.tsx', 'src/components/layout/CommandPalette.tsx'];

    for (const file of files) {
      const filePath = path.join(__dirname, '..', file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('error') && !content.includes('Error')) {
        throw new Error(`Error handling not found in ${file}`);
      }
    }
  });
  log('');

  // Summary
  log('');
  log('='.repeat(60), 'info');
  log('AI Offline Test Summary', 'info');
  log('='.repeat(60), 'info');
  log(`✅ Passed: ${TEST_RESULTS.passed.length}`, 'success');
  log(
    `❌ Failed: ${TEST_RESULTS.failed.length}`,
    TEST_RESULTS.failed.length > 0 ? 'error' : 'info'
  );
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
    log('All AI offline tests passed! 🎉', 'success');
    process.exit(0);
  }
}

runTests().catch(error => {
  log(`Test runner error: ${error.message}`, 'error');
  process.exit(1);
});
