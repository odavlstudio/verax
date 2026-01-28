/**
 * Quick test of the two failing scenarios
 */
import { computeDOMDiff } from '../src/cli/util/observation/dom-diff.js';

console.log('\n=== FAILURE #1: aria-hidden toggle ===');
const before1 = `<p id="notice" aria-hidden="true">Processing</p>`;
const after1 = `<p id="notice" aria-hidden="false">Processing</p>`;
const diff1 = computeDOMDiff(before1, after1);
console.log('Changed:', diff1.changed);
console.log('Meaningful:', diff1.isMeaningful);
console.log('Expected: isMeaningful = true (aria-hidden is accessibility feedback)');
console.log('Status:', diff1.isMeaningful ? '✓ PASS' : '✗ FAIL - aria-hidden not detected');

console.log('\n=== FAILURE #2: spinner visibility (display toggle) ===');
const before2 = `
  <p id="msg"></p>
  <div id="spinner" style="display: none"></div>
`;
const after2 = `
  <p id="msg"></p>
  <div id="spinner" style="display: block"></div>
`;
const diff2 = computeDOMDiff(before2, after2);
console.log('Changed:', diff2.changed);
console.log('Meaningful:', diff2.isMeaningful);
console.log('Expected: isMeaningful = true (spinner visibility is user feedback)');
console.log('Status:', diff2.isMeaningful ? '✓ PASS' : '✗ FAIL - display toggle not detected');

console.log('\n=== ANALYSIS ===');
console.log('');
console.log('The DOM diff implementation only tracks:');
console.log('1. Text content changes in elements with id/aria-live/role');
console.log('2. Specific attribute changes (disabled, aria-invalid, etc)');
console.log('');
console.log('It MISSES:');
console.log('- aria-hidden changes (accessibility toggles)');
console.log('- display/visibility style changes (visual feedback)');
console.log('- General attribute changes (only whitelisted attrs)');
console.log('');
