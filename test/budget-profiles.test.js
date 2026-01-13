import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getActiveBudgetProfile, getProfileMetadata, createScanBudgetWithProfile, PROFILES } from '../src/verax/shared/budget-profiles.js';

test('Budget Profiles: QUICK profile is faster than STANDARD', () => {
  // Temporarily set env var
  const original = process.env.VERAX_BUDGET_PROFILE;
  
  process.env.VERAX_BUDGET_PROFILE = 'QUICK';
  const quickBudget = createScanBudgetWithProfile();
  
  process.env.VERAX_BUDGET_PROFILE = 'STANDARD';
  const standardBudget = createScanBudgetWithProfile();
  
  // Restore original
  if (original) {
    process.env.VERAX_BUDGET_PROFILE = original;
  } else {
    delete process.env.VERAX_BUDGET_PROFILE;
  }
  
  assert.ok(quickBudget.maxScanDurationMs < standardBudget.maxScanDurationMs, 'QUICK should be faster than STANDARD');
  assert.strictEqual(quickBudget.maxScanDurationMs, 20000, 'QUICK should be 20s');
  assert.strictEqual(standardBudget.maxScanDurationMs, 60000, 'STANDARD should be 60s');
});

test('Budget Profiles: THOROUGH profile explores more interactions', () => {
  const original = process.env.VERAX_BUDGET_PROFILE;
  
  process.env.VERAX_BUDGET_PROFILE = 'STANDARD';
  const standardBudget = createScanBudgetWithProfile();
  
  process.env.VERAX_BUDGET_PROFILE = 'THOROUGH';
  const thoroughBudget = createScanBudgetWithProfile();
  
  // Restore original
  if (original) {
    process.env.VERAX_BUDGET_PROFILE = original;
  } else {
    delete process.env.VERAX_BUDGET_PROFILE;
  }
  
  assert.ok(thoroughBudget.maxInteractionsPerPage > standardBudget.maxInteractionsPerPage, 'THOROUGH should allow more interactions');
  assert.strictEqual(standardBudget.maxInteractionsPerPage, 30, 'STANDARD should be 30');
  assert.strictEqual(thoroughBudget.maxInteractionsPerPage, 50, 'THOROUGH should be 50');
});

test('Budget Profiles: EXHAUSTIVE is most comprehensive', () => {
  const original = process.env.VERAX_BUDGET_PROFILE;
  
  process.env.VERAX_BUDGET_PROFILE = 'EXHAUSTIVE';
  const exhaustiveBudget = createScanBudgetWithProfile();
  
  // Restore original
  if (original) {
    process.env.VERAX_BUDGET_PROFILE = original;
  } else {
    delete process.env.VERAX_BUDGET_PROFILE;
  }
  
  assert.strictEqual(exhaustiveBudget.maxScanDurationMs, 300000, 'EXHAUSTIVE should be 300s');
  assert.strictEqual(exhaustiveBudget.maxInteractionsPerPage, 100, 'EXHAUSTIVE should be 100 interactions');
  assert.strictEqual(exhaustiveBudget.maxFlows, 10, 'EXHAUSTIVE should have 10 flows');
});

test('Budget Profiles: STANDARD is default when env var not set', () => {
  const original = process.env.VERAX_BUDGET_PROFILE;
  delete process.env.VERAX_BUDGET_PROFILE;
  
  const _profile = getActiveBudgetProfile();
  const metadata = getProfileMetadata();
  
  // Restore original
  if (original) {
    process.env.VERAX_BUDGET_PROFILE = original;
  }
  
  assert.strictEqual(metadata.name, 'STANDARD', 'default should be STANDARD');
  assert.strictEqual(metadata.maxScanDurationMs, 60000, 'default should use STANDARD settings');
});

test('Budget Profiles: Invalid profile name defaults to STANDARD', () => {
  const original = process.env.VERAX_BUDGET_PROFILE;
  process.env.VERAX_BUDGET_PROFILE = 'INVALID_PROFILE';
  
  const profile = getActiveBudgetProfile();
  
  // Restore original
  if (original) {
    process.env.VERAX_BUDGET_PROFILE = original;
  } else {
    delete process.env.VERAX_BUDGET_PROFILE;
  }
  
  // Should be same as STANDARD (empty object)
  assert.deepStrictEqual(profile, PROFILES.STANDARD, 'invalid profile should default to STANDARD');
});

test('Budget Profiles: All profiles are available', () => {
  assert.ok(PROFILES.QUICK, 'QUICK profile should exist');
  assert.ok(PROFILES.STANDARD, 'STANDARD profile should exist');
  assert.ok(PROFILES.THOROUGH, 'THOROUGH profile should exist');
  assert.ok(PROFILES.EXHAUSTIVE, 'EXHAUSTIVE profile should exist');
});
