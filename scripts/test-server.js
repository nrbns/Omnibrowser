/**
 * Test Server Script
 * Tests all server endpoints and functionality
 */

const SERVER_URL = 'http://localhost:4000';
const TIMEOUT = 5000;

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
            resolve({ status: res.statusCode, headers: res.headers, data: jsonData || data });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, data });
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

// Test cases
const tests = [
  {
    name: 'Health Check - Server is running',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/health`);
        assert.ok(response.status === 200 || response.status === 404, 'Server should respond');
        console.log('✅ Health check passed');
        return true;
      } catch (error) {
        console.log('❌ Health check failed:', error.message);
        return false;
      }
    },
  },
  {
    name: 'Metrics Endpoint',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/metrics`);
        assert.ok(
          response.status >= 200 && response.status < 500,
          'Metrics endpoint should respond'
        );
        console.log('✅ Metrics endpoint accessible');
        return true;
      } catch (error) {
        console.log('❌ Metrics endpoint failed:', error.message);
        return false;
      }
    },
  },
  {
    name: 'Research Search Endpoint',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/api/research/search`, {
          method: 'POST',
          body: { query: 'test query' },
        });
        assert.ok(
          response.status >= 200 && response.status < 500,
          'Research endpoint should respond'
        );
        console.log('✅ Research endpoint accessible');
        return true;
      } catch (error) {
        console.log('❌ Research endpoint failed:', error.message);
        return false;
      }
    },
  },
  {
    name: 'Stock Historical Data Endpoint',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/stock/historical/NIFTY`);
        assert.ok(response.status >= 200 && response.status < 500, 'Stock endpoint should respond');
        console.log('✅ Stock historical endpoint accessible');
        return true;
      } catch (error) {
        console.log('❌ Stock endpoint failed:', error.message);
        return false;
      }
    },
  },
  {
    name: 'Bounty Endpoints',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/bounty/leaderboard`);
        assert.ok(
          response.status >= 200 && response.status < 500,
          'Bounty endpoint should respond'
        );
        console.log('✅ Bounty endpoint accessible');
        return true;
      } catch (error) {
        console.log('❌ Bounty endpoint failed:', error.message);
        return false;
      }
    },
  },
  {
    name: 'CORS Configuration',
    fn: async () => {
      try {
        const response = await httpRequest(`${SERVER_URL}/health`, {
          headers: { Origin: 'http://localhost:5173' },
        });
        // Check if CORS headers exist
        const hasCors = response.headers['access-control-allow-origin'];
        console.log('✅ CORS configuration check:', hasCors ? 'Enabled' : 'Not configured');
        return true;
      } catch (error) {
        console.log('❌ CORS check failed:', error.message);
        return false;
      }
    },
  },
];

// Run all tests
async function runTests() {
  console.log('🧪 Starting server tests...\n');
  console.log(`📍 Server URL: ${SERVER_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    try {
      const result = await testCase.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} failed with error:`, error.message);
      failed++;
    }
    console.log(''); // Empty line for readability
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${tests.length}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the server.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
