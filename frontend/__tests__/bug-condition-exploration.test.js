/**
 * Bug Condition Exploration Tests
 * 
 * CRITICAL: These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist and helps document the root causes.
 * 
 * DO NOT attempt to fix the tests or code when they fail.
 * 
 * **Validates: Requirements 1.1-1.15**
 * 
 * Test Strategy:
 * - Test 1: Contract payload includes room_id (should only have bed_space_id)
 * - Test 2: Billing code uses fallback logic (should trust computed attributes)
 * - Test 3: Room status filter includes 'occupied' (should only have valid ENUM values)
 * - Test 4: Payment void button exists (should be present for non-voided payments)
 * - Test 5: Dashboard fetches from real APIs (should not use mock data)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Test assertion helper
 */
function assert(condition, testName, message, counterexample = null) {
  if (condition) {
    results.passed++;
    results.tests.push({
      name: testName,
      status: 'PASS',
      message,
    });
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
    console.log(`  ${colors.green}${message}${colors.reset}`);
  } else {
    results.failed++;
    results.tests.push({
      name: testName,
      status: 'FAIL',
      message,
      counterexample,
    });
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    console.log(`  ${colors.red}${message}${colors.reset}`);
    if (counterexample) {
      console.log(`  ${colors.yellow}Counterexample:${colors.reset}`);
      console.log(`  ${colors.yellow}${counterexample}${colors.reset}`);
    }
  }
  console.log('');
}

/**
 * Read file content helper
 */
function readFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`${colors.red}Error reading file ${filePath}:${colors.reset}`, error.message);
    return null;
  }
}

/**
 * Test 1: Contract Creation - room_id in Payload
 * 
 * Bug Condition: Contract creation sends room_id in payload
 * Expected Behavior: Should only send bed_space_id (not room_id)
 * 
 * This test checks if the contracts/new page sends room_id in the payload,
 * which is incorrect because the contracts table only has bed_space_id.
 */
function testContractPayloadRoomId() {
  console.log(`${colors.bold}${colors.cyan}Test 1: Contract Payload - room_id Field${colors.reset}`);
  console.log(`${colors.cyan}Checking if contract creation sends room_id in payload...${colors.reset}\n`);

  const content = readFile('src/app/contracts/new/page.js');
  if (!content) {
    assert(false, 'Test 1.1', 'Could not read contracts/new/page.js file');
    return;
  }

  // Check if room_id is being sent in the payload
  const hasRoomIdInPayload = /room_id:\s*Number\(values\.room_id\)/.test(content);
  
  // Expected to FAIL on unfixed code (hasRoomIdInPayload should be true)
  assert(
    !hasRoomIdInPayload,
    'Test 1.1: Contract payload should NOT include room_id',
    hasRoomIdInPayload 
      ? 'FAIL (Expected): Contract payload includes room_id field - this is the bug!'
      : 'PASS (Unexpected): Contract payload does not include room_id - bug may be fixed',
    hasRoomIdInPayload 
      ? 'Found: room_id: Number(values.room_id) in payload construction'
      : null
  );

  // Check if bed_space_id is conditional (it should always be required)
  const bedSpaceIdConditional = /if\s*\(values\.bed_space_id\)/.test(content);
  
  assert(
    !bedSpaceIdConditional,
    'Test 1.2: bed_space_id should always be required (not conditional)',
    bedSpaceIdConditional
      ? 'FAIL (Expected): bed_space_id is conditionally added - should always be required'
      : 'PASS (Unexpected): bed_space_id is always required - bug may be fixed',
    bedSpaceIdConditional
      ? 'Found: if (values.bed_space_id) { payload.bed_space_id = ... }'
      : null
  );
}

/**
 * Test 2: Billing Amount Calculation - Fallback Logic
 * 
 * Bug Condition: Billing code uses fallback logic like total_amount || balance
 * Expected Behavior: Should trust computed attributes without fallbacks
 * 
 * This test checks if the billing page uses fallback logic for computed attributes,
 * indicating uncertainty about field availability.
 */
function testBillingFallbackLogic() {
  console.log(`${colors.bold}${colors.cyan}Test 2: Billing Amount Calculation - Fallback Logic${colors.reset}`);
  console.log(`${colors.cyan}Checking if billing page uses fallback logic for computed attributes...${colors.reset}\n`);

  const content = readFile('src/app/billing/page.js');
  if (!content) {
    assert(false, 'Test 2.1', 'Could not read billing/page.js file');
    return;
  }

  // Check for fallback patterns like || 0 or || billing.balance
  const hasFallbackLogic = /billing\.(total_amount|total_paid|balance)\s*\|\|\s*/.test(content);
  
  // Expected to FAIL on unfixed code (hasFallbackLogic should be true)
  assert(
    !hasFallbackLogic,
    'Test 2.1: Billing amounts should be used without fallback logic',
    hasFallbackLogic
      ? 'FAIL (Expected): Billing code uses fallback logic (|| operator) - this is the bug!'
      : 'PASS (Unexpected): Billing code trusts computed attributes - bug may be fixed',
    hasFallbackLogic
      ? 'Found: billing.total_amount || ... or billing.total_paid || ... patterns'
      : null
  );

  // Check for Number() wrapping with || 0 pattern
  const hasNumberFallback = /Number\(billing\.(total_amount|total_paid|balance)\s*\|\|\s*0\)/.test(content);
  
  assert(
    !hasNumberFallback,
    'Test 2.2: Billing amounts should not use Number(...|| 0) pattern',
    hasNumberFallback
      ? 'FAIL (Expected): Found Number(billing.amount || 0) pattern - indicates uncertainty'
      : 'PASS (Unexpected): No Number(...|| 0) pattern found - bug may be fixed',
    hasNumberFallback
      ? 'Found: Number(billing.total_amount || 0) or similar patterns'
      : null
  );
}

/**
 * Test 3: Room Status ENUM - 'occupied' Option
 * 
 * Bug Condition: Room status filter includes 'occupied' option
 * Expected Behavior: Should only show valid ENUM values (available, unavailable, maintenance)
 * 
 * This test checks if the rooms page includes 'occupied' in the status filter,
 * which is not a valid value in the rooms.status ENUM.
 */
function testRoomStatusEnum() {
  console.log(`${colors.bold}${colors.cyan}Test 3: Room Status ENUM - 'occupied' Option${colors.reset}`);
  console.log(`${colors.cyan}Checking if room status filter includes invalid 'occupied' option...${colors.reset}\n`);

  const content = readFile('src/app/rooms/page.js');
  if (!content) {
    assert(false, 'Test 3.1', 'Could not read rooms/page.js file');
    return;
  }

  // Check if 'occupied' appears in the status filter options
  const hasOccupiedOption = /<option\s+value="occupied">Occupied<\/option>/.test(content);
  
  // Expected to FAIL on unfixed code (hasOccupiedOption should be true)
  assert(
    !hasOccupiedOption,
    'Test 3.1: Room status filter should NOT include "occupied" option',
    hasOccupiedOption
      ? 'FAIL (Expected): Status filter includes "occupied" option - this is the bug!'
      : 'PASS (Unexpected): Status filter does not include "occupied" - bug may be fixed',
    hasOccupiedOption
      ? 'Found: <option value="occupied">Occupied</option> in status dropdown'
      : null
  );

  // Check if 'unavailable' option exists (it should)
  const hasUnavailableOption = /<option\s+value="unavailable">Unavailable<\/option>/.test(content);
  
  assert(
    hasUnavailableOption,
    'Test 3.2: Room status filter SHOULD include "unavailable" option',
    hasUnavailableOption
      ? 'PASS (Unexpected): Status filter includes "unavailable" - bug may be fixed'
      : 'FAIL (Expected): Status filter missing "unavailable" option - this is the bug!',
    !hasUnavailableOption
      ? 'Missing: <option value="unavailable">Unavailable</option> in status dropdown'
      : null
  );
}

/**
 * Test 4: Payment Void Functionality - Button Presence
 * 
 * Bug Condition: Payment void button may be missing from UI
 * Expected Behavior: Void action button should be present for non-voided payments
 * 
 * This test checks if the payments page has a void button implementation.
 */
function testPaymentVoidButton() {
  console.log(`${colors.bold}${colors.cyan}Test 4: Payment Void Functionality - Button Presence${colors.reset}`);
  console.log(`${colors.cyan}Checking if payment void button exists in the UI...${colors.reset}\n`);

  const content = readFile('src/app/payments/page.js');
  if (!content) {
    assert(false, 'Test 4.1', 'Could not read payments/page.js file');
    return;
  }

  // Check if VOID button exists
  const hasVoidButton = /VOID/.test(content) && /handleVoidClick/.test(content);
  
  // This test should PASS on unfixed code (void button already exists)
  assert(
    hasVoidButton,
    'Test 4.1: Payment void button should exist in the UI',
    hasVoidButton
      ? 'PASS: Void button found - functionality appears to be implemented'
      : 'FAIL: Void button not found - this would be the bug',
    !hasVoidButton
      ? 'Missing: VOID button or handleVoidClick handler'
      : null
  );

  // Check if VoidConfirmModal exists
  const hasVoidModal = /VoidConfirmModal/.test(content);
  
  assert(
    hasVoidModal,
    'Test 4.2: VoidConfirmModal component should exist',
    hasVoidModal
      ? 'PASS: VoidConfirmModal found - void workflow appears complete'
      : 'FAIL: VoidConfirmModal not found - void workflow incomplete',
    !hasVoidModal
      ? 'Missing: VoidConfirmModal component'
      : null
  );
}

/**
 * Test 5: Dashboard Data Source - Real API Calls
 * 
 * Bug Condition: Dashboard may use mock data instead of real APIs
 * Expected Behavior: Dashboard should fetch from real backend APIs
 * 
 * This test checks if the dashboard fetches data from real API endpoints.
 */
function testDashboardDataSource() {
  console.log(`${colors.bold}${colors.cyan}Test 5: Dashboard Data Source - Real API Calls${colors.reset}`);
  console.log(`${colors.cyan}Checking if dashboard fetches from real backend APIs...${colors.reset}\n`);

  const content = readFile('src/app/dashboard/page.js');
  if (!content) {
    assert(false, 'Test 5.1', 'Could not read dashboard/page.js file');
    return;
  }

  // Check if dashboard fetches from real API endpoints
  const hasOccupancyAPI = /\/api\/reports\/occupancy/.test(content);
  const hasBillingAPI = /\/api\/billing/.test(content);
  const hasTenantsAPI = /\/api\/tenants/.test(content);
  
  assert(
    hasOccupancyAPI,
    'Test 5.1: Dashboard should fetch from /api/reports/occupancy',
    hasOccupancyAPI
      ? 'PASS: Dashboard fetches from /api/reports/occupancy'
      : 'FAIL: Dashboard does not fetch from /api/reports/occupancy - may use mock data',
    !hasOccupancyAPI
      ? 'Missing: /api/reports/occupancy API call'
      : null
  );

  assert(
    hasBillingAPI,
    'Test 5.2: Dashboard should fetch from /api/billing',
    hasBillingAPI
      ? 'PASS: Dashboard fetches from /api/billing'
      : 'FAIL: Dashboard does not fetch from /api/billing - may use mock data',
    !hasBillingAPI
      ? 'Missing: /api/billing API call'
      : null
  );

  assert(
    hasTenantsAPI,
    'Test 5.3: Dashboard should fetch from /api/tenants',
    hasTenantsAPI
      ? 'PASS: Dashboard fetches from /api/tenants'
      : 'FAIL: Dashboard does not fetch from /api/tenants - may use mock data',
    !hasTenantsAPI
      ? 'Missing: /api/tenants API call'
      : null
  );

  // Check for hardcoded values (mock data indicators)
  const hasHardcodedValues = /const\s+(occupiedBeds|totalBeds|activeTenants)\s*=\s*\d+/.test(content);
  
  assert(
    !hasHardcodedValues,
    'Test 5.4: Dashboard should not have hardcoded metric values',
    hasHardcodedValues
      ? 'FAIL: Found hardcoded metric values - may indicate mock data usage'
      : 'PASS: No hardcoded metric values found',
    hasHardcodedValues
      ? 'Found: const occupiedBeds = <number> or similar hardcoded values'
      : null
  );
}

/**
 * Main test runner
 */
function runTests() {
  console.log(`\n${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  Bug Condition Exploration Tests${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  Frontend-Backend Schema Alignment Bugfix${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.yellow}IMPORTANT: These tests are EXPECTED TO FAIL on unfixed code.${colors.reset}`);
  console.log(`${colors.yellow}Failures confirm the bugs exist and help document root causes.${colors.reset}\n`);

  // Run all tests
  testContractPayloadRoomId();
  testBillingFallbackLogic();
  testRoomStatusEnum();
  testPaymentVoidButton();
  testDashboardDataSource();

  // Print summary
  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Test Summary${colors.reset}\n`);
  console.log(`${colors.green}Passed:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
  console.log(`${colors.bold}Total:${colors.reset} ${results.passed + results.failed}\n`);

  // Document counterexamples
  const failedTests = results.tests.filter(t => t.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log(`${colors.bold}${colors.yellow}Documented Counterexamples (Root Causes):${colors.reset}\n`);
    failedTests.forEach((test, index) => {
      console.log(`${colors.yellow}${index + 1}. ${test.name}${colors.reset}`);
      console.log(`   ${test.message}`);
      if (test.counterexample) {
        console.log(`   ${colors.cyan}→${colors.reset} ${test.counterexample}`);
      }
      console.log('');
    });
  }

  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Expected outcome message
  if (results.failed > 0) {
    console.log(`${colors.yellow}${colors.bold}✓ EXPECTED OUTCOME:${colors.reset} ${colors.yellow}Tests failed, confirming bugs exist.${colors.reset}`);
    console.log(`${colors.yellow}  The failures above document the schema mismatches that need to be fixed.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}${colors.bold}⚠ UNEXPECTED OUTCOME:${colors.reset} ${colors.green}All tests passed!${colors.reset}`);
    console.log(`${colors.green}  This suggests the bugs may already be fixed or the root cause analysis is incorrect.${colors.reset}\n`);
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests();
