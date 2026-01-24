#!/usr/bin/env node

/**
 * Validation script for AST-based network detection
 * Runs the extractor on the test fixture and verifies handler calls are detected
 */

import { extractExpectations } from '../src/cli/util/observation/expectation-extractor.js';
import { resolve } from 'path';

const testProjectPath = resolve(process.cwd(), 'test-projects', 'network-validation');

console.log('🔍 Running network detection validation...\n');

const projectProfile = {
  sourceRoot: testProjectPath,
  framework: 'react-vite',
};

try {
  const result = await extractExpectations(projectProfile, testProjectPath);
  const networkExpectations = result.expectations.filter(e => e.type === 'network');
  
  console.log(`✅ Total expectations extracted: ${result.expectations.length}`);
  console.log(`✅ Network expectations detected: ${networkExpectations.length}`);
  console.log(`📊 Skipped - dynamic: ${result.skipped.dynamic}, external: ${result.skipped.external}\n`);
  
  if (networkExpectations.length === 0) {
    console.error('❌ VALIDATION FAILED: No network calls detected!');
    process.exit(1);
  }
  
  console.log('📝 Detected network calls:\n');
  
  networkExpectations.forEach((exp, idx) => {
    console.log(`${idx + 1}. ${exp.metadata.networkKind.toUpperCase()} ${exp.promise.method || 'GET'} ${exp.promise.value}`);
    console.log(`   File: ${exp.source.file}:${exp.source.line}`);
    console.log(`   Context: ${exp.source.context || 'top-level'}`);
    console.log('');
  });
  
  // Validate expected URLs
  const expectedUrls = [
    'https://api.example.com/initial-data',
    'https://api.example.com/more-data',
    'https://api.example.com/refresh',
    'https://api.example.com/poll',
    'https://api.example.com/legacy',
    'https://api.example.com/inline-click',
    'https://api.example.com/delete-item',
  ];
  
  const detectedUrls = networkExpectations.map(e => e.promise.value).sort();
  const missingUrls = expectedUrls.filter(url => !detectedUrls.includes(url));
  
  if (missingUrls.length > 0) {
    console.error('❌ VALIDATION FAILED: Missing expected URLs:');
    missingUrls.forEach(url => console.error(`   - ${url}`));
    process.exit(1);
  }
  
  // Validate handler contexts are detected
  const handlerCalls = networkExpectations.filter(e => 
    e.source.context && (
      e.source.context.includes('handler') || 
      e.source.context.includes('onClick') ||
      e.source.context.includes('useEffect')
    )
  );
  
  console.log(`✅ Network calls in handlers/hooks: ${handlerCalls.length} / ${networkExpectations.length}`);
  
  if (handlerCalls.length < 5) {
    console.error('❌ VALIDATION FAILED: Expected at least 5 handler/hook contexts');
    process.exit(1);
  }
  
  // Validate methods are detected
  const postCall = networkExpectations.find(e => e.promise.method === 'POST');
  const deleteCall = networkExpectations.find(e => e.promise.method === 'DELETE');
  
  if (!postCall) {
    console.error('❌ VALIDATION FAILED: POST method not detected');
    process.exit(1);
  }
  
  if (!deleteCall) {
    console.error('❌ VALIDATION FAILED: DELETE method not detected');
    process.exit(1);
  }
  
  console.log('✅ HTTP methods detected: GET, POST, DELETE\n');
  
  // Validate network kinds
  const fetchCalls = networkExpectations.filter(e => e.metadata.networkKind === 'fetch');
  const axiosCalls = networkExpectations.filter(e => e.metadata.networkKind === 'axios');
  const xhrCalls = networkExpectations.filter(e => e.metadata.networkKind === 'xhr');
  
  console.log(`✅ Network kinds: fetch(${fetchCalls.length}), axios(${axiosCalls.length}), xhr(${xhrCalls.length})`);
  
  if (fetchCalls.length === 0 || axiosCalls.length === 0 || xhrCalls.length === 0) {
    console.error('❌ VALIDATION FAILED: Expected all three network kinds (fetch, axios, xhr)');
    process.exit(1);
  }
  
  console.log('\n🎉 VALIDATION PASSED! Gap 2.1 implementation is working correctly.');
  console.log('   Network calls in handlers, hooks, and nested contexts are detected.');
  
} catch (error) {
  console.error('❌ VALIDATION ERROR:', error);
  process.exit(1);
}


