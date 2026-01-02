# Decision Core Surface Analysis

## Core Files:
- `src/guardian/decision-authority.js`: Computes final decision via `computeDecisionAuthority()` and `buildFinalDecision()`
- `src/guardian/reality.js`: Writes `decision.json` via `writeDecisionArtifact()` function
- `src/guardian/fail-safe.js`: Writes error decision via `writeErrorDecision()` function
- `src/guardian/verdicts.js`: Maps verdicts to exit codes via `mapExitCodeFromCanonical()`
- `src/guardian/prelaunch-gate.js`: May write `release-decision.json` (separate artifact)

## How Decision is Computed:

### Decision Authority Flow:
1. `computeDecisionAuthority(signals, options)` in `decision-authority.js`:
   - Accepts signals: `flows`, `attempts`, `rulesEngineOutput`, `journeyVerdict`, `policyEval`, `baseline`, `audit`, `humanPath`, `networkSafety`, `secretFindings`
   - Processes signals in phases (rules engine → flows → attempts → journey → policy → baseline)
   - Builds `verdictHistory` array tracking decision evolution
   - Returns object via `buildFinalDecision()`:
     - `finalVerdict`: Normalized canonical verdict (READY|FRICTION|DO_NOT_LAUNCH)
     - `verdictSource`: Which component determined verdict
     - `verdictHistory`: Array of decision phases
     - `reasons`: Array of `{code, message}` objects (sorted deterministically)
     - `confidence`: Number 0-1
     - `exitCode`: Number (0|1|2, derived from verdict)
     - `finalExitCode`: Duplicate of `exitCode` (backward compatibility)
     - `coverageInfo`: Coverage information
     - `humanPath`: Human navigation path (if available)
     - `networkSafety`: Network safety signals
     - `secretFindings`: Secret findings array

### Verdict Mapping:
- `verdicts.js` provides:
  - `toCanonicalVerdict(internalVerdict)`: Maps internal verdicts (OBSERVED, PARTIAL, INSUFFICIENT_DATA) to canonical (READY, FRICTION, DO_NOT_LAUNCH)
  - `mapExitCodeFromCanonical(canonicalVerdict)`: Maps verdict to exit code:
    - READY → 0
    - FRICTION → 1
    - DO_NOT_LAUNCH → 2
  - `normalizeCanonicalVerdict(verdict)`: Normalizes any verdict string to canonical form

## Where Decision is Serialized:

### Primary: `writeDecisionArtifact()` in `reality.js`
**Path:** `{runDir}/decision.json`

**Structure:**
```javascript
{
  runId: string,
  url: string,
  timestamp: string (ISO),
  preset: string,
  policyName: string,
  finalVerdict: string (READY|FRICTION|DO_NOT_LAUNCH),
  exitCode: number (0|1|2),
  reasons: Array<{code: string, message: string}>,
  actionHints: Array<ActionHint>,
  resolved: Object,
  attestation: Object,
  counts: {
    attemptsExecuted: number,
    successful: number,
    failed: number,
    skipped: number,
    nearSuccess: number
  },
  inputs: {
    policy: PolicyEvaluation,
    baseline: BaselineDiff,
    market: MarketImpactSummary,
    flows: {
      total: number,
      failures: number,
      frictions: number
    }
  },
  outcomes: {
    flows: FlowResult[],
    attempts: AttemptResult[]
  },
  coverage: {
    total: number,
    executed: number,
    gaps: number,
    skipped: Array,
    disabled: Array
  },
  auditSummary: {
    tested: string[],
    notTested: {
      disabledByPreset: string[],
      userFiltered: string[],
      notApplicable: string[],
      missing: string[]
    }
  },
  sections: Object (structured explanation sections),
  explanation: Object (verdict explanation),
  siteIntelligence?: SiteIntelligence,
  observedCapabilities?: Object,
  applicability: {
    relevantTotal: number,
    executed: number,
    notObserved: number,
    skippedNeutral: number,
    coveragePercent: number
  },
  policySignals?: Object,
  triggeredRules: string[],
  honestyContract: {
    testedScope: string[],
    untestedScope: string[],
    limits: string[],
    nonClaims: Object,
    coverageStats: Object,
    confidenceBasis: Object,
    disclaimer: string
  }
}
```

### Error Decision: `writeErrorDecision()` in `fail-safe.js`
**Path:** `{runDir}/decision.json`

**Structure:** Similar to normal decision but with:
- `finalVerdict: 'ERROR'`
- `exitCode: 3`
- `verdictSource: 'error_handler'`
- `verdictHistory: ['ERROR']`
- `meta: { status: 'ERROR', errorMessage: string, errorStack: string|null }`
- `determinismHash: string|null`
- `mode: string`

## Fields in Decision Object:

### Core Fields:
- `runId`: Unique run identifier
- `url`: Base URL tested
- `timestamp`: ISO timestamp when decision was made
- `preset`: Preset ID used
- `policyName`: Policy name
- `finalVerdict`: Canonical verdict (READY|FRICTION|DO_NOT_LAUNCH|ERROR)
- `exitCode`: Exit code (0|1|2|3)
- `reasons`: Array of reason objects `{code, message}`

### Counters:
- `counts`: Attempt execution statistics
  - `attemptsExecuted`, `successful`, `failed`, `skipped`, `nearSuccess`

### Inputs:
- `inputs.policy`: Policy evaluation result
- `inputs.baseline`: Baseline diff result
- `inputs.market`: Market impact summary
- `inputs.flows`: Flow statistics

### Outcomes:
- `outcomes.flows`: Array of flow results
- `outcomes.attempts`: Array of attempt results

### Coverage:
- `coverage`: Coverage statistics
  - `total`, `executed`, `gaps`, `skipped`, `disabled`

### Audit:
- `auditSummary`: What was tested vs not tested
  - `tested`: Array of attempt IDs
  - `notTested`: Object with `disabledByPreset`, `userFiltered`, `notApplicable`, `missing`

### Explanation:
- `sections`: Structured explanation sections (object keyed by section name)
- `explanation`: Verdict explanation object

### Optional Fields:
- `siteIntelligence`: Site intelligence data
- `observedCapabilities`: Observable capabilities
- `applicability`: Applicability statistics
- `policySignals`: Rules engine policy signals
- `triggeredRules`: Array of triggered rule IDs
- `actionHints`: Array of action hints
- `resolved`: Resolved configuration
- `attestation`: Attestation data

### Honesty Contract:
- `honestyContract`: Honesty contract data
  - `testedScope`, `untestedScope`, `limits`, `nonClaims`, `coverageStats`, `confidenceBasis`, `disclaimer`

## Exit Code Mapping:

**Canonical Mapping (from `verdicts.js`):**
- `READY` → `0` (success)
- `FRICTION` → `1` (friction detected)
- `DO_NOT_LAUNCH` → `2` (blocking issues)
- `ERROR` → `3` (internal error, from fail-safe)

**Note:** Exit codes are derived deterministically from verdict via `mapExitCodeFromCanonical()`.

## Relationship with Snapshot:

### Alignment Points:
1. **Verdict:** 
   - `decision.finalVerdict` should equal `snapshot.verdict.verdict` (if verdict exists)
   - `decision.finalVerdict` should equal `snapshot.meta.result` (backward compatibility)

2. **Exit Code:**
   - `decision.exitCode` is derived from `decision.finalVerdict`
   - Snapshot does not store exit code directly

3. **Reasons:**
   - `decision.reasons` contains detailed reason objects
   - `snapshot.verdict.keyFindings` may contain similar information (but as strings)

4. **Counters:**
   - `decision.counts` matches `snapshot.meta.attemptsSummary` (same statistics)

5. **Coverage:**
   - `decision.coverage` should align with `snapshot.meta.coverage` or `snapshot.coverage`

6. **Policy:**
   - `decision.inputs.policy` should match `snapshot.policyEvaluation`

7. **Baseline:**
   - `decision.inputs.baseline` should match `snapshot.baseline.diff`

8. **Honesty Contract:**
   - `decision.honestyContract` should match `snapshot.honestyContract` (if present)

## Duplicate/Alternate Representations:

1. **Exit Code:**
   - `finalDecision.exitCode` and `finalDecision.finalExitCode` (duplicate for backward compatibility)

2. **Verdict in Snapshot:**
   - `snapshot.verdict.verdict` (canonical)
   - `snapshot.meta.result` (backward compatibility)

3. **Coverage:**
   - `decision.coverage` (detailed)
   - `snapshot.meta.coverage` (in meta)
   - `snapshot.coverage` (top-level duplicate)

4. **Resolved Config:**
   - `decision.resolved`
   - `snapshot.meta.resolved`
   - `snapshot.resolved` (top-level duplicate)

5. **Policy:**
   - `decision.inputs.policy`
   - `snapshot.policyEvaluation`
   - `snapshot.policyName` (just the name)

## Inconsistencies or Issues:

1. **Error Decision Structure:** Error decisions have additional fields (`meta`, `determinismHash`, `mode`) not in normal decisions.

2. **Verdict History:** `finalDecision` from `buildFinalDecision()` includes `verdictHistory`, but `writeDecisionArtifact()` does not include it in the decision object.

3. **Verdict Source:** `finalDecision` includes `verdictSource`, but `writeDecisionArtifact()` does not include it in the decision object.

4. **Confidence:** `finalDecision` includes `confidence`, but `writeDecisionArtifact()` does not include it in the decision object.

5. **Coverage Info:** `finalDecision` includes `coverageInfo`, but `writeDecisionArtifact()` uses `coverage` from parameter instead.

6. **Human Path:** `finalDecision` includes `humanPath`, but `writeDecisionArtifact()` does not include it in the decision object.

7. **Network Safety/Secret Findings:** `finalDecision` includes `networkSafety` and `secretFindings`, but `writeDecisionArtifact()` does not include them in the decision object.

**Note:** These fields from `finalDecision` are not written to `decision.json`, but they are available in the `finalDecision` object passed around in code.

