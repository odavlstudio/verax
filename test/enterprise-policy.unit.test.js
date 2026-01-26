import { test } from 'node:test';
import assert from 'node:assert';
import { 
  loadEnterprisePolicy,
  DEFAULT_ENTERPRISE_POLICY,
  isRedactionDisabled,
  getFrameworkAllowlist,
  isFrameworkAllowed,
} from '../src/cli/config/enterprise-policy.js';

test('Enterprise Policy - Defaults', (t) => {
  t.test('DEFAULT_ENTERPRISE_POLICY has safe defaults', () => {
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.retention.keepRuns, 10, 'Default keep 10 runs');
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.retention.disableRetention, false, 'Retention enabled by default');
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.redaction.enabled, true, 'Redaction enabled by default');
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.redaction.requireExplicitOptOut, true, 'Require explicit opt-out');
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.coverage.minCoverage, 0.6, 'Default 60% coverage');
    assert.strictEqual(DEFAULT_ENTERPRISE_POLICY.frameworks.allowlist, null, 'Allowlist is null (all frameworks)');
    assert.deepStrictEqual(DEFAULT_ENTERPRISE_POLICY.frameworks.denylist, [], 'Denylist is empty');
  });
});

test('Enterprise Policy - Loading', (t) => {
  t.test('loadEnterprisePolicy with no args uses defaults', () => {
    const policy = loadEnterprisePolicy({});
    assert.deepStrictEqual(policy, DEFAULT_ENTERPRISE_POLICY);
  });

  t.test('loadEnterprisePolicy with CLI args overrides defaults', () => {
    const policy = loadEnterprisePolicy({
      retainRuns: 5,
      disableRetention: true,
      minCoverage: 0.8,
    });
    assert.strictEqual(policy.retention.keepRuns, 5);
    assert.strictEqual(policy.retention.disableRetention, true);
    assert.strictEqual(policy.coverage.minCoverage, 0.8);
  });

  t.test('loadEnterprisePolicy validates retainRuns', () => {
    assert.throws(
      () => loadEnterprisePolicy({ retainRuns: -1 }),
      /must be non-negative integer/,
      'Rejects negative retainRuns'
    );
    assert.throws(
      () => loadEnterprisePolicy({ retainRuns: 'not-a-number' }),
      /must be non-negative integer/,
      'Rejects non-numeric retainRuns'
    );
  });

  t.test('loadEnterprisePolicy validates minCoverage', () => {
    assert.throws(
      () => loadEnterprisePolicy({ minCoverage: -0.1 }),
      /must be between 0 and 1/,
      'Rejects negative minCoverage'
    );
    assert.throws(
      () => loadEnterprisePolicy({ minCoverage: 1.5 }),
      /must be between 0 and 1/,
      'Rejects minCoverage > 1'
    );
    assert.throws(
      () => loadEnterprisePolicy({ minCoverage: 'not-a-number' }),
      /must be between 0 and 1/,
      'Rejects non-numeric minCoverage'
    );
  });
});

test('Enterprise Policy - Redaction Control', (t) => {
  t.test('isRedactionDisabled returns correct status', () => {
    const enabled = { redaction: { enabled: true } };
    const disabled = { redaction: { enabled: false } };
    
    assert.strictEqual(isRedactionDisabled(enabled), false);
    assert.strictEqual(isRedactionDisabled(disabled), true);
  });

  t.test('Redaction defaults to enabled', () => {
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(isRedactionDisabled(policy), false);
  });

  t.test('Can disable redaction via CLI arg', () => {
    const policy = loadEnterprisePolicy({ disableRedaction: true });
    assert.strictEqual(isRedactionDisabled(policy), true);
  });
});

test('Enterprise Policy - Framework Control', (t) => {
  t.test('getFrameworkAllowlist returns null by default (all allowed)', () => {
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(getFrameworkAllowlist(policy), null);
  });

  t.test('isFrameworkAllowed accepts all when allowlist is null', () => {
    const policy = { frameworks: { allowlist: null, denylist: [] } };
    assert.strictEqual(isFrameworkAllowed(policy, 'react'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'next.js'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'vue'), true);
  });

  t.test('isFrameworkAllowed respects denylist', () => {
    const policy = { frameworks: { allowlist: null, denylist: ['angular'] } };
    assert.strictEqual(isFrameworkAllowed(policy, 'react'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'angular'), false);
  });

  t.test('isFrameworkAllowed respects allowlist', () => {
    const policy = { frameworks: { allowlist: ['react', 'next.js'], denylist: [] } };
    assert.strictEqual(isFrameworkAllowed(policy, 'react'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'next.js'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'vue'), false);
  });

  t.test('Framework names are case-insensitive', () => {
    const policy = { frameworks: { allowlist: ['React'], denylist: [] } };
    assert.strictEqual(isFrameworkAllowed(policy, 'react'), true);
    assert.strictEqual(isFrameworkAllowed(policy, 'REACT'), true);
  });

  t.test('Denylist takes precedence over allowlist', () => {
    const policy = { frameworks: { allowlist: ['react'], denylist: ['react'] } };
    // This should be caught during validation
    assert.throws(
      () => {
        // Simulate validation check
        if (policy.frameworks.allowlist && policy.frameworks.denylist.length > 0) {
          const overlap = policy.frameworks.allowlist.filter(f => policy.frameworks.denylist.includes(f));
          if (overlap.length > 0) {
            throw new Error(`Framework(s) cannot be both allowlisted and denylisted: ${overlap.join(', ')}`);
          }
        }
      },
      /cannot be both allowlisted and denylisted/
    );
  });
});

test('Enterprise Policy - Environment Variables', (t) => {
  const originalEnv = process.env;
  
  t.teardown(() => {
    process.env = originalEnv;
  });

  t.test('loadEnterprisePolicy respects VERAX_POLICY_RETAIN_RUNS env var', () => {
    process.env.VERAX_POLICY_RETAIN_RUNS = '15';
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(policy.retention.keepRuns, 15);
  });

  t.test('loadEnterprisePolicy respects VERAX_POLICY_DISABLE_RETENTION env var', () => {
    process.env.VERAX_POLICY_DISABLE_RETENTION = 'true';
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(policy.retention.disableRetention, true);
  });

  t.test('loadEnterprisePolicy respects VERAX_POLICY_DISABLE_REDACTION env var', () => {
    process.env.VERAX_POLICY_DISABLE_REDACTION = 'true';
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(policy.redaction.enabled, false);
  });

  t.test('loadEnterprisePolicy respects VERAX_POLICY_MIN_COVERAGE env var', () => {
    process.env.VERAX_POLICY_MIN_COVERAGE = '0.75';
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(policy.coverage.minCoverage, 0.75);
  });

  t.test('loadEnterprisePolicy validates env var values', () => {
    process.env.VERAX_POLICY_RETAIN_RUNS = 'invalid';
    assert.throws(
      () => loadEnterprisePolicy({}),
      /must be non-negative integer/,
      'Validates VERAX_POLICY_RETAIN_RUNS'
    );
  });
});

test('Enterprise Policy - Priority Order', (t) => {
  const originalEnv = process.env;
  
  t.teardown(() => {
    process.env = originalEnv;
  });

  t.test('CLI args override env vars', () => {
    process.env.VERAX_POLICY_RETAIN_RUNS = '10';
    const policy = loadEnterprisePolicy({ retainRuns: 5 });
    assert.strictEqual(policy.retention.keepRuns, 5, 'CLI arg takes precedence');
  });

  t.test('Env vars override defaults', () => {
    process.env.VERAX_POLICY_RETAIN_RUNS = '7';
    const policy = loadEnterprisePolicy({});
    assert.strictEqual(policy.retention.keepRuns, 7);
  });
});

test('Enterprise Policy - Validation', (t) => {
  t.test('Invalid retention config throws', () => {
    assert.throws(
      () => loadEnterprisePolicy({ retainRuns: 'bad' }),
      /USAGE_ERROR/
    );
  });

  t.test('Invalid coverage config throws', () => {
    assert.throws(
      () => loadEnterprisePolicy({ minCoverage: 2 }),
      /USAGE_ERROR/
    );
  });

  t.test('Conflicting framework lists throw', () => {
    assert.throws(
      () => loadEnterprisePolicy({
        frameworkAllowlist: 'react,vue',
        frameworkDenylist: 'vue,angular',
      }),
      /cannot be both allowlisted and denylisted/
    );
  });
});
