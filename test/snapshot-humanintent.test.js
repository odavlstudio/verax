/**
 * Regression test for snapshotBuilder.setHumanIntent
 * 
 * Ensures that the setHumanIntent method exists and works correctly
 * to prevent crashes in guardian reality command.
 */

const { SnapshotBuilder } = require('../src/guardian/snapshot');

console.log('🧪 Snapshot HumanIntent Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Test 1: setHumanIntent method exists
try {
  const builder = new SnapshotBuilder('https://example.com', 'test-run', '2.0.1');
  
  if (typeof builder.setHumanIntent !== 'function') {
    console.error('✗ FAILED: setHumanIntent is not a function');
    process.exit(1);
  }
  
  console.log('✓ Test 1: setHumanIntent method exists');
} catch (err) {
  console.error('✗ FAILED: Error creating SnapshotBuilder:', err.message);
  process.exit(1);
}

// Test 2: setHumanIntent stores data correctly
try {
  const builder = new SnapshotBuilder('https://example.com', 'test-run', '2.0.1');
  
  const humanIntentData = {
    enabled: true,
    blockedCount: 2,
    allowedCount: 3,
    blockedAttempts: ['attempt1', 'attempt2']
  };
  
  builder.setHumanIntent(humanIntentData);
  
  const snapshot = builder.getSnapshot();
  
  if (!snapshot.humanIntent) {
    console.error('✗ FAILED: humanIntent not stored in snapshot');
    process.exit(1);
  }
  
  if (snapshot.humanIntent.enabled !== true) {
    console.error('✗ FAILED: humanIntent.enabled not stored correctly');
    process.exit(1);
  }
  
  if (snapshot.humanIntent.blockedCount !== 2) {
    console.error('✗ FAILED: humanIntent.blockedCount not stored correctly');
    process.exit(1);
  }
  
  if (snapshot.humanIntent.allowedCount !== 3) {
    console.error('✗ FAILED: humanIntent.allowedCount not stored correctly');
    process.exit(1);
  }
  
  if (!Array.isArray(snapshot.humanIntent.blockedAttempts)) {
    console.error('✗ FAILED: humanIntent.blockedAttempts not an array');
    process.exit(1);
  }
  
  if (snapshot.humanIntent.blockedAttempts.length !== 2) {
    console.error('✗ FAILED: humanIntent.blockedAttempts length incorrect');
    process.exit(1);
  }
  
  console.log('✓ Test 2: setHumanIntent stores data correctly');
} catch (err) {
  console.error('✗ FAILED: Error testing setHumanIntent:', err.message);
  process.exit(1);
}

// Test 3: setHumanIntent handles null/undefined gracefully
try {
  const builder = new SnapshotBuilder('https://example.com', 'test-run', '2.0.1');
  
  builder.setHumanIntent(null);
  builder.setHumanIntent(undefined);
  
  console.log('✓ Test 3: setHumanIntent handles null/undefined gracefully');
} catch (err) {
  console.error('✗ FAILED: Error with null/undefined:', err.message);
  process.exit(1);
}

console.log('\n✓ All tests passed');
process.exit(0);
