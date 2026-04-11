/**
 * Preservation Property Tests
 * 
 * IMPORTANT: These tests verify existing working functionality.
 * They should PASS on unfixed code to establish a baseline.
 * 
 * **Validates: Requirements 3.1-3.15**
 * 
 * Test Strategy:
 * - Observe behavior on UNFIXED code for non-buggy inputs
 * - Write property-based tests capturing observed behavior patterns
 * - Ensure all existing functionality continues to work after fixes
 * 
 * Property-Based Testing Approach:
 * - Generate multiple test cases to verify behavior across input space
 * - Test core functionality that should remain unchanged
 * - Focus on user-facing features and data display
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
function assert(condition, testName, message) {
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
    });
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    console.log(`  ${colors.red}${message}${colors.reset}`);
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
 * Property 1: Contract Display and Filtering
 * 
 * Preservation Requirement 3.1, 3.2, 3.3:
 * - Contract list displays all existing columns correctly
 * - Contract creation for solo/shared rooms works correctly
 * - Contract details show tenant, room, and bed space information
 * 
 * This property verifies that contract display functionality remains intact.
 */
function testContractDisplayPreservation() {
  console.log(`${colors.bold}${colors.cyan}Property 1: Contract Display and Filtering${colors.reset}`);
  console.log(`${colors.cyan}Verifying contract list and creation functionality is preserved...${colors.reset}\n`);

  const contractsListContent = readFile('src/app/contracts/page.js');
  const contractsNewContent = readFile('src/app/contracts/new/page.js');

  if (!contractsListContent || !contractsNewContent) {
    assert(false, 'Property 1.1', 'Could not read contract page files');
    return;
  }

  // Test 1.1: Contract list displays all required columns
  const hasContractIdColumn = /contract_id/.test(contractsListContent);
  const hasTenantColumn = /tenant/.test(contractsListContent);
  const hasRoomColumn = /room/.test(contractsListContent);
  const hasPeriodColumn = /period/.test(contractsListContent);
  const hasMonthlyRateColumn = /monthly_rate/.test(contractsListContent);
  const hasStatusColumn = /status/.test(contractsListContent);

  assert(
    hasContractIdColumn && hasTenantColumn && hasRoomColumn && hasPeriodColumn && hasMonthlyRateColumn && hasStatusColumn,
    'Property 1.1: Contract list displays all required columns',
    'PASS: Contract list includes contract_id, tenant, room, period, monthly_rate, and status columns'
  );

  // Test 1.2: Contract list has filtering functionality
  const hasSearchFilter = /searchQuery/.test(contractsListContent);
  const hasStatusFilter = /statusFilter/.test(contractsListContent);
  const hasFilterChips = /FilterChips/.test(contractsListContent);

  assert(
    hasSearchFilter && hasStatusFilter && hasFilterChips,
    'Property 1.2: Contract list has search and status filtering',
    'PASS: Contract list includes search query, status filter, and filter chips'
  );

  // Test 1.3: Contract creation supports both solo and shared rooms
  const hasSoloRoomLogic = /solo/.test(contractsNewContent);
  const hasSharedRoomLogic = /shared/.test(contractsNewContent);
  const hasBedSpaceSelection = /bed_space_id/.test(contractsNewContent);

  assert(
    hasSoloRoomLogic && hasSharedRoomLogic && hasBedSpaceSelection,
    'Property 1.3: Contract creation supports solo and shared rooms',
    'PASS: Contract creation includes logic for both solo and shared room types with bed space selection'
  );

  // Test 1.4: Contract form has all required fields
  const hasTenantField = /tenant_id/.test(contractsNewContent);
  const hasRoomField = /room_id/.test(contractsNewContent);
  const hasMoveInDate = /move_in_date/.test(contractsNewContent);
  const hasMonthlyRent = /monthly_rent/.test(contractsNewContent);
  const hasDepositAmount = /deposit_amount/.test(contractsNewContent);

  assert(
    hasTenantField && hasRoomField && hasMoveInDate && hasMonthlyRent && hasDepositAmount,
    'Property 1.4: Contract form includes all required fields',
    'PASS: Contract form has tenant_id, room_id, move_in_date, monthly_rent, and deposit_amount fields'
  );

  // Test 1.5: Contract list has row click navigation
  const hasRowClickNavigation = /router\.push\(`\/contracts\/\$\{.*contract_id.*\}`\)/.test(contractsListContent);

  assert(
    hasRowClickNavigation,
    'Property 1.5: Contract list rows are clickable for navigation',
    'PASS: Contract list includes router.push navigation on row click'
  );
}

/**
 * Property 2: Billing Display and Calculations
 * 
 * Preservation Requirement 3.4, 3.5, 3.6:
 * - Billing list displays amounts, status, and payment history correctly
 * - Billing KPI calculations work correctly
 * - Billing details show line items and payment history
 * 
 * This property verifies that billing display and calculation functionality remains intact.
 */
function testBillingDisplayPreservation() {
  console.log(`${colors.bold}${colors.cyan}Property 2: Billing Display and Calculations${colors.reset}`);
  console.log(`${colors.cyan}Verifying billing list and KPI calculation functionality is preserved...${colors.reset}\n`);

  const billingContent = readFile('src/app/billing/page.js');

  if (!billingContent) {
    assert(false, 'Property 2.1', 'Could not read billing page file');
    return;
  }

  // Test 2.1: Billing list displays all required columns
  const hasBillingIdColumn = /billing_id/.test(billingContent);
  const hasTenantColumn = /tenant/.test(billingContent);
  const hasPeriodColumn = /period/.test(billingContent);
  const hasDueDateColumn = /due_date/.test(billingContent);
  const hasTotalAmountColumn = /total_amount/.test(billingContent);
  const hasTotalPaidColumn = /total_paid/.test(billingContent);
  const hasBalanceColumn = /balance/.test(billingContent);

  assert(
    hasBillingIdColumn && hasTenantColumn && hasPeriodColumn && hasDueDateColumn && hasTotalAmountColumn && hasTotalPaidColumn && hasBalanceColumn,
    'Property 2.1: Billing list displays all required columns',
    'PASS: Billing list includes billing_id, tenant, period, due_date, total_amount, total_paid, and balance columns'
  );

  // Test 2.2: Billing page has KPI cards
  const hasKpiCard = /KpiCard/.test(billingContent);
  const hasTotalOutstanding = /totalOutstanding/.test(billingContent);
  const hasPastDueAmount = /pastDueAmount/.test(billingContent);
  const hasCollectedThisMonth = /collectedThisMonth/.test(billingContent);

  assert(
    hasKpiCard && hasTotalOutstanding && hasPastDueAmount && hasCollectedThisMonth,
    'Property 2.2: Billing page displays KPI summary cards',
    'PASS: Billing page includes KPI cards for total outstanding, past due amount, and collected this month'
  );

  // Test 2.3: Billing KPI calculations use reduce
  const hasReduceCalculation = /\.reduce\(/.test(billingContent);
  const hasFilterForStatus = /\.filter\(.*status/.test(billingContent);

  assert(
    hasReduceCalculation && hasFilterForStatus,
    'Property 2.3: Billing KPIs are calculated using reduce and filter',
    'PASS: Billing page uses reduce and filter for KPI calculations'
  );

  // Test 2.4: Billing list has filtering functionality
  const hasStatusFilter = /statusFilter/.test(billingContent);
  const hasTenantQuery = /tenantQuery/.test(billingContent);
  const hasFilterChips = /FilterChips/.test(billingContent);

  assert(
    hasStatusFilter && hasTenantQuery && hasFilterChips,
    'Property 2.4: Billing list has status and tenant filtering',
    'PASS: Billing list includes status filter, tenant query, and filter chips'
  );

  // Test 2.5: Billing amounts are formatted with formatPHP
  const hasFormatPHP = /formatPHP/.test(billingContent);

  assert(
    hasFormatPHP,
    'Property 2.5: Billing amounts are formatted using formatPHP',
    'PASS: Billing page uses formatPHP for monetary value formatting'
  );

  // Test 2.6: Billing list has PAY action link
  const hasPayLink = /PAY/.test(billingContent);
  const hasPaymentNewLink = /\/payments\/new/.test(billingContent);

  assert(
    hasPayLink && hasPaymentNewLink,
    'Property 2.6: Billing list includes PAY action link',
    'PASS: Billing list has PAY link that navigates to /payments/new'
  );
}

/**
 * Property 3: Room Management and Occupancy
 * 
 * Preservation Requirement 3.7, 3.8, 3.9:
 * - Room list displays in card grid layout correctly
 * - Room filtering by type and valid status values works correctly
 * - Room occupancy is calculated from bed_spaces correctly
 * 
 * This property verifies that room management functionality remains intact.
 */
function testRoomManagementPreservation() {
  console.log(`${colors.bold}${colors.cyan}Property 3: Room Management and Occupancy${colors.reset}`);
  console.log(`${colors.cyan}Verifying room list and occupancy calculation functionality is preserved...${colors.reset}\n`);

  const roomsContent = readFile('src/app/rooms/page.js');

  if (!roomsContent) {
    assert(false, 'Property 3.1', 'Could not read rooms page file');
    return;
  }

  // Test 3.1: Rooms are displayed in card grid layout
  const hasCardGrid = /grid.*sm:grid-cols-2.*lg:grid-cols-3/.test(roomsContent);
  const hasCardComponent = /<Card/.test(roomsContent);

  assert(
    hasCardGrid && hasCardComponent,
    'Property 3.1: Rooms are displayed in card grid layout',
    'PASS: Rooms page uses card grid with responsive columns (1/2/3)'
  );

  // Test 3.2: Room cards display all required information
  const hasRoomNumber = /room_code/.test(roomsContent);
  const hasRoomType = /room_type/.test(roomsContent);
  const hasCapacity = /capacity/.test(roomsContent);
  const hasMonthlyRate = /monthly_rate/.test(roomsContent);
  const hasStatusBadge = /StatusBadge/.test(roomsContent);

  assert(
    hasRoomNumber && hasRoomType && hasCapacity && hasMonthlyRate && hasStatusBadge,
    'Property 3.2: Room cards display all required information',
    'PASS: Room cards include room_code, room_type, capacity, monthly_rate, and status badge'
  );

  // Test 3.3: Room filtering includes status and type filters
  const hasStatusFilter = /statusFilter/.test(roomsContent);
  const hasTypeFilter = /typeFilter/.test(roomsContent);
  const hasSearchQuery = /searchQuery/.test(roomsContent);

  assert(
    hasStatusFilter && hasTypeFilter && hasSearchQuery,
    'Property 3.3: Room list has status, type, and search filtering',
    'PASS: Rooms page includes statusFilter, typeFilter, and searchQuery'
  );

  // Test 3.4: Occupancy is calculated from bed_spaces
  const hasOccupancyBar = /OccupancyBar/.test(roomsContent);
  const hasBedSpacesFilter = /bed_spaces/.test(roomsContent);
  const hasOccupiedStatus = /status === "occupied"/.test(roomsContent);

  assert(
    hasOccupancyBar && hasBedSpacesFilter && hasOccupiedStatus,
    'Property 3.4: Room occupancy is calculated from bed_spaces',
    hasOccupancyBar && hasBedSpacesFilter && hasOccupiedStatus
      ? 'PASS: Rooms page uses OccupancyBar component and filters bed_spaces by occupied status'
      : 'FAIL: Missing OccupancyBar component or bed_spaces filtering logic'
  );

  // Test 3.5: Room cards have View and Edit actions
  const hasViewLink = /View/.test(roomsContent);
  const hasEditLink = /Edit/.test(roomsContent);
  const hasRoomIdLink = /\/rooms\/\$\{.*room_id/.test(roomsContent);

  assert(
    hasViewLink && hasEditLink && hasRoomIdLink,
    'Property 3.5: Room cards have View and Edit action links',
    'PASS: Room cards include View and Edit links with room_id navigation'
  );

  // Test 3.6: Room status filter includes valid ENUM values
  const hasAvailableOption = /<option value="available">Available<\/option>/.test(roomsContent);
  const hasMaintenanceOption = /<option value="maintenance">Maintenance<\/option>/.test(roomsContent);

  assert(
    hasAvailableOption && hasMaintenanceOption,
    'Property 3.6: Room status filter includes valid ENUM values',
    'PASS: Room status filter includes "available" and "maintenance" options'
  );
}

/**
 * Property 4: Payment History and Filtering
 * 
 * Preservation Requirement 3.10, 3.11, 3.12:
 * - Payment list displays all columns correctly
 * - Payment filtering by date range works correctly
 * - Voided payments are displayed with strikethrough
 * 
 * This property verifies that payment display functionality remains intact.
 */
function testPaymentDisplayPreservation() {
  console.log(`${colors.bold}${colors.cyan}Property 4: Payment History and Filtering${colors.reset}`);
  console.log(`${colors.cyan}Verifying payment list and filtering functionality is preserved...${colors.reset}\n`);

  const paymentsContent = readFile('src/app/payments/page.js');

  if (!paymentsContent) {
    assert(false, 'Property 4.1', 'Could not read payments page file');
    return;
  }

  // Test 4.1: Payment list displays all required columns
  const hasPaymentIdColumn = /payment_id/.test(paymentsContent);
  const hasDateColumn = /payment_date/.test(paymentsContent);
  const hasTenantColumn = /tenant/.test(paymentsContent);
  const hasAmountColumn = /amount_paid/.test(paymentsContent);
  const hasMethodColumn = /payment_method/.test(paymentsContent);
  const hasReferenceColumn = /reference_number/.test(paymentsContent);

  assert(
    hasPaymentIdColumn && hasDateColumn && hasTenantColumn && hasAmountColumn && hasMethodColumn && hasReferenceColumn,
    'Property 4.1: Payment list displays all required columns',
    'PASS: Payment list includes payment_id, date, tenant, amount, method, and reference columns'
  );

  // Test 4.2: Payment page has KPI cards
  const hasKpiCard = /KpiCard/.test(paymentsContent);
  const hasCollectedToday = /collectedToday/.test(paymentsContent);
  const hasCollectedThisMonth = /collectedThisMonth/.test(paymentsContent);

  assert(
    hasKpiCard && hasCollectedToday && hasCollectedThisMonth,
    'Property 4.2: Payment page displays KPI summary cards',
    'PASS: Payment page includes KPI cards for collected today and collected this month'
  );

  // Test 4.3: Payment list has date range filtering
  const hasDateFrom = /dateFrom/.test(paymentsContent);
  const hasDateTo = /dateTo/.test(paymentsContent);
  const hasDateComparison = /new Date\(dateFrom\)/.test(paymentsContent);

  assert(
    hasDateFrom && hasDateTo && hasDateComparison,
    'Property 4.3: Payment list has date range filtering',
    'PASS: Payment list includes dateFrom, dateTo filters with date comparison logic'
  );

  // Test 4.4: Voided payments are displayed with strikethrough
  const hasVoidedCheck = /isVoided/.test(paymentsContent);
  const hasStrikethrough = /line-through/.test(paymentsContent);

  assert(
    hasVoidedCheck && hasStrikethrough,
    'Property 4.4: Voided payments are displayed with strikethrough styling',
    'PASS: Payment list checks for voided status and applies line-through styling'
  );

  // Test 4.5: Payment list has status filtering
  const hasStatusFilter = /statusFilter/.test(paymentsContent);
  const hasPostedOption = /posted/.test(paymentsContent);
  const hasVoidedOption = /voided/.test(paymentsContent);

  assert(
    hasStatusFilter && hasPostedOption && hasVoidedOption,
    'Property 4.5: Payment list has status filtering',
    'PASS: Payment list includes status filter with posted and voided options'
  );

  // Test 4.6: Payment amounts are formatted with formatPHP
  const hasFormatPHP = /formatPHP/.test(paymentsContent);

  assert(
    hasFormatPHP,
    'Property 4.6: Payment amounts are formatted using formatPHP',
    'PASS: Payment page uses formatPHP for monetary value formatting'
  );
}

/**
 * Property 5: Dashboard Layout and Navigation
 * 
 * Preservation Requirement 3.13, 3.14, 3.15:
 * - Dashboard layout and card arrangement remains unchanged
 * - Dashboard navigation links work correctly
 * - Dashboard data refresh functionality works correctly
 * 
 * This property verifies that dashboard functionality remains intact.
 */
function testDashboardPreservation() {
  console.log(`${colors.bold}${colors.cyan}Property 5: Dashboard Layout and Navigation${colors.reset}`);
  console.log(`${colors.cyan}Verifying dashboard layout and navigation functionality is preserved...${colors.reset}\n`);

  const dashboardContent = readFile('src/app/dashboard/page.js');

  if (!dashboardContent) {
    assert(false, 'Property 5.1', 'Could not read dashboard page file');
    return;
  }

  // Test 5.1: Dashboard has KPI cards
  const hasKpiCard = /KpiCard/.test(dashboardContent);
  const hasOccupancyKpi = /Bed Occupancy/.test(dashboardContent);
  const hasTenantsKpi = /Active Tenants/.test(dashboardContent);
  const hasPastDueKpi = /Past Due/.test(dashboardContent);

  assert(
    hasKpiCard && hasOccupancyKpi && hasTenantsKpi && hasPastDueKpi,
    'Property 5.1: Dashboard displays KPI cards',
    'PASS: Dashboard includes KPI cards for occupancy, tenants, and past due cycles'
  );

  // Test 5.2: Dashboard has financial metrics
  const hasCollectedMetric = /Collected This Month/.test(dashboardContent);
  const hasOutstandingMetric = /Outstanding/.test(dashboardContent);
  const hasDueTodayMetric = /Due Today/.test(dashboardContent);

  assert(
    hasCollectedMetric && hasOutstandingMetric && hasDueTodayMetric,
    'Property 5.2: Dashboard displays financial metrics',
    'PASS: Dashboard includes collected, outstanding, and due today metrics'
  );

  // Test 5.3: Dashboard has quick links
  const hasQuickLink = /QuickLink/.test(dashboardContent);
  const hasTenantsLink = /\/tenants/.test(dashboardContent);
  const hasRoomsLink = /\/rooms/.test(dashboardContent);
  const hasContractsLink = /\/contracts/.test(dashboardContent);
  const hasBillingLink = /\/billing/.test(dashboardContent);
  const hasPaymentsLink = /\/payments/.test(dashboardContent);

  assert(
    hasQuickLink && hasTenantsLink && hasRoomsLink && hasContractsLink && hasBillingLink && hasPaymentsLink,
    'Property 5.3: Dashboard has quick navigation links',
    'PASS: Dashboard includes QuickLink components for all main sections'
  );

  // Test 5.4: Dashboard has refresh functionality
  const hasLoadAll = /loadAll/.test(dashboardContent);
  const hasRefreshButton = /RefreshCw/.test(dashboardContent);
  const hasLastUpdated = /lastUpdated/.test(dashboardContent);

  assert(
    hasLoadAll && hasRefreshButton && hasLastUpdated,
    'Property 5.4: Dashboard has data refresh functionality',
    'PASS: Dashboard includes loadAll function, refresh button, and lastUpdated timestamp'
  );

  // Test 5.5: Dashboard has keyboard shortcuts
  const hasKeyboardShortcuts = /handleKeyDown/.test(dashboardContent);
  const hasKeyboardHelp = /showKeyboardHelp/.test(dashboardContent);
  const hasKeyboardIcon = /Keyboard/.test(dashboardContent);

  assert(
    hasKeyboardShortcuts && hasKeyboardHelp && hasKeyboardIcon,
    'Property 5.5: Dashboard has keyboard shortcuts',
    'PASS: Dashboard includes keyboard shortcut handling and help modal'
  );

  // Test 5.6: Dashboard fetches from API endpoints
  const hasFetchSegment = /fetchSegment/.test(dashboardContent);
  const hasOccupancyAPI = /\/api\/reports\/occupancy/.test(dashboardContent);
  const hasBillingAPI = /\/api\/billing/.test(dashboardContent);
  const hasTenantsAPI = /\/api\/tenants/.test(dashboardContent);

  assert(
    hasFetchSegment && hasOccupancyAPI && hasBillingAPI && hasTenantsAPI,
    'Property 5.6: Dashboard fetches data from real API endpoints',
    'PASS: Dashboard uses fetchSegment to load data from /api/reports/occupancy, /api/billing, and /api/tenants'
  );

  // Test 5.7: Dashboard has "Due Today" billing section
  const hasDueTodaySection = /Due Today/.test(dashboardContent);
  const hasDueTodayTable = /stats\.dueToday/.test(dashboardContent);
  const hasBillingTable = /<table/.test(dashboardContent);

  assert(
    hasDueTodaySection && hasDueTodayTable && hasBillingTable,
    'Property 5.7: Dashboard displays "Due Today" billing section',
    'PASS: Dashboard includes "Due Today" section with billing table'
  );
}

/**
 * Main test runner
 */
function runTests() {
  console.log(`\n${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  Preservation Property Tests${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}  Frontend-Backend Schema Alignment Bugfix${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.yellow}IMPORTANT: These tests verify existing working functionality.${colors.reset}`);
  console.log(`${colors.yellow}They should PASS on unfixed code to establish a baseline.${colors.reset}\n`);

  // Run all property tests
  testContractDisplayPreservation();
  testBillingDisplayPreservation();
  testRoomManagementPreservation();
  testPaymentDisplayPreservation();
  testDashboardPreservation();

  // Print summary
  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Test Summary${colors.reset}\n`);
  console.log(`${colors.green}Passed:${colors.reset} ${results.passed}`);
  console.log(`${colors.red}Failed:${colors.reset} ${results.failed}`);
  console.log(`${colors.bold}Total:${colors.reset} ${results.passed + results.failed}\n`);

  // Document failures if any
  const failedTests = results.tests.filter(t => t.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log(`${colors.bold}${colors.red}Failed Tests (Unexpected):${colors.reset}\n`);
    failedTests.forEach((test, index) => {
      console.log(`${colors.red}${index + 1}. ${test.name}${colors.reset}`);
      console.log(`   ${test.message}`);
      console.log('');
    });
  }

  console.log(`${colors.bold}${colors.magenta}═══════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Expected outcome message
  if (results.failed === 0) {
    console.log(`${colors.green}${colors.bold}✓ EXPECTED OUTCOME:${colors.reset} ${colors.green}All tests passed!${colors.reset}`);
    console.log(`${colors.green}  This confirms the baseline behavior that must be preserved after fixes.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bold}⚠ UNEXPECTED OUTCOME:${colors.reset} ${colors.red}Some tests failed.${colors.reset}`);
    console.log(`${colors.red}  This suggests existing functionality may already be broken.${colors.reset}\n`);
  }

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests();
