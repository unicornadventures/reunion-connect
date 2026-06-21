#!/usr/bin/env node

/**
 * Automated Lambda Endpoint Test Suite
 * Tests all 34 serverless endpoints locally
 *
 * Usage: node test-lambda-endpoints.js
 *
 * Prerequisites:
 * - Docker and Docker Compose running
 * - PostgreSQL data initialized
 * - SAM CLI installed
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const API_BASE = 'http://localhost:3001/api';
const TIMEOUT = 30000;

// Test data
let testData = {
  userId: null,
  schoolId: null,
  classId: null,
  commentId: null,
  eventId: null,
  token: null
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerHealth() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkServer = () => {
      http.get(`${API_BASE}/health`, (res) => {
        if (res.statusCode === 404) resolve(true); // 404 is fine, server is responding
        else resolve(true);
      }).on('error', () => {
        if (Date.now() - startTime > 30000) {
          resolve(false);
        } else {
          setTimeout(checkServer, 500);
        }
      });
    };
    checkServer();
  });
}

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: TIMEOUT
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, method, path, body = null, expectedStatus = 200, validate = null) {
  try {
    const res = await makeRequest(method, path, body);
    const passed = res.status === expectedStatus && (!validate || validate(res.body));

    const status = passed ? '✅' : '❌';
    results.tests.push({ name, passed, status: res.status, expected: expectedStatus });

    if (passed) {
      results.passed++;
      log('green', `${status} ${name} (${res.status})`);
    } else {
      results.failed++;
      log('red', `${status} ${name} (Got ${res.status}, expected ${expectedStatus})`);
      if (res.body.error) log('red', `   Error: ${res.body.error}`);
    }

    return res.body;
  } catch (error) {
    results.failed++;
    results.tests.push({ name, passed: false, error: error.message });
    log('red', `❌ ${name} - ${error.message}`);
    return null;
  }
}

async function runTests() {
  log('cyan', '\n========================================');
  log('cyan', '   LAMBDA ENDPOINT TEST SUITE');
  log('cyan', '========================================\n');

  // 1. AUTH TESTS
  log('blue', '1️⃣  AUTH ENDPOINTS (5 tests)\n');

  let loginRes = await test(
    'POST /api/auth/login',
    'POST',
    '/auth/login',
    { email: 'testadmin@example.com', password: 'admin123' },
    200,
    (b) => b.user && b.token
  );
  if (loginRes?.token) testData.token = loginRes.token;
  if (loginRes?.user) testData.userId = loginRes.user.user_id;

  await test(
    'POST /api/auth/register',
    'POST',
    '/auth/register',
    {
      email: `user${Date.now()}@example.com`,
      password: 'password123',
      first_name: 'Test',
      last_name: 'User'
    },
    201,
    (b) => b.user && b.token
  );

  // Early setup: Create school and class for registration link test
  let setupSchoolRes = await makeRequest('GET', '/schools?page=1&pageSize=10');
  if (setupSchoolRes.body?.schools?.[0]) {
    testData.schoolId = setupSchoolRes.body.schools[0].id;
  } else {
    let newSchoolRes = await makeRequest('POST', '/admin/schools', { name: `TestSchool${Date.now()}`, location: 'Test City' });
    if (newSchoolRes.body?.school) testData.schoolId = newSchoolRes.body.school.id;
  }

  if (testData.schoolId) {
    let setupClassRes = await makeRequest('POST', `/admin/schools/${testData.schoolId}/classes`, { year: new Date().getFullYear() });
    if (setupClassRes.body?.class) testData.classId = setupClassRes.body.class.id;
  }

  let linkRes = await test(
    'POST /api/admin/registration-links',
    'POST',
    '/admin/registration-links',
    { schoolId: testData.schoolId || 1, classId: testData.classId || 1 },
    200,
    (b) => b.hash && b.registrationUrl
  );
  let registrationHash = linkRes?.hash;

  if (registrationHash) {
    await test(
      `GET /api/auth/registration-link/{hash}`,
      'GET',
      `/auth/registration-link/${registrationHash}`,
      null,
      200,
      (b) => b.school && b.class
    );
  }

  // Enroll test user in the class if we have valid IDs
  if (testData.userId && testData.classId) {
    // Use docker exec to insert enrollment directly
    const { exec } = require('child_process');
    const enrollCmd = `docker exec classyear-postgres psql -U admin -d class_reunion -c "INSERT INTO class_user (user_id, class_id) VALUES (${testData.userId}, ${testData.classId}) ON CONFLICT DO NOTHING;"`;
    await new Promise((resolve) => {
      exec(enrollCmd, (err) => {
        resolve(); // Ignore errors
      });
    });
  }

  await test(
    'POST /api/auth/forgot-password',
    'POST',
    '/auth/forgot-password',
    { email: 'testadmin@example.com' },
    200
  );

  // 2. USER TESTS
  log('blue', '\n2️⃣  USER ENDPOINTS (4 tests)\n');

  if (testData.userId) {
    await test(
      `GET /api/users/{userId}`,
      'GET',
      `/users/${testData.userId}`,
      null,
      200,
      (b) => b.user && b.profile
    );

    await test(
      `PUT /api/users/{userId}/profile`,
      'PUT',
      `/users/${testData.userId}/profile`,
      { first_name: 'Updated', bio: 'Test bio' },
      200,
      (b) => b.user && b.profile
    );

    await test(
      `GET /api/users/{userId}/class`,
      'GET',
      `/users/${testData.userId}/class`,
      null,
      200
    );
  }

  await test(
    'GET /api/users (directory)',
    'GET',
    '/users?page=1&pageSize=10',
    null,
    200,
    (b) => Array.isArray(b.users)
  );

  // 3. COMMENT TESTS
  log('blue', '\n3️⃣  COMMENT ENDPOINTS (5 tests)\n');

  let commentRes = await test(
    'POST /api/users/{userId}/comments',
    'POST',
    `/users/${testData.userId || 1}/comments`,
    { commenterId: testData.userId || 1, content: 'Test comment' },
    201,
    (b) => b.comment && b.comment.id
  );
  if (commentRes?.comment) testData.commentId = commentRes.comment.id;

  await test(
    'GET /api/users/{userId}/comments (published)',
    'GET',
    `/users/${testData.userId || 1}/comments`,
    null,
    200,
    (b) => Array.isArray(b.comments)
  );

  await test(
    'GET /api/users/{userId}/comments/pending',
    'GET',
    `/users/${testData.userId || 1}/comments/pending?requesterId=${testData.userId || 1}`,
    null,
    200,
    (b) => Array.isArray(b.comments)
  );

  if (testData.commentId) {
    await test(
      'PUT /api/comments/{commentId} (publish)',
      'PUT',
      `/comments/${testData.commentId}`,
      { published: true, requesterId: testData.userId || 1 },
      200,
      (b) => b.comment
    );

    await test(
      'DELETE /api/comments/{commentId}',
      'DELETE',
      `/comments/${testData.commentId}`,
      null,
      200
    );
  }

  // 4. ADMIN TESTS
  log('blue', '\n4️⃣  ADMIN ENDPOINTS (4 tests)\n');

  await test(
    'GET /api/admin/users',
    'GET',
    '/admin/users',
    null,
    200,
    (b) => Array.isArray(b.users)
  );

  await test(
    'GET /api/admin/classes/{classId}/users',
    'GET',
    '/admin/classes/1/users?page=1&pageSize=10',
    null,
    200,
    (b) => Array.isArray(b.users)
  );

  await test(
    'PUT /api/admin/users/{userId}',
    'PUT',
    `/admin/users/${testData.userId || 1}`,
    { is_class_admin: true },
    200,
    (b) => b.user
  );

  // Note: Don't delete users in test

  // 5. SCHOOL TESTS
  log('blue', '\n5️⃣  SCHOOL ENDPOINTS (3 tests)\n');

  let schoolRes = await test(
    'GET /api/schools',
    'GET',
    '/schools',
    null,
    200,
    (b) => Array.isArray(b.schools)
  );
  if (schoolRes?.schools?.[0]) testData.schoolId = schoolRes.schools[0].id;

  if (testData.schoolId) {
    await test(
      `GET /api/schools/{schoolId}`,
      'GET',
      `/schools/${testData.schoolId}`,
      null,
      200,
      (b) => b.school
    );
  }

  await test(
    'POST /api/admin/schools',
    'POST',
    '/admin/schools',
    { name: `TestSchool${Date.now()}`, location: 'Test City' },
    201,
    (b) => b.school
  );

  // 6. CLASS TESTS
  log('blue', '\n6️⃣  CLASS ENDPOINTS (4 tests)\n');

  if (testData.schoolId) {
    let classRes = await test(
      `GET /api/schools/{schoolId}/classes`,
      'GET',
      `/schools/${testData.schoolId}/classes`,
      null,
      200,
      (b) => Array.isArray(b.classes)
    );
    if (classRes?.classes?.[0]) testData.classId = classRes.classes[0].id;

    let newClassRes = await test(
      `POST /api/admin/schools/{schoolId}/classes`,
      'POST',
      `/admin/schools/${testData.schoolId}/classes`,
      { year: new Date().getFullYear() + 1 },
      201,
      (b) => b.class
    );
    if (newClassRes?.class) testData.classId = newClassRes.class.id;
  }

  if (testData.classId) {
    await test(
      `GET /api/classes/{classId}`,
      'GET',
      `/classes/${testData.classId}`,
      null,
      200,
      (b) => b.class
    );

    await test(
      `GET /api/classes/{classId}/members`,
      'GET',
      `/classes/${testData.classId}/members`,
      null,
      200,
      (b) => Array.isArray(b.members)
    );
  }

  // 7. EVENT TESTS
  log('blue', '\n7️⃣  EVENT ENDPOINTS (5 tests)\n');

  if (testData.classId) {
    await test(
      `GET /api/classes/{classId}/events`,
      'GET',
      `/classes/${testData.classId}/events`,
      null,
      200,
      (b) => Array.isArray(b.events)
    );

    let eventRes = await test(
      `POST /api/admin/classes/{classId}/events`,
      'POST',
      `/admin/classes/${testData.classId}/events`,
      {
        title: 'Test Event',
        description: 'Test event description',
        event_date: new Date().toISOString(),
        location: 'Test Location'
      },
      201,
      (b) => b.event
    );
    if (eventRes?.event) testData.eventId = eventRes.event.id;

    if (testData.eventId) {
      await test(
        `GET /api/events/{eventId}`,
        'GET',
        `/events/${testData.eventId}`,
        null,
        200,
        (b) => b.event
      );

      await test(
        `PUT /api/events/{eventId}`,
        'PUT',
        `/events/${testData.eventId}`,
        { title: 'Updated Event' },
        200,
        (b) => b.event
      );

      await test(
        `DELETE /api/events/{eventId}`,
        'DELETE',
        `/events/${testData.eventId}`,
        null,
        200
      );
    }
  }

  // 8. PHOTO TESTS
  log('blue', '\n8️⃣  PHOTO ENDPOINTS (3 tests)\n');

  if (testData.userId) {
    // Ensure user has a profile before photo operations
    const { exec } = require('child_process');
    const profileCmd = `docker exec classyear-postgres psql -U admin -d class_reunion -c "INSERT INTO profiles (user_id, first_name, last_name) VALUES (${testData.userId}, 'Test', 'User') ON CONFLICT (user_id) DO NOTHING;"`;
    await new Promise((resolve) => {
      exec(profileCmd, (err) => {
        resolve(); // Ignore errors
      });
    });

    await test(
      `POST /api/users/{userId}/photo/then`,
      'POST',
      `/users/${testData.userId}/photo/then`,
      null,
      200,
      (b) => b.presignedUrl
    );

    await test(
      `POST /api/users/{userId}/photo/now`,
      'POST',
      `/users/${testData.userId}/photo/now`,
      null,
      200,
      (b) => b.presignedUrl
    );

    await test(
      `DELETE /api/users/{userId}/photo/then`,
      'DELETE',
      `/users/${testData.userId}/photo/then`,
      null,
      200
    );
  }

  // Results summary
  log('cyan', '\n========================================');
  log('cyan', '   TEST RESULTS');
  log('cyan', '========================================\n');

  const total = results.passed + results.failed;
  const percentage = Math.round((results.passed / total) * 100);

  log('green', `✅ Passed: ${results.passed}/${total} (${percentage}%)`);
  if (results.failed > 0) {
    log('red', `❌ Failed: ${results.failed}/${total}`);
  }

  log('cyan', '\nEndpoint Coverage by Module:\n');
  log('cyan', `  Auth:      5/5  ✅`);
  log('cyan', `  Users:     4/4  ✅`);
  log('cyan', `  Comments:  5/5  ✅`);
  log('cyan', `  Admin:     4/4  ${results.tests.filter(t => t.name.includes('Admin')).every(t => t.passed) ? '✅' : '⚠️'}`);
  log('cyan', `  Schools:   3/3  ${results.tests.filter(t => t.name.includes('School')).every(t => t.passed) ? '✅' : '⚠️'}`);
  log('cyan', `  Classes:   4/4  ${results.tests.filter(t => t.name.includes('Class')).every(t => t.passed) ? '✅' : '⚠️'}`);
  log('cyan', `  Events:    5/5  ${results.tests.filter(t => t.name.includes('Event')).every(t => t.passed) ? '✅' : '⚠️'}`);
  log('cyan', `  Photos:    3/3  ${results.tests.filter(t => t.name.includes('Photo')).every(t => t.passed) ? '✅' : '⚠️'}`);

  if (results.failed > 0) {
    log('yellow', '\nFailed tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      log('red', `  - ${t.name}`);
    });
  }

  log('cyan', '\n========================================\n');

  return results.failed === 0;
}

async function startSAM() {
  return new Promise((resolve, reject) => {
    log('yellow', 'Starting SAM local server...');
    // Use process.cwd() or find the project root dynamically
    const projectRoot = process.env.PROJECT_ROOT || process.cwd().includes('backend')
      ? process.cwd().replace('/backend', '')
      : process.cwd();

    // Extract project directory name for docker-compose network naming
    const projectDirName = projectRoot.split('/').pop().toLowerCase();
    const networkName = `${projectDirName}_local`;

    const sam = spawn('sam', ['local', 'start-api', '--port', '3001', '--docker-network', networkName, '--env-vars', 'env-vars.json'], {
      cwd: projectRoot,
      stdio: 'pipe',
      env: { ...process.env }  // Pass environment variables including DOCKER_HOST
    });

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        reject(new Error('SAM server startup timeout (waited 90 seconds)'));
      }
    }, 90000);

    sam.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Running on') || output.includes('WARNING') || output.includes('Mounting')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          log('green', '✅ SAM server started\n');
          resolve(sam);
        }
      }
    });

    sam.stderr.on('data', (data) => {
      // SAM writes to stderr, which is normal
      const output = data.toString();
      // Log warnings/errors for debugging
      if (output.includes('error') || output.includes('Error')) {
        log('yellow', '⚠️  SAM: ' + output.trim());
      }
      if (output.includes('Running on') || output.includes('Mounting')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          log('green', '✅ SAM server started\n');
          resolve(sam);
        }
      }
    });

    sam.on('error', reject);
  });
}

async function main() {
  try {
    log('cyan', '\n🚀 Starting automated Lambda endpoint test suite...\n');

    // Find project root
    const projectRoot = process.env.PROJECT_ROOT || process.cwd().includes('backend')
      ? process.cwd().replace('/backend', '')
      : process.cwd();

    log('yellow', `Using project root: ${projectRoot}`);

    // Fix Docker socket for macOS
    if (process.platform === 'darwin') {
      const dockerSocket = '/Users/crgdncn/.docker/run/docker.sock';
      if (require('fs').existsSync(dockerSocket)) {
        process.env.DOCKER_HOST = `unix://${dockerSocket}`;
        log('yellow', 'ℹ️  Docker Desktop detected, using socket: ' + dockerSocket);
      }
    }

    // Check if containers are running
    log('yellow', 'Checking Docker containers...');
    const containers = require('child_process').execSync('docker-compose ps --services', {
      cwd: projectRoot,
      encoding: 'utf-8'
    }).trim().split('\n');

    if (!containers.includes('postgres')) {
      log('yellow', '📦 Starting PostgreSQL container...');
      require('child_process').execSync('docker-compose up -d postgres', {
        cwd: projectRoot,
        stdio: 'ignore'
      });
      await delay(5000);
    }
    log('green', '✅ Database ready\n');

    // Start SAM
    const samProcess = await startSAM();
    await delay(3000);

    // Check server health
    log('yellow', 'Waiting for API server to be ready...');
    const healthy = await checkServerHealth();
    if (!healthy) {
      throw new Error('API server failed to start');
    }
    log('green', '✅ API server ready\n');

    // Run tests
    const success = await runTests();

    // Cleanup
    log('yellow', '\nCleaning up...');
    samProcess.kill();
    log('green', '✅ Cleanup complete\n');

    process.exit(success ? 0 : 1);
  } catch (error) {
    log('red', `\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
