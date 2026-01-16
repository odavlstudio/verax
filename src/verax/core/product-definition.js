/**
 * VERAX Product Definition - Locked in Code
 * 
 * Single source of truth for what VERAX is, does, and doesn't do.
 * This definition is wired into CLI help, documentation, and assertions throughout the codebase.
 * 
 * CRITICAL: This is not marketing copy. This is the operational contract.
 */

export const VERAX_PRODUCT_DEFINITION = {
  // What VERAX is: one-liner
  oneLiner: 'A forensic observation engine that detects silent user failures by comparing what your code promises with what users can actually observe.',

  // Does: explicit capabilities
  does: [
    'Observes real websites in real browsers using Playwright',
    'Reads source code to extract explicit expectations (navigation, network calls, state changes)',
    'Compares code-derived expectations with observed browser behavior',
    'Reports gaps between promise and reality with concrete evidence',
    'Assigns confidence levels (HIGH/MEDIUM/LOW) based on evidence strength',
    'Runs locally on developer machines or in CI/CD pipelines',
    'Produces forensic artifacts: findings, traces, screenshots, network logs',
    'Requires and validates source code as the source of truth for expectations',
    'Enforces Evidence Law: findings cannot be CONFIRMED without sufficient evidence'
  ],

  // Does NOT: explicit limitations
  doesNot: [
    'Guess intent - only analyzes explicit code promises',
    'Detect dynamic routes (e.g., /user/${id}) - skipped intentionally',
    'Replace QA or automated tests - complements them',
    'Monitor production traffic',
    'Support every framework - only documented frameworks (React, Next.js, Vue, static HTML)',
    'Detect every bug - only gaps backed by explicit code promises',
    'Operate as a hosted or public-website scanner - runs locally with your repository',
    'Run without source code - requires local access to codebase',
    'Create CONFIRMED findings without evidence - Evidence Law is mandatory'
  ],

  // Success conditions: when does a VERAX run succeed?
  successConditions: [
    'Run executes without crashing',
    'At least one expectation is extracted from source code',
    'At least one interaction is discovered in the browser',
    'Findings are generated from expectations vs observations',
    'All findings satisfy contracts (have evidence, confidence, signals)',
    'All CONFIRMED findings have substantive evidence (per Evidence Law)',
    'Artifacts are written to standard locations (.verax/runs/<runId>/)'
  ],

  // Failure conditions: when does a VERAX run fail?
  failureConditions: [
    'No source code found or readable',
    'No expectations extracted from source code',
    'URL is unreachable or site fails to load',
    'No interactions discovered in the browser',
    'Critical invariants violated (e.g., findings with missing required fields)',
    'A CONFIRMED finding violates Evidence Law (has insufficient evidence)'
  ],

  // The Evidence Law: most critical rule
  evidenceLaw: {
    statement: 'A finding cannot be marked CONFIRMED without sufficient evidence.',
    definition: 'Substantive evidence means at least one of: DOM changes, URL changes, network requests, state mutations, or concrete sensor data.',
    enforcement: 'If a finding is marked CONFIRMED but lacks evidence, it must be downgraded to SUSPECTED or dropped.',
    rationale: 'VERAX exists to surface real gaps backed by observable signals. Unsubstantiated claims are guesses, not forensic findings.'
  },

  // Local source code requirement
  sourceCodeRequirement: {
    statement: 'VERAX requires local access to source code. It is not a public website scanner.',
    rationale: 'Expectations are extracted through static analysis of source files. Without code, VERAX cannot work.',
    implication: 'VERAX is designed for developers in their repositories, not for third-party auditing of closed-source applications.'
  },

  // Version: for tracking breaking changes
  schemaVersion: 1
};

/**
 * Format product definition for CLI display
 */
export function formatProductDefinitionForCLI() {
  const def = VERAX_PRODUCT_DEFINITION;
  const lines = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('VERAX PRODUCT DEFINITION');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`What: ${def.oneLiner}`);
  lines.push('');
  lines.push('Does:');
  def.does.forEach(item => lines.push(`  • ${item}`));
  lines.push('');
  lines.push('Does NOT:');
  def.doesNot.forEach(item => lines.push(`  • ${item}`));
  lines.push('');
  lines.push('EVIDENCE LAW (Mandatory):');
  lines.push(`  "${def.evidenceLaw.statement}"`);
  lines.push(`  Substantive evidence = DOM/URL/network/state changes or sensor data`);
  lines.push(`  Enforcement: CONFIRMED findings must have evidence, else downgraded to SUSPECTED`);
  lines.push('');
  lines.push('SOURCE CODE REQUIREMENT (Mandatory):');
  lines.push(`  "${def.sourceCodeRequirement.statement}"`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

// Consistent banner for all user-facing surfaces
export function getSourceCodeRequirementBanner() {
  return 'VERAX requires local access to source code. It is not a public website scanner.';
}

/**
 * Format just the Evidence Law for inline display
 */
export function formatEvidenceLawForDisplay() {
  const law = VERAX_PRODUCT_DEFINITION.evidenceLaw;
  return `\n** EVIDENCE LAW: ${law.statement} **\n   Substantive evidence = DOM/URL/network/state changes.\n   CONFIRMED findings without evidence are downgraded to SUSPECTED.\n`;
}

export default VERAX_PRODUCT_DEFINITION;
