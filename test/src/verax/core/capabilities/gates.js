/**
 * PHASE 19 — Capability Gates
 * 
 * Enforces quality gates for capabilities based on maturity level.
 * No capability can be marked STABLE (or introduced) unless it satisfies required gates.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PHASE 19: Gate failure reason codes
 */
export const GATE_REASON = {
  MISSING_TEST_MATRIX: 'GATE_MISSING_TEST_MATRIX',
  MISSING_FIXTURE: 'GATE_MISSING_FIXTURE',
  MISSING_DOCS: 'GATE_MISSING_DOCS',
  MISSING_DETERMINISM: 'GATE_MISSING_DETERMINISM',
  MISSING_ARTIFACT_ASSERTIONS: 'GATE_MISSING_ARTIFACT_ASSERTIONS',
  MISSING_GUARDRAILS: 'GATE_MISSING_GUARDRAILS',
  INVALID_MATURITY: 'GATE_INVALID_MATURITY',
  NOT_IN_REGISTRY: 'GATE_NOT_IN_REGISTRY',
};

/**
 * PHASE 19: Capability maturity levels
 */
export const CAPABILITY_MATURITY = {
  EXPERIMENTAL: 'experimental',
  PARTIAL: 'partial',
  STABLE: 'stable',
};

/**
 * PHASE 19: Capability categories that require guardrails
 */
const GUARDRAILS_REQUIRED_CATEGORIES = [
  'network',
  'navigation',
  'routes',
  'ui-feedback',
  'validation',
];

/**
 * PHASE 19: Evaluate capability gates
 * 
 * @param {string} capabilityId - Capability ID
 * @param {Object} context - Context including registry, testMatrix, fixtures, docs, etc.
 * @returns {Object} { pass, failures[], warnings[], evidence }
 */
export function evaluateCapabilityGates(capabilityId, context) {
  const {
    capabilityRegistry,
    testMatrix,
    fixtureIndex,
    docsIndex,
    _artifactsRegistry,
    guardrailsRules,
    determinismTests,
  } = context;
  
  const failures = [];
  const warnings = [];
  const evidence = {
    inRegistry: false,
    inTestMatrix: false,
    hasFixture: false,
    hasDocs: false,
    hasDeterminism: false,
    hasArtifactAssertions: false,
    hasGuardrails: false,
  };
  
  // Check if capability exists in registry
  const capability = capabilityRegistry[capabilityId];
  if (!capability) {
    failures.push({
      reasonCode: GATE_REASON.NOT_IN_REGISTRY,
      message: `Capability "${capabilityId}" not found in registry`,
    });
    return { pass: false, failures, warnings, evidence };
  }
  
  evidence.inRegistry = true;
  
  // Get maturity level
  const maturity = capability.maturity || CAPABILITY_MATURITY.EXPERIMENTAL;
  
  // Gate 1: Test Matrix (required for all maturity levels)
  const testMatrixEntry = testMatrix[capabilityId];
  if (!testMatrixEntry || !Array.isArray(testMatrixEntry) || testMatrixEntry.length === 0) {
    failures.push({
      reasonCode: GATE_REASON.MISSING_TEST_MATRIX,
      message: `Capability "${capabilityId}" has no test matrix entries`,
    });
  } else {
    evidence.inTestMatrix = true;
    
    // Check for artifact assertions in test matrix entries
    const hasArtifactAssertions = testMatrixEntry.some(entry => {
      const assertions = entry.expectedAssertions || [];
      return assertions.some(assertion => {
        const assertionLower = assertion.toLowerCase();
        return assertionLower.includes('artifact') ||
               assertionLower.includes('findings.json') ||
               assertionLower.includes('learn.json') ||
               assertionLower.includes('observe.json') ||
               assertionLower.includes('traces') ||
               assertionLower.includes('evidence') ||
               assertionLower.includes('determinism');
      });
    });
    
    if (!hasArtifactAssertions && maturity === CAPABILITY_MATURITY.STABLE) {
      failures.push({
        reasonCode: GATE_REASON.MISSING_ARTIFACT_ASSERTIONS,
        message: `Capability "${capabilityId}" (STABLE) has no artifact assertions in test matrix`,
      });
    } else if (hasArtifactAssertions) {
      evidence.hasArtifactAssertions = true;
    }
  }
  
  // Gate 2: Fixture (required for PARTIAL and STABLE)
  if (maturity === CAPABILITY_MATURITY.PARTIAL || maturity === CAPABILITY_MATURITY.STABLE) {
    const hasFixture = fixtureIndex.some(fixture => {
      return fixture.capabilities && fixture.capabilities.includes(capabilityId);
    });
    
    if (!hasFixture) {
      failures.push({
        reasonCode: GATE_REASON.MISSING_FIXTURE,
        message: `Capability "${capabilityId}" (${maturity}) has no realistic fixture mapping`,
      });
    } else {
      evidence.hasFixture = true;
    }
  }
  
  // Gate 3: Docs (required for PARTIAL and STABLE)
  if (maturity === CAPABILITY_MATURITY.PARTIAL || maturity === CAPABILITY_MATURITY.STABLE) {
    const hasDocs = docsIndex.some(doc => {
      return doc.capabilities && doc.capabilities.includes(capabilityId);
    });
    
    if (!hasDocs) {
      failures.push({
        reasonCode: GATE_REASON.MISSING_DOCS,
        message: `Capability "${capabilityId}" (${maturity}) has no documentation`,
      });
    } else {
      evidence.hasDocs = true;
    }
  }
  
  // Gate 4: Determinism (required for STABLE)
  if (maturity === CAPABILITY_MATURITY.STABLE) {
    const hasDeterminism = determinismTests.some(test => {
      return test.capabilities && test.capabilities.includes(capabilityId);
    });
    
    if (!hasDeterminism) {
      failures.push({
        reasonCode: GATE_REASON.MISSING_DETERMINISM,
        message: `Capability "${capabilityId}" (STABLE) has no determinism test coverage`,
      });
    } else {
      evidence.hasDeterminism = true;
    }
  }
  
  // Gate 5: Guardrails (required for STABLE in certain categories)
  if (maturity === CAPABILITY_MATURITY.STABLE) {
    const category = capability.category || '';
    const categoryLower = category.toLowerCase();
    const requiresGuardrails = GUARDRAILS_REQUIRED_CATEGORIES.some(reqCat => 
      categoryLower.includes(reqCat)
    );
    
    if (requiresGuardrails) {
      // Check if guardrails test exists and covers this category
      const hasGuardrails = guardrailsRules.some(rule => {
        // Check if rule covers this category or capability
        const ruleCategories = rule.capabilities || [];
        return ruleCategories.some(cat => 
          cat.toLowerCase() === categoryLower || 
          cat === capabilityId ||
          categoryLower.includes(cat.toLowerCase())
        );
      });
      
      if (!hasGuardrails) {
        failures.push({
          reasonCode: GATE_REASON.MISSING_GUARDRAILS,
          message: `Capability "${capabilityId}" (STABLE, category: ${category}) requires guardrails coverage`,
        });
      } else {
        evidence.hasGuardrails = true;
      }
    } else {
      // Not required for this category
      evidence.hasGuardrails = true; // Mark as satisfied
    }
  }
  
  const pass = failures.length === 0;
  
  return { pass, failures, warnings, evidence };
}

/**
 * PHASE 19: Evaluate all capability gates
 * 
 * @param {Object} context - Context including registry, testMatrix, fixtures, docs, etc.
 * @returns {Object} { pass, summary, perCapability }
 */
export function evaluateAllCapabilityGates(context) {
  const { capabilityRegistry } = context;
  
  const perCapability = {};
  let totalPass = 0;
  let totalFail = 0;
  const allFailures = [];
  
  for (const capabilityId of Object.keys(capabilityRegistry)) {
    const result = evaluateCapabilityGates(capabilityId, context);
    perCapability[capabilityId] = result;
    
    if (result.pass) {
      totalPass++;
    } else {
      totalFail++;
      allFailures.push({
        capabilityId,
        failures: result.failures,
        warnings: result.warnings,
      });
    }
  }
  
  const summary = {
    total: Object.keys(capabilityRegistry).length,
    pass: totalPass,
    fail: totalFail,
    allFailures,
  };
  
  const pass = totalFail === 0;
  
  return { pass, summary, perCapability };
}

/**
 * PHASE 19: Build context from file system
 * 
 * @param {Object} options - Options
 * @returns {Promise<Object>} Context object
 */
export async function buildGateContext(options = {}) {
  const projectRoot = options.projectRoot || resolve(__dirname, '../../../');
  
  // Load capability registry
  const registryModule = await import('./registry.js');
  const capabilityRegistry = registryModule.CAPABILITY_REGISTRY || {};
  
  // Load test matrix
  const testMatrixPath = resolve(projectRoot, 'test/test-matrix.js');
  let testMatrix = {};
  if (existsSync(testMatrixPath)) {
    try {
      // Convert to file:// URL for cross-platform compatibility
      const testMatrixUrl = pathToFileURL(testMatrixPath).href;
      const testMatrixModule = await import(testMatrixUrl);
      testMatrix = testMatrixModule.TEST_MATRIX || testMatrixModule.default || {};
    } catch (error) {
      // Test matrix not available - log error for debugging
      console.error('Failed to load test matrix:', error.message);
    }
  }
  
  // Build fixture index
  const fixtureIndex = buildFixtureIndex(projectRoot);
  
  // Build docs index
  const docsIndex = buildDocsIndex(projectRoot);
  
  // Build guardrails rules index
  const guardrailsRules = buildGuardrailsIndex(projectRoot);
  
  // Build determinism tests index
  const determinismTests = buildDeterminismTestsIndex(projectRoot);
  
  // Load artifacts registry
  const { ARTIFACT_REGISTRY } = await import('../artifacts/registry.js');
  
  return {
    capabilityRegistry,
    testMatrix,
    fixtureIndex,
    docsIndex,
    artifactsRegistry: ARTIFACT_REGISTRY,
    guardrailsRules,
    determinismTests,
  };
}

/**
 * Build fixture index by scanning fixtures folder
 */
function buildFixtureIndex(projectRoot) {
  const fixturesDir = resolve(projectRoot, 'test/fixtures/realistic');
  const index = [];
  
  if (!existsSync(fixturesDir)) {
    return index;
  }
  
  try {
    const entries = readdirSync(fixturesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fixturePath = join(fixturesDir, entry.name);
        const readmePath = join(fixturePath, 'README.md');
        
        let capabilities = [];
        if (existsSync(readmePath)) {
          const readmeContent = readFileSync(readmePath, 'utf-8');
        // Extract capability IDs from README (look for patterns like "capability-id" or "capabilityId")
        // Also check for capability mentions in test matrix format
        // @ts-expect-error - readFileSync with encoding returns string
        const capabilityMatches = readmeContent.match(/(['"])([a-z0-9-]+)(['"])/g);
        if (capabilityMatches) {
          capabilities = capabilityMatches.map(m => {
            const match = m.match(/(['"])([a-z0-9-]+)(['"])/);
            return match ? match[2] : null;
          }).filter(Boolean);
        }
        
        // Also look for capability registry format
        // @ts-expect-error - readFileSync with encoding returns string
        const registryMatches = readmeContent.match(/([a-z0-9-]+-[a-z0-9-]+)/g);
        if (registryMatches) {
          capabilities.push(...registryMatches.filter(m => m.includes('-')));
        }
        }
        
        index.push({
          name: entry.name,
          path: fixturePath,
          capabilities,
        });
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return index;
}

/**
 * Build docs index by scanning docs folder
 */
function buildDocsIndex(projectRoot) {
  const docsDir = resolve(projectRoot, 'docs');
  const index = [];
  
  if (!existsSync(docsDir)) {
    return index;
  }
  
  try {
    const entries = readdirSync(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const docPath = join(docsDir, entry.name);
        const docContent = readFileSync(docPath, 'utf-8');
        
        // Extract capability IDs from docs (look for patterns)
        const capabilities = [];
        // @ts-expect-error - readFileSync with encoding returns string
        const capabilityMatches = docContent.match(/([a-z0-9-]+-[a-z0-9-]+)/g);
        if (capabilityMatches) {
          // Filter to likely capability IDs (contain hyphens, reasonable length)
          for (const match of capabilityMatches) {
            if (match.includes('-') && match.length > 5 && match.length < 50) {
              capabilities.push(match);
            }
          }
        }
        
        index.push({
          name: entry.name,
          path: docPath,
          capabilities: [...new Set(capabilities)], // Deduplicate
        });
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return index;
}

/**
 * Build guardrails rules index by scanning test files
 */
function buildGuardrailsIndex(projectRoot) {
  const testDir = resolve(projectRoot, 'test');
  const index = [];
  
  if (!existsSync(testDir)) {
    return index;
  }
  
  try {
    const entries = readdirSync(testDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.includes('guardrail')) {
        const testPath = join(testDir, entry.name);
        const testContent = readFileSync(testPath, 'utf-8');
        
        // Extract capability categories from test content
        const capabilities = [];
        // Look for capability mentions or category mentions
        // @ts-expect-error - readFileSync with encoding returns string
        const categoryMatches = testContent.match(/(network|navigation|routes|ui-feedback|validation)/gi);
        if (categoryMatches) {
          capabilities.push(...categoryMatches.map(m => m.toLowerCase()));
        }
        
        index.push({
          name: entry.name,
          path: testPath,
          capabilities: [...new Set(capabilities)],
        });
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return index;
}

/**
 * Build determinism tests index by scanning test files
 */
function buildDeterminismTestsIndex(projectRoot) {
  const testDir = resolve(projectRoot, 'test');
  const index = [];
  
  if (!existsSync(testDir)) {
    return index;
  }
  
  try {
    const entries = readdirSync(testDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.includes('determinism')) {
        const testPath = join(testDir, entry.name);
        const testContent = readFileSync(testPath, 'utf-8');
        
        // Extract capability IDs from test content by looking at test matrix references
        const capabilities = [];
        // Look for test matrix references or capability mentions
        // @ts-expect-error - readFileSync with encoding returns string
        const testMatrixMatches = testContent.match(/testMatrix\[['"]([a-z0-9-]+)['"]\]/g);
        if (testMatrixMatches) {
          for (const match of testMatrixMatches) {
            const capabilityMatch = match.match(/['"]([a-z0-9-]+)['"]/);
            if (capabilityMatch) {
              capabilities.push(capabilityMatch[1]);
            }
          }
        }
        
        // Also look for capability mentions in test descriptions
        // @ts-expect-error - readFileSync with encoding returns string
        const capabilityMentions = testContent.match(/([a-z0-9-]+-[a-z0-9-]+)/g);
        if (capabilityMentions) {
          capabilities.push(...capabilityMentions.filter(m => m.includes('-')));
        }
        
        index.push({
          name: entry.name,
          path: testPath,
          capabilities: [...new Set(capabilities)],
        });
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return index;
}

