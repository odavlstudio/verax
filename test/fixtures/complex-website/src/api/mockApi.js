/**
 * Mock API - simulates network requests with intentional bugs
 */

const FIXED_LAST_UPDATE = '2024-01-01T00:00:00.000Z';

/**
 * Simulate a form submission - returns success but provides no feedback
 * INTENTIONAL SILENT FAILURE: Request succeeds but UI doesn't respond
 */
export async function submitSettings(settings) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('[Mock API] Settings saved:', settings);
      // Always returns success, but caller never acts on it
      resolve({ success: true, message: 'Settings saved successfully' });
    }, 1000);
  });
}

/**
 * INTENTIONAL SILENT FAILURE: Async race condition
 * Two requests fire - the slower one overrides the faster one
 * This simulates real-world race conditions
 */
export async function fetchUserDataSlow() {
  return new Promise((resolve) => {
    // This request takes 3 seconds (slower)
    setTimeout(() => {
      resolve({
        id: 'slow-request-id',
        name: 'Outdated User Data',
        email: 'old@example.com',
        status: 'inactive',
        lastUpdate: FIXED_LAST_UPDATE,
        source: 'SLOW_REQUEST',
      });
    }, 3000);
  });
}

/**
 * Fast request that should be displayed
 */
export async function fetchUserDataFast() {
  return new Promise((resolve) => {
    // This request takes 500ms (faster)
    setTimeout(() => {
      resolve({
        id: 'fast-request-id',
        name: 'Current User Data',
        email: 'current@example.com',
        status: 'active',
        lastUpdate: FIXED_LAST_UPDATE,
        source: 'FAST_REQUEST',
      });
    }, 500);
  });
}

/**
 * Generic API call for dashboard data
 * INTENTIONAL SILENT FAILURE: No error handling, just resolves
 */
export async function fetchDashboardData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalUsers: 1234,
        activeUsers: 456,
        revenue: 123456,
        conversionRate: 3.24,
      });
    }, 800);
  });
}

/**
 * Feature toggle check - always returns false
 * INTENTIONAL SILENT FAILURE: Feature is disabled but UI still shows it
 */
export async function checkFeatureFlag(featureName) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ enabled: false, featureName });
    }, 100);
  });
}






