# Snapshot Core Surface Analysis

## Core Files:
- `src/guardian/snapshot-schema.js`: Defines initial schema typedefs and `createEmptySnapshot()` function
- `src/guardian/snapshot.js`: `SnapshotBuilder` class that assembles snapshot incrementally
- `src/guardian/reality.js`: Main orchestrator that uses `SnapshotBuilder` and adds many fields directly
- `src/guardian/baseline-storage.js`: Creates baselines from snapshots, compares snapshots
- `src/guardian/run-artifacts.js`: May reference snapshot structure

## How Snapshot is Created:

### Initial Creation:
1. `SnapshotBuilder` constructor calls `createEmptySnapshot(baseUrl, runId, toolVersion)` from `snapshot-schema.js`
2. Returns object with: `schemaVersion`, `meta`, `crawl`, `attempts`, `flows`, `signals`, `verdict`, `riskSummary`, `marketImpactSummary`, `discovery`, `evidence`, `intelligence`, `baseline`

### Incremental Assembly (via SnapshotBuilder methods):
- `addCrawlResults(crawlResult)` - Sets `snapshot.crawl`
- `addAttempt(attemptResult, artifactDir)` - Adds to `snapshot.attempts[]` and `snapshot.signals[]`
- `addFlow(flowResult, runDir)` - Adds to `snapshot.flows[]` and `snapshot.signals[]`
- `addMarketResults(marketResults, runDir)` - Calls `addAttempt()` for each attempt, `addFlow()` for each flow
- `setVerdict(verdict)` - Sets `snapshot.verdict`
- `setBaseline(baselineInfo)` - Merges into `snapshot.baseline`
- `setMarketImpactSummary(marketImpactSummary)` - Sets `snapshot.marketImpactSummary`
- `setDiscoveryResults(discoveryResult)` - Sets `snapshot.discovery`
- `addIntelligence(intelligence)` - Sets `snapshot.intelligence`
- `addDiff(diffResult)` - Sets `snapshot.baseline.diff` and adds regression signals
- `setHumanIntent(humanIntentResolution)` - Sets `snapshot.humanIntent`
- `setJourney(journeySummary)` - Sets `snapshot.journey`
- `setArtifactDir(artifactDir)` - Sets `snapshot.evidence.artifactDir`
- `setTracePath(tracePath)` - Sets `snapshot.evidence.traceZip`

### Direct Field Assignment (in reality.js):
After `snapshotBuilder.getSnapshot()`, many fields are added directly:
- `snap.policyEvaluation = policyEval`
- `snap.policyName = policyName`
- `snap.siteIntelligence = { siteType, confidence, timestamp, capabilities, flowApplicability, signalCount }`
- `snap.meta.policyHash = policyHash`
- `snap.meta.preset = config.preset || presetId`
- `snap.meta.evidenceMetrics = evidenceMetrics`
- `snap.meta.coverage = coverageSignal`
- `snap.meta.resolved = resolvedConfig`
- `snap.resolved = resolvedConfig` (duplicate at top level)
- `snap.meta.result = finalDecision.finalVerdict`
- `snap.meta.attemptsSummary = { executed, successful, failed, skipped, disabled, nearSuccess, nearSuccessDetails }`
- `snap.evidenceMetrics = { ...evidenceMetrics, coverage: coverageSignal }` (duplicate at top level)
- `snap.coverage = coverageSignal` (duplicate at top level)
- `snap.meta.attestation = { hash, policyHash, snapshotHash, manifestHash, runId }`
- `snap.honestyContract = buildHonestyContract(...)` (via `buildHonestyContract()`)
- `snap.verdict` is rebuilt with honesty enforcement

## Fields Written Where:

### In `createEmptySnapshot()` (snapshot-schema.js):
- `schemaVersion`: 'v1'
- `meta`: { schemaVersion, createdAt, toolVersion, url, runId, environment }
- `crawl`: { discoveredUrls, visitedCount, failedCount, safetyBlockedCount, httpFailures, notes }
- `attempts`: []
- `flows`: []
- `signals`: []
- `verdict`: null
- `riskSummary`: { totalSoftFailures, totalFriction, failuresByCategory, topRisks }
- `marketImpactSummary`: { highestSeverity, totalRiskCount, countsBySeverity, topRisks }
- `discovery`: { pagesVisited, pagesVisitedCount, interactionsDiscovered, interactionsExecuted, interactionsByType, interactionsByRisk, results, summary }
- `evidence`: { artifactDir, attemptArtifacts, flowArtifacts }
- `intelligence`: { totalFailures, failures, byDomain, bySeverity, escalationSignals, summary }
- `baseline`: { baselineFound, baselineCreatedThisRun, baselineCreatedAt, baselinePath, diff }

### In `SnapshotBuilder.addAttempt()` (snapshot.js):
- Adds to `snapshot.attempts[]`:
  - For NOT_APPLICABLE/DISCOVERY_FAILED: { attemptId, attemptName, goal, outcome, executed: false, skipReason, skipReasonCode, discoverySignals, totalDurationMs, stepCount, failedStepIndex, friction: null }
  - For SKIPPED: { attemptId, attemptName, goal, outcome: 'SKIPPED', executed: false, skipReason, skipReasonCode, totalDurationMs: 0, stepCount: 0, failedStepIndex: -1, friction: null }
  - For executed: { attemptId, attemptName, goal, outcome, executed: true, discoverySignals, totalDurationMs, stepCount, failedStepIndex, friction, evidenceSummary: { screenshots, validators, tracesCaptured } }
- Adds to `snapshot.evidence.attemptArtifacts[attemptId]`: { reportJson, reportHtml, screenshotDir, attemptJson }
- Adds to `snapshot.signals[]`: { id, severity, type, description, affectedAttemptId, details? }

### In `reality.js` (direct assignment):
- `policyEvaluation`: Policy evaluation result object
- `policyName`: string
- `siteIntelligence`: { siteType, confidence, timestamp, capabilities, flowApplicability, signalCount }
- `meta.policyHash`: string
- `meta.preset`: string
- `meta.evidenceMetrics`: object
- `meta.coverage`: object
- `meta.resolved`: object
- `meta.result`: string (verdict)
- `meta.attemptsSummary`: { executed, successful, failed, skipped, disabled, nearSuccess, nearSuccessDetails }
- `meta.attestation`: { hash, policyHash, snapshotHash, manifestHash, runId }
- `resolved`: object (duplicate of meta.resolved)
- `evidenceMetrics`: object (duplicate of meta.evidenceMetrics, with coverage merged)
- `coverage`: object (duplicate of meta.coverage)
- `honestyContract`: object (from `buildHonestyContract()`)
- `verdict`: Rebuilt with honesty enforcement

## How Attempts are Embedded:

1. `SnapshotBuilder.addAttempt(attemptResult, artifactDir)` receives `AttemptResult` from `attempt.contract.js`
2. Transforms it into a snapshot-specific attempt entry:
   - Maps `attemptResult.outcome` → `outcome`
   - Maps `attemptResult.totalDurationMs` → `totalDurationMs`
   - Maps `attemptResult.steps.length` → `stepCount`
   - Maps `attemptResult.steps.findIndex(s => s.status === 'failed')` → `failedStepIndex`
   - Maps `attemptResult.friction` → `friction`
   - Adds `executed: true/false` flag
   - Adds `evidenceSummary` object
   - For skipped/not-applicable: adds `skipReason`, `skipReasonCode`
3. Stores attempt artifacts in `snapshot.evidence.attemptArtifacts[attemptId]`

## Where Meta/Decision/Timing are Added:

### Meta:
- Initial: `createEmptySnapshot()` sets `meta: { schemaVersion, createdAt, toolVersion, url, runId, environment }`
- Extended in `reality.js`: `meta.policyHash`, `meta.preset`, `meta.evidenceMetrics`, `meta.coverage`, `meta.resolved`, `meta.result`, `meta.attemptsSummary`, `meta.attestation`

### Decision/Verdict:
- Initial: `verdict: null` in `createEmptySnapshot()`
- Set via: `SnapshotBuilder.setVerdict(verdict)` or directly in `reality.js`
- Final verdict rebuilt in `reality.js` with honesty enforcement

### Timing:
- `meta.createdAt`: ISO timestamp (set in `createEmptySnapshot()`)
- `attempts[].totalDurationMs`: number (from `AttemptResult`)
- `flows[].durationMs`: number (from flow results)
- No top-level `durationMs` or `startedAt`/`endedAt` in snapshot itself

## Inconsistencies or Duplicate Fields:

1. **AttemptResult typedef mismatch**: `snapshot-schema.js` has its own `AttemptResult` typedef that differs from `attempt.contract.js`. Should use the contract version.

2. **Duplicate fields**:
   - `resolved` exists at both `snapshot.resolved` and `snapshot.meta.resolved`
   - `evidenceMetrics` exists at both `snapshot.evidenceMetrics` and `snapshot.meta.evidenceMetrics`
   - `coverage` exists at both `snapshot.coverage` and `snapshot.meta.coverage`

3. **Missing from schema typedef**: Many fields added in `reality.js` are not in the `MarketRealitySnapshot` typedef:
   - `policyEvaluation`
   - `policyName`
   - `siteIntelligence`
   - `resolved` (top-level)
   - `evidenceMetrics` (top-level)
   - `coverage` (top-level)
   - `honestyContract`
   - `journey`
   - `humanIntent`
   - Extended `meta` fields (policyHash, preset, evidenceMetrics, coverage, resolved, result, attemptsSummary, attestation)

4. **Timing inconsistency**: `meta.createdAt` is ISO string, but `attempts[].totalDurationMs` is number. No top-level timing fields.

5. **Evidence structure**: `evidence.attemptArtifacts` and `evidence.flowArtifacts` are objects keyed by ID, but schema typedef says `attemptArtifacts` is `Object<string, string>` which is incorrect (should be `Object<string, { reportJson, reportHtml, screenshotDir, attemptJson? }>`).

6. **Flow structure**: Schema says `flows: Array` but should be `FlowResult[]` with proper typedef.

7. **Signal structure**: Schema has `Signal` typedef but `addDiff()` adds `details` property that's not in typedef.

8. **Baseline diff structure**: Schema says `diff.regressions` is `{ attemptId => {before, after, reason} }` but `addDiff()` sets it to an array.

