/**
 * PHASE 19 — Capability Gates CLI Command
 * 
 * Evaluates all capability gates and reports PASS/FAIL.
 */

import {
  evaluateAllCapabilityGates,
  buildGateContext,
} from '../../verax/core/capabilities/gates.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PHASE 19: `verax gates` command
 * 
 * @param {Object} options - Options
 * @param {boolean} options.json - Output as JSON
 * @param {boolean} options.verbose - Verbose output
 */
export async function gatesCommand(options = { json: false, verbose: false }) {
  const { json = false, verbose = false } = options;
  
  // Pass explicit project root to ensure correct path resolution
  const projectRoot = resolve(__dirname, '../../..');
  const context = await buildGateContext({ projectRoot });
  const result = evaluateAllCapabilityGates(context);
  
  if (json) {
    console.log(JSON.stringify({
      pass: result.pass,
      summary: result.summary,
      perCapability: result.perCapability,
    }, null, 2));
  } else {
    // Human-readable output
    console.log('\n' + '='.repeat(80));
    console.log('CAPABILITY GATES EVALUATION');
    console.log('='.repeat(80));
    console.log(`\nStatus: ${result.pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Total Capabilities: ${result.summary.total}`);
    console.log(`Passing: ${result.summary.pass}`);
    console.log(`Failing: ${result.summary.fail}`);
    
    if (!result.pass) {
      console.log('\n' + '-'.repeat(80));
      console.log('FAILING CAPABILITIES:');
      console.log('-'.repeat(80));
      
      for (const failure of result.summary.allFailures) {
        console.log(`\n❌ ${failure.capabilityId}`);
        for (const gateFailure of failure.failures) {
          console.log(`   └─ ${gateFailure.reasonCode}: ${gateFailure.message}`);
        }
        if (failure.warnings && failure.warnings.length > 0) {
          for (const warning of failure.warnings) {
            console.log(`   ⚠️  ${warning.reasonCode}: ${warning.message}`);
          }
        }
      }
      
      if (verbose) {
        console.log('\n' + '-'.repeat(80));
        console.log('REQUIREMENTS BY MATURITY LEVEL:');
        console.log('-'.repeat(80));
        console.log('\nEXPERIMENTAL:');
        console.log('  - Must exist in registry');
        console.log('  - Must have at least 1 test matrix entry');
        console.log('\nPARTIAL:');
        console.log('  - All EXPERIMENTAL requirements');
        console.log('  - Must have at least 1 realistic fixture mapping');
        console.log('  - Must have documentation');
        console.log('\nSTABLE:');
        console.log('  - All PARTIAL requirements');
        console.log('  - Must have determinism test coverage');
        console.log('  - Must have artifact assertions in test matrix');
        console.log('  - Must have guardrails coverage (if category requires it)');
      }
    } else {
      console.log('\n✅ All capabilities meet their required gates!');
    }
    
    console.log('='.repeat(80) + '\n');
  }
  
  // Exit code: 0 if PASS, 2 if FAIL
  if (!result.pass) {
    process.exit(2);
  }
}

