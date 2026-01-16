/**
 * Exit Codes Contract v1 - Test Scenarios
 * 
 * Demonstrates all exit code classes with CLI examples
 */

console.log('=== EXIT CODES CONTRACT V1 - EXAMPLES ===\n');

// Exit Code 0: OK (no CONFIRMED findings)
console.log('EXIT CODE 0: OK');
console.log('─'.repeat(50));
console.log('Scenario: Analysis completed, no CONFIRMED findings');
console.log('CLI Output:');
console.log('  State: COMPLETE');
console.log('  Coverage: 10/10 expectations analyzed (100.0%)');
console.log('  Findings: 0');
console.log('  Exit Code: 0');
console.log('');

// Exit Code 10: WARNING (only SUSPECTED/INFORMATIONAL)
console.log('EXIT CODE 10: WARNING');
console.log('─'.repeat(50));
console.log('Scenario: Analysis completed, only SUSPECTED findings');
console.log('CLI Output:');
console.log('  State: COMPLETE');
console.log('  Coverage: 8/10 expectations analyzed (80.0%)');
console.log('  Skipped: 2');
console.log('  Findings: 3');
console.log('  ? SUSPECTED (MEDIUM) - Network request may have failed');
console.log('  ? SUSPECTED (LOW) - UI feedback unclear');
console.log('  i INFORMATIONAL (LOW) - Diagnostic data collected');
console.log('  Exit Code: 10');
console.log('');

// Exit Code 20: FAILURE (any CONFIRMED finding)
console.log('EXIT CODE 20: FAILURE');
console.log('─'.repeat(50));
console.log('Scenario: Analysis completed, CONFIRMED finding detected');
console.log('CLI Output:');
console.log('  State: COMPLETE');
console.log('  Coverage: PARTIAL (7/10 expectations analyzed (70.0%))');
console.log('  Skipped: 3');
console.log('  Findings: 2');
console.log('  ✓ CONFIRMED (HIGH) - Form submission failed silently');
console.log('  ? SUSPECTED (MEDIUM) - Navigation may be broken');
console.log('  Exit Code: 20');
console.log('');

// Exit Code 2: TOOL FAILURE (crash, invariant, runtime error)
console.log('EXIT CODE 2: TOOL FAILURE');
console.log('─'.repeat(50));
console.log('Scenario: Analysis failed due to internal error');
console.log('CLI Output:');
console.log('  State: FAILED');
console.log('  Coverage: PARTIAL (3/10 expectations analyzed (30.0%))');
console.log('  Error: Contract violation detected');
console.log('  ⚠️  RESULTS ARE INCOMPLETE');
console.log('  Exit Code: 2');
console.log('');

// Exit Code 64: USAGE ERROR (invalid CLI usage)
console.log('EXIT CODE 64: USAGE ERROR');
console.log('─'.repeat(50));
console.log('Scenario: Invalid command-line arguments');
console.log('CLI Output:');
console.log('  Error: Invalid option: --unknown-flag');
console.log('  Usage: verax [options]');
console.log('  Exit Code: 64');
console.log('');

console.log('=== PRECEDENCE DEMONSTRATION ===\n');
console.log('Precedence order (highest wins):');
console.log('1. USAGE ERROR (64)     - Invalid CLI usage');
console.log('2. TOOL FAILURE (2)     - Crash/invariant violation');
console.log('3. FAILURE (20)         - Any CONFIRMED finding');
console.log('4. WARNING (10)         - Only SUSPECTED/INFORMATIONAL');
console.log('5. OK (0)               - No CONFIRMED findings');
console.log('');

console.log('Examples:');
console.log('• CONFIRMED + crash      → 2  (tool failure wins)');
console.log('• CONFIRMED + SUSPECTED  → 20 (CONFIRMED present)');
console.log('• SUSPECTED only         → 10 (no CONFIRMED)');
console.log('• No findings            → 0  (clean)');
console.log('• Invalid args + clean   → 64 (usage error wins)');
console.log('');

console.log('=== KEY RULES ===\n');
console.log('1. CONFIRMED findings → 20 (regardless of confidence level)');
console.log('2. SUSPECTED/INFORMATIONAL only → 10 (never 20)');
console.log('3. Partial coverage noted but does NOT change exit code');
console.log('4. Exit code 1 is NEVER used');
console.log('5. Incomplete analysis → 2 (tool failure)');
