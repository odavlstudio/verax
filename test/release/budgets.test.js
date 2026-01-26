/**
 * Enterprise Hardening — Budget Configuration Tests
 */

import test from 'node:test';
import assert from 'assert';
import {
  loadBudgets,
  checkExpectationsBudget,
  checkInteractionsBudget,
  checkRuntimeBudget,
  checkEvidenceFilesBudget,
  DEFAULT_BUDGETS,
} from '../../src/verax/core/budgets.js';

test('Budget: loadBudgets returns default values', () => {
  const budgets = loadBudgets();
  assert.strictEqual(budgets.MAX_EXPECTATIONS, DEFAULT_BUDGETS.MAX_EXPECTATIONS);
  assert.strictEqual(budgets.MAX_INTERACTIONS, DEFAULT_BUDGETS.MAX_INTERACTIONS);
  assert.strictEqual(budgets.MAX_EVIDENCE_FILES, DEFAULT_BUDGETS.MAX_EVIDENCE_FILES);
  assert.strictEqual(budgets.MAX_RUNTIME_MS, DEFAULT_BUDGETS.MAX_RUNTIME_MS);
});

test('Budget: checkExpectationsBudget passes when under limit', () => {
  const result = checkExpectationsBudget(100);
  assert.strictEqual(result.exceeded, false);
  assert.strictEqual(result.reason, null);
});

test('Budget: checkExpectationsBudget fails when over limit', () => {
  const result = checkExpectationsBudget(300);
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason.includes('300 > 200'));
});

test('Budget: checkExpectationsBudget passes exactly at limit', () => {
  const result = checkExpectationsBudget(200);
  assert.strictEqual(result.exceeded, false);
  assert.strictEqual(result.reason, null);
});

test('Budget: checkExpectationsBudget fails at limit + 1', () => {
  const result = checkExpectationsBudget(201);
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason);
});

test('Budget: checkInteractionsBudget passes when under limit', () => {
  const result = checkInteractionsBudget(100);
  assert.strictEqual(result.exceeded, false);
});

test('Budget: checkInteractionsBudget fails when over limit', () => {
  const result = checkInteractionsBudget(200);
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason.includes('200 > 150'));
});

test('Budget: checkRuntimeBudget passes when under limit', () => {
  const result = checkRuntimeBudget(60000); // 1 minute
  assert.strictEqual(result.exceeded, false);
});

test('Budget: checkRuntimeBudget fails when over limit', () => {
  const result = checkRuntimeBudget(2000000); // 33+ minutes
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason.includes('Runtime budget exceeded'));
});

test('Budget: checkEvidenceFilesBudget passes when under limit', () => {
  const result = checkEvidenceFilesBudget(5);
  assert.strictEqual(result.exceeded, false);
});

test('Budget: checkEvidenceFilesBudget fails when over limit', () => {
  const result = checkEvidenceFilesBudget(15);
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason.includes('15 > 10'));
});

test('Budget: custom budget configuration via parameter', () => {
  const customBudgets = { MAX_EXPECTATIONS: 50 };
  const result = checkExpectationsBudget(75, customBudgets);
  assert.strictEqual(result.exceeded, true);
  assert.ok(result.reason.includes('75 > 50'));
});

test('Budget: env var VERAX_MAX_EXPECTATIONS overrides default', () => {
  const originalValue = process.env.VERAX_MAX_EXPECTATIONS;
  try {
    process.env.VERAX_MAX_EXPECTATIONS = '50';
    const budgets = loadBudgets();
    assert.strictEqual(budgets.MAX_EXPECTATIONS, 50);
  } finally {
    if (originalValue !== undefined) {
      process.env.VERAX_MAX_EXPECTATIONS = originalValue;
    } else {
      delete process.env.VERAX_MAX_EXPECTATIONS;
    }
  }
});

test('Budget: invalid env var falls back to default', () => {
  const originalValue = process.env.VERAX_MAX_EXPECTATIONS;
  try {
    process.env.VERAX_MAX_EXPECTATIONS = 'not-a-number';
    const budgets = loadBudgets();
    assert.strictEqual(budgets.MAX_EXPECTATIONS, DEFAULT_BUDGETS.MAX_EXPECTATIONS);
  } finally {
    if (originalValue !== undefined) {
      process.env.VERAX_MAX_EXPECTATIONS = originalValue;
    } else {
      delete process.env.VERAX_MAX_EXPECTATIONS;
    }
  }
});

test('Budget: negative env var falls back to default', () => {
  const originalValue = process.env.VERAX_MAX_EXPECTATIONS;
  try {
    process.env.VERAX_MAX_EXPECTATIONS = '-100';
    const budgets = loadBudgets();
    assert.strictEqual(budgets.MAX_EXPECTATIONS, DEFAULT_BUDGETS.MAX_EXPECTATIONS);
  } finally {
    if (originalValue !== undefined) {
      process.env.VERAX_MAX_EXPECTATIONS = originalValue;
    } else {
      delete process.env.VERAX_MAX_EXPECTATIONS;
    }
  }
});
