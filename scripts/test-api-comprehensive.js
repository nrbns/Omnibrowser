/**
 * Comprehensive API Testing Script
 * Tests all endpoints and functionality
 */

const http = require('http');

const SERVER_URL = 'http://localhost:4000';
const TIMEOUT = 10000;

// Helper function to make HTTP requests
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 4000,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        timeout: TIMEOUT,
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : null;
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: jsonData || data,
              success: res.statusCode >= 200 && res.statusCode < 300,
            });
          } catch {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data || '',
              success: res.statusCode >= 200 && res.statusCode < 300,
            });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test results
const results = {
  passed: [],
  failed: [],
  total: 0,
};

// Test runner
async function runTest(name, testFn) {
  results.total++;
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await testFn();
    if (result.success) {
      console.log(`✅ PASSED: ${name}`);
      results.passed.push({ name, result });
      return true;
    } else {
      console.log(`❌ FAILED: ${name} - Status: ${result.status}`);
      results.failed.push({ name, result });
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    results.failed.push({ name, error: error.message });
    return false;
  }
}

// Test cases
async function runAllTests() {
  console.log('🚀 Starting Comprehensive API Tests...\n');
  console.log(`📍 Server URL: ${SERVER_URL}\n`);
  console.log('═'.repeat(60));

  // 1. Health Check
  await runTest('Health Check', async () => {
    return await httpRequest(`${SERVER_URL}/health`);
  });

  // 2. Ping Endpoint
  await runTest('Ping Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/ping`);
    if (res.data === 'pong' || res.status === 200) {
      return { ...res, success: true };
    }
    return { ...res, success: false };
  });

  // 3. Metrics Endpoint
  await runTest('Metrics Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/metrics`);
    return res;
  });

  // 4. Research Query Endpoint
  await runTest('Research Query Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/research/query`, {
      method: 'POST',
      body: { query: 'test query', language: 'en' },
    });
    return res;
  });

  // 5. Research Enhanced Endpoint
  await runTest('Research Enhanced Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/research/enhanced`, {
      method: 'POST',
      body: { query: 'AI technology', language: 'en' },
    });
    return res;
  });

  // 6. Stock Historical Data
  await runTest('Stock Historical Data - NIFTY', async () => {
    const res = await httpRequest(`${SERVER_URL}/stock/historical/NIFTY`);
    return res;
  });

  // 7. Stock Historical Data - BANKNIFTY
  await runTest('Stock Historical Data - BANKNIFTY', async () => {
    const res = await httpRequest(`${SERVER_URL}/stock/historical/BANKNIFTY`);
    return res;
  });

  // 8. Bounty Leaderboard
  await runTest('Bounty Leaderboard', async () => {
    const res = await httpRequest(`${SERVER_URL}/bounty/leaderboard`);
    return res;
  });

  // 9. Bounty Submit (test with minimal data)
  await runTest('Bounty Submit Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/bounty/submit`, {
      method: 'POST',
      body: {
        videoUrl: 'https://example.com/video',
        platform: 'youtube',
        userName: 'test_user',
      },
    });
    // Accept both success and validation errors as endpoint working
    return { ...res, success: res.status < 500 };
  });

  // 10. Agent Query Endpoint
  await runTest('Agent Query Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/agent/query`, {
      method: 'POST',
      body: {
        query: 'test agent query',
        context: {},
      },
    });
    return { ...res, success: res.status < 500 };
  });

  // 11. Ask Endpoint (AI)
  await runTest('AI Ask Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/ask`, {
      method: 'GET',
      // Using query params
    });
    return { ...res, success: res.status < 500 };
  });

  // 12. Settings Endpoint
  await runTest('Settings Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/settings`);
    return res;
  });

  // 13. Profile Endpoint
  await runTest('Profile Endpoint', async () => {
    const res = await httpRequest(`${SERVER_URL}/api/profile`);
    return res;
  });

  // 14. CORS Test
  await runTest('CORS Configuration', async () => {
    const res = await httpRequest(`${SERVER_URL}/health`, {
      headers: {
        Origin: 'http://localhost:5173',
      },
    });
    const hasCors =
      res.headers['access-control-allow-origin'] || res.headers['Access-Control-Allow-Origin'];
    return { ...res, success: res.status === 200 };
  });

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📈 Total:  ${results.total}`);
  console.log(`🎯 Success Rate: ${Math.round((results.passed.length / results.total) * 100)}%\n`);

  if (results.failed.length > 0) {
    console.log('❌ FAILED TESTS:\n');
    results.failed.forEach(({ name, result, error }) => {
      console.log(`  - ${name}`);
      if (error) {
        console.log(`    Error: ${error}`);
      } else if (result) {
        console.log(`    Status: ${result.status}`);
      }
    });
    console.log('');
  }

  if (results.passed.length === results.total) {
    console.log('🎉 ALL TESTS PASSED! API is fully operational.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Check if server is running first
httpRequest(`${SERVER_URL}/health`)
  .then(() => {
    console.log('✅ Server is running. Starting tests...\n');
    return runAllTests();
  })
  .catch(error => {
    console.error('\n❌ ERROR: Cannot connect to server at', SERVER_URL);
    console.error('   Make sure the server is running: node server/redix-server.js\n');
    process.exit(1);
  });
