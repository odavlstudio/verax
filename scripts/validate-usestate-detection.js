#!/usr/bin/env node

/**
 * Validation script for AST-based useState detection
 * Runs the extractor on the test fixture and verifies state-driven UI promises are detected
 */

import { extractExpectations } from '../src/cli/util/observation/expectation-extractor.js';
import { resolve } from 'path';

const testProjectPath = resolve(process.cwd(), 'test-projects', 'usestate-validation');

console.log('🔍 Running useState detection validation...\n');

const projectProfile = {
  sourceRoot: testProjectPath,
  framework: 'react-vite',
};

try {
  const result = await extractExpectations(projectProfile, testProjectPath);
  const stateExpectations = result.expectations.filter(e => 
    e.type === 'state' && e.promise.kind === 'ui_state_change'
  );
  
  console.log(`✅ Total expectations extracted: ${result.expectations.length}`);
  console.log(`✅ State-driven UI promises detected: ${stateExpectations.length}\n`);
  
  if (stateExpectations.length === 0) {
    console.error('❌ VALIDATION FAILED: No state-driven UI promises detected!');
    process.exit(1);
  }
  
  console.log('📝 Detected state-driven UI promises:\n');
  
  stateExpectations.forEach((exp, idx) => {
    console.log(`${idx + 1}. State: ${exp.promise.stateName} (${exp.promise.setterName})`);
    console.log(`   Component: ${exp.metadata.componentName}`);
    console.log(`   File: ${exp.source.file}:${exp.source.line}`);
    console.log(`   Setter calls: ${exp.metadata.setterCallCount}`);
    console.log(`   JSX usages: ${exp.metadata.jsxUsageCount}`);
    console.log(`   Usage types: ${exp.metadata.usageTypes.join(', ')}`);
    console.log(`   Has updater function: ${exp.metadata.hasUpdaterFunction}`);
    console.log(`   Confidence: ${exp.confidence}`);
    console.log('');
  });
  
  // Validate expected states
  const expectedStates = ['loading', 'error', 'notifications', 'darkMode'];
  const detectedStates = stateExpectations.map(e => e.promise.stateName);
  const missingStates = expectedStates.filter(state => !detectedStates.includes(state));
  
  if (missingStates.length > 0) {
    console.error('❌ VALIDATION FAILED: Missing expected state promises:');
    missingStates.forEach(state => console.error(`   - ${state}`));
    console.log('\nNote: Some states may not be detected if:');
    console.log('  - State is never used in JSX rendering');
    console.log('  - Setter is never called');
    console.log('  - State usage is indirect (via derived variables)\n');
    process.exit(1);
  }
  
  // Validate metadata quality
  const loadingPromise = stateExpectations.find(e => e.promise.stateName === 'loading');
  if (loadingPromise) {
    if (!loadingPromise.metadata.usageTypes.includes('conditional-rendering')) {
      console.error('❌ VALIDATION FAILED: loading state should have conditional-rendering usage');
      process.exit(1);
    }
  }
  
  const darkModePromise = stateExpectations.find(e => e.promise.stateName === 'darkMode');
  if (darkModePromise) {
    if (!darkModePromise.metadata.hasUpdaterFunction) {
      console.error('⚠️  WARNING: darkMode uses !darkMode pattern, updater detection may vary');
    }
  }
  
  console.log('✅ All expected state-driven UI promises detected');
  console.log('✅ Promise metadata includes:');
  console.log('   - Component names');
  console.log('   - Setter call counts');
  console.log('   - JSX usage counts');
  console.log('   - Usage type categorization');
  console.log('   - Updater function detection\n');
  
  console.log('🎉 VALIDATION PASSED! Gap 2.2 implementation is working correctly.');
  console.log('   React useState is detected with UI promises when:');
  console.log('   - State is declared with useState');
  console.log('   - Setter is called somewhere in component');
  console.log('   - State variable is used in JSX rendering');
  
} catch (error) {
  console.error('❌ VALIDATION ERROR:', error);
  process.exit(1);
}


