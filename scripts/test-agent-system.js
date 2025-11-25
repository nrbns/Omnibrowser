#!/usr/bin/env node
/**
 * Agent System Test Script (Tauri-aware)
 * Ensures both the web and Tauri builds ship functional agent plumbing.
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
    log(name, 'success');
  } catch (error) {
    TEST_RESULTS.failed.push({ name, error: error.message });
    log(`${name}: ${error.message}`, 'error');
  }
}

function testAsync(name, fn) {
  return fn()
    .then(() => {
      TEST_RESULTS.passed.push(name);
      log(name, 'success');
    })
    .catch(error => {
      TEST_RESULTS.failed.push({ name, error: error.message });
      log(`${name}: ${error.message}`, 'error');
    });
}

async function checkFileExists(filePath, description) {
  return testAsync(`${description} - File exists: ${filePath}`, async () => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
  });
}

async function checkCodeContains(filePath, searchString, description) {
  return testAsync(`${description} - Code contains: ${searchString}`, async () => {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    if (!content.includes(searchString)) {
      throw new Error(`Code not found: ${searchString} in ${filePath}`);
    }
  });
}

async function runTests() {
  log('Starting Agent System Tests...', 'info');
  log('='.repeat(60), 'info');
  log('');

  const tauriAgentFiles = [
    'tauri-migration/src/agent/registry.ts',
    'tauri-migration/src/agent/runAgent.ts',
  ];
  const webAgentFiles = ['src/agent/registry.ts', 'src/agent/runAgent.ts'];

  // Test 1: Core agent modules exist
  log('Test 1: Core Agent Modules (Web + Tauri)', 'info');
  for (const file of [...tauriAgentFiles, ...webAgentFiles]) {
    await checkFileExists(file, `Agent module: ${file}`);
  }
  log('');

  // Test 2: Registries register tools
  log('Test 2: Agent Tool Registrations', 'info');
  await checkCodeContains(
    'src/agent/registry.ts',
    'toolRegistry.register',
    'Web registry has tools'
  );
  await checkCodeContains(
    'tauri-migration/src/agent/registry.ts',
    'toolRegistry.register',
    'Tauri registry has tools'
  );
  log('');

  // Test 3: Tauri command bridge wired up
  log('Test 3: Tauri Command Bridge', 'info');
  await checkCodeContains(
    'tauri-migration/src-tauri/src/main.rs',
    'tauri::Builder::default()',
    'Tauri builder declared'
  );
  await checkCodeContains(
    'tauri-migration/src-tauri/src/main.rs',
    'generate_handler![',
    'Tauri commands registered'
  );
  log('');

  // Test 4: IPC fallbacks available in both bundles
  log('Test 4: IPC Fallback Maps', 'info');
  await checkCodeContains('src/lib/ipc-typed.ts', 'FALLBACK_CHANNELS', 'Web IPC fallback map');
  await checkCodeContains(
    'tauri-migration/src/lib/ipc-typed.ts',
    'FALLBACK_CHANNELS',
    'Tauri IPC fallback map'
  );
  log('');

  // Test 5: Front-end agent surfaces exist
  log('Test 5: Frontend Agent Surfaces', 'info');
  await checkFileExists('src/routes/AgentConsole.tsx', 'Web AgentConsole component');
  await checkFileExists('src/components/AgentOverlay.tsx', 'Web AgentOverlay component');
  await checkFileExists(
    'tauri-migration/src/routes/AgentConsole.tsx',
    'Tauri AgentConsole component'
  );
  await checkFileExists(
    'tauri-migration/src/components/AgentOverlay.tsx',
    'Tauri AgentOverlay component'
  );
  log('');

  // Test 6: Agent runtime & planner hooks
  log('Test 6: Runtime + Planner plumbing', 'info');
  await checkFileExists('src/core/agents/runtime.ts', 'Agent runtime');
  await checkCodeContains(
    'src/core/agents/runtime.ts',
    'createAgentRuntime',
    'Runtime factory exported'
  );
  await checkFileExists('src/agents/planner/index.ts', 'Planner index');
  await checkCodeContains(
    'src/agents/planner/index.ts',
    'createPlanner',
    'Planner factory exported'
  );
  log('');

  // Test 7: UI uses agent runtime
  log('Test 7: UI telemetry wiring', 'info');
  await checkCodeContains('src/routes/Runs.tsx', 'agentRuntime', 'Runs page uses agent runtime');
  await checkCodeContains(
    'src/routes/Runs.tsx',
    'AgentTimeline',
    'Runs page renders AgentTimeline'
  );
  log('');

  // Summary
  log('');
  log('='.repeat(60), 'info');
  log('Agent System Test Summary', 'info');
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
    log('All agent system tests passed! 🎉', 'success');
    process.exit(0);
  }
}

runTests().catch(error => {
  log(`Test runner error: ${error.message}`, 'error');
  process.exit(1);
});
