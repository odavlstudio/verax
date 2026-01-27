/**
 * VERAX Vision Compliance Checklist
 * 
 * Derived from docs/VISION.md - the binding product contract.
 * 
 * This checklist defines what VERAX guarantees and what it explicitly does NOT guarantee.
 * Each item maps to a specific section of Vision.md.
 */

export function getVisionChecklist() {
  return [
    // Core Guarantees (Vision.md Section 2)
    {
      id: 'core-1',
      category: 'core',
      claim: 'VERAX is read-only (never modifies source code, application state, or file system)',
      visionSection: '2.1',
      implementation: 'Enforced by read-only filesystem checks and no-write operations',
    },
    {
      id: 'core-2',
      category: 'core',
      claim: 'VERAX is deterministic (same input produces same output)',
      visionSection: '2.2',
      implementation: 'Enforced by deterministic ID generation and stable hashing',
    },
    {
      id: 'core-3',
      category: 'core',
      claim: 'VERAX guards pre-authentication flows only (public, unauthenticated pages)',
      visionSection: '2.3, Section 3',
      implementation: 'Enforced by scope boundary checks and --force-post-auth requirement',
    },
    {
      id: 'core-4',
      category: 'core',
      claim: 'All findings are evidence-backed (screenshots, DOM snapshots, network traces)',
      visionSection: '2.4',
      implementation: 'Enforced by evidence capture service and artifact validation',
    },
    
    // Exit Code Semantics (Vision.md Section 6)
    {
      id: 'exit-1',
      category: 'operational',
      claim: 'SUCCESS (0) means no silent failures observed in covered flows',
      visionSection: '6.1',
      implementation: 'Enforced by exit code logic - SUCCESS never includes findings',
    },
    {
      id: 'exit-2',
      category: 'operational',
      claim: 'FINDINGS (20) means confirmed silent failures detected',
      visionSection: '6.2',
      implementation: 'Enforced by detection confidence thresholds',
    },
    {
      id: 'exit-3',
      category: 'operational',
      claim: 'INCOMPLETE (30) means observation was incomplete or unreliable',
      visionSection: '6.3',
      implementation: 'Enforced by coverage checks and LIMITED mode logic',
    },
    {
      id: 'exit-4',
      category: 'operational',
      claim: 'INVARIANT_VIOLATION (50) means evidence was corrupted or tampered',
      visionSection: '6.4',
      implementation: 'Enforced by artifact integrity validation',
    },
    
    // Zero-Config (Vision.md Section 10)
    {
      id: 'config-1',
      category: 'implementation',
      claim: 'VERAX auto-detects source code when --src is omitted',
      visionSection: '10',
      implementation: 'Enforced by src-auto-discovery.js searching common patterns',
    },
    {
      id: 'config-2',
      category: 'implementation',
      claim: 'LIMITED mode (no source) always results in INCOMPLETE',
      visionSection: '10',
      implementation: 'Enforced by artifact write phase checking isLimitedMode',
    },
    
    // Explicit Out-of-Scope (Vision.md Section 3)
    {
      id: 'scope-1',
      category: 'core',
      claim: 'Authenticated/post-login flows are OUT OF SCOPE',
      visionSection: '3',
      implementation: 'Enforced by --force-post-auth requirement and INCOMPLETE forcing',
    },
    {
      id: 'scope-2',
      category: 'core',
      claim: 'Dynamic entity routes (e.g. /users/:id) are OUT OF SCOPE',
      visionSection: '3',
      implementation: 'Not enforced - runtime check needed',
    },
    {
      id: 'scope-3',
      category: 'core',
      claim: 'Business logic correctness is OUT OF SCOPE',
      visionSection: '3',
      implementation: 'Documentation only - no enforcement',
    },
  ];
}

export function getCategoryWeights() {
  return {
    core: 1.0,           // Core guarantees are mandatory
    implementation: 0.8,  // Implementation details are important but flexible
    operational: 0.9,    // Operational behavior is critical for CI/CD trust
  };
}
