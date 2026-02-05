import test from 'node:test';
import assert from 'node:assert/strict';
import { deprecationWarning, checkDeprecatedFlags, resetDeprecationWarnings } from '../src/cli/util/support/deprecation.js';

test('deprecation warning: emits warning with all fields', () => {
  resetDeprecationWarnings();
  
  // Capture stderr
  const originalWarn = console.warn;
  let captured = '';
  console.warn = (msg) => { captured = msg; };
  
  try {
    deprecationWarning({
      feature: '--test-flag',
      since: '0.4.0',
      removeIn: '0.4.9',
      replacement: '--new-flag',
      reason: 'Better naming',
    });
    
    assert.ok(captured.includes('DEPRECATION WARNING'));
    assert.ok(captured.includes('--test-flag'));
    assert.ok(captured.includes('v0.4.0'));
    assert.ok(captured.includes('v0.4.9'));
    assert.ok(captured.includes('--new-flag'));
    assert.ok(captured.includes('Better naming'));
  } finally {
    console.warn = originalWarn;
  }
});

test('deprecation warning: only shown once per feature', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  let callCount = 0;
  console.warn = () => { callCount++; };
  
  try {
    deprecationWarning({
      feature: '--duplicate-test',
      since: '0.4.0',
      removeIn: '0.4.9',
    });
    
    deprecationWarning({
      feature: '--duplicate-test',
      since: '0.4.0',
      removeIn: '0.4.9',
    });
    
    deprecationWarning({
      feature: '--duplicate-test',
      since: '0.4.0',
      removeIn: '0.4.9',
    });
    
    assert.strictEqual(callCount, 1, 'Warning should only be shown once');
  } finally {
    console.warn = originalWarn;
  }
});

test('deprecation warning: works without optional fields', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  let captured = '';
  console.warn = (msg) => { captured = msg; };
  
  try {
    deprecationWarning({
      feature: '--minimal',
      since: '0.4.0',
      removeIn: '0.4.9',
    });
    
    assert.ok(captured.includes('--minimal'));
    assert.ok(captured.includes('v0.4.0'));
    assert.ok(captured.includes('v0.4.9'));
  } finally {
    console.warn = originalWarn;
  }
});

test('checkDeprecatedFlags: warns when deprecated flag present', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  
  try {
    const args = ['run', '--old-flag', 'value'];
    const deprecatedFlags = {
      '--old-flag': {
        since: '0.4.0',
        removeIn: '0.4.9',
        replacement: '--new-flag',
        hasValue: true,
        removeNow: false,
      },
    };
    
    const result = checkDeprecatedFlags(args, deprecatedFlags);
    
    assert.strictEqual(warned, true, 'Should warn about deprecated flag');
    assert.deepStrictEqual(result, args, 'Should not remove flag when removeNow=false');
  } finally {
    console.warn = originalWarn;
  }
});

test('checkDeprecatedFlags: removes flag when removeNow=true', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  console.warn = () => {};
  
  try {
    const args = ['run', '--removed-flag', 'value', '--url', 'http://test.com'];
    const deprecatedFlags = {
      '--removed-flag': {
        since: '0.3.0',
        removeIn: '0.4.0',
        hasValue: true,
        removeNow: true,
      },
    };
    
    const result = checkDeprecatedFlags(args, deprecatedFlags);
    
    assert.deepStrictEqual(result, ['run', '--url', 'http://test.com']);
  } finally {
    console.warn = originalWarn;
  }
});

test('checkDeprecatedFlags: handles boolean flags without values', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  console.warn = () => {};
  
  try {
    const args = ['run', '--deprecated-bool', '--url', 'http://test.com'];
    const deprecatedFlags = {
      '--deprecated-bool': {
        since: '0.3.0',
        removeIn: '0.4.0',
        hasValue: false,
        removeNow: true,
      },
    };
    
    const result = checkDeprecatedFlags(args, deprecatedFlags);
    
    assert.deepStrictEqual(result, ['run', '--url', 'http://test.com']);
  } finally {
    console.warn = originalWarn;
  }
});

test('checkDeprecatedFlags: handles multiple deprecated flags', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount++; };
  
  try {
    const args = ['run', '--old1', '--old2', 'value', '--url', 'http://test.com'];
    const deprecatedFlags = {
      '--old1': {
        since: '0.4.0',
        removeIn: '0.4.9',
        hasValue: false,
        removeNow: false,
      },
      '--old2': {
        since: '0.4.0',
        removeIn: '0.4.9',
        hasValue: true,
        removeNow: false,
      },
    };
    
    checkDeprecatedFlags(args, deprecatedFlags);
    
    assert.strictEqual(warnCount, 2, 'Should warn for each deprecated flag');
  } finally {
    console.warn = originalWarn;
  }
});

test('checkDeprecatedFlags: no warnings when no deprecated flags used', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  
  try {
    const args = ['run', '--url', 'http://test.com'];
    const deprecatedFlags = {
      '--old-flag': {
        since: '0.4.0',
        removeIn: '0.4.9',
      },
    };
    
    const result = checkDeprecatedFlags(args, deprecatedFlags);
    
    assert.strictEqual(warned, false, 'Should not warn when deprecated flags not used');
    assert.deepStrictEqual(result, args);
  } finally {
    console.warn = originalWarn;
  }
});

test('deprecation policy: warnings are non-fatal', () => {
  resetDeprecationWarnings();
  
  const originalWarn = console.warn;
  console.warn = () => {};
  
  try {
    // Should not throw
    deprecationWarning({
      feature: '--test',
      since: '0.4.0',
      removeIn: '0.4.9',
    });
    
    // Execution continues
    assert.ok(true, 'Deprecation warnings should never throw');
  } finally {
    console.warn = originalWarn;
  }
});
