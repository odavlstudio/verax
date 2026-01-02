# Attempt Surface Inventory

## Core Files

### Primary Execution Files
- `src/guardian/attempt.js` - Main entry point, `executeAttempt()` function
- `src/guardian/attempt-engine.js` - Core execution engine, `AttemptEngine.executeAttempt()` method
- `src/guardian/attempt-reporter.js` - Report generation from attempt results
- `src/guardian/attempt-registry.js` - Attempt definitions/registry

### Consumer Files
- `src/guardian/reality.js` - Uses attempt results in `executeReality()`
- `src/guardian/snapshot.js` - Adds attempt results to snapshots via `addAttempt()`
- `src/guardian/snapshot-schema.js` - Has existing `AttemptResult` typedef (may need alignment)

## Functions That Create Attempt Objects

1. **`AttemptEngine.executeAttempt()`** (attempt-engine.js:39)
   - Returns attempt result object
   - Main execution path

2. **`AttemptEngine._runSiteSmokeAttempt()`** (attempt-engine.js:374+)
   - Specialized attempt for site_smoke
   - Returns attempt result object

3. **`AttemptEngine._runPrimaryCtasAttempt()`** (attempt-engine.js:700+)
   - Specialized attempt for primary_ctas
   - Returns attempt result object

4. **`AttemptEngine._runContactDiscoveryAttempt()`** (attempt-engine.js:850+)
   - Specialized attempt for contact_discovery_v2
   - Returns attempt result object

## Functions That Return/Use Attempt Results

1. **`executeAttempt()`** (attempt.js:22)
   - Calls `engine.executeAttempt()` and returns result
   - Wraps result with additional metadata

2. **`AttemptReporter.createReport()`** (attempt-reporter.js:13)
   - Takes attempt result and creates report
   - Uses: outcome, steps, startedAt, endedAt, totalDurationMs, friction, error, successReason

3. **`SnapshotBuilder.addAttempt()`** (snapshot.js:55)
   - Adds attempt result to snapshot
   - Uses: attemptId, attemptName, goal, outcome, steps, friction, validators, discoverySignals, tracePath

4. **`executeReality()`** (reality.js:240)
   - Executes multiple attempts and collects results
   - Uses: outcome, error, skipReason, steps, friction

## Properties Used in Downstream Code

### Core Properties (Always Present)
- `outcome` - string: 'SUCCESS', 'FAILURE', 'FRICTION', 'NOT_APPLICABLE', 'DISCOVERY_FAILED', 'SKIPPED'
- `steps` - array of step objects
- `startedAt` - string (ISO timestamp)
- `endedAt` - string (ISO timestamp)
- `totalDurationMs` - number (milliseconds)

### Friction Object
- `friction.isFriction` - boolean
- `friction.signals` - array of signal objects
- `friction.summary` - string or null
- `friction.reasons` - array of strings
- `friction.thresholds` - object with totalDurationMs, stepDurationMs, retryCount
- `friction.metrics` - object with totalDurationMs, stepCount, totalRetries, maxStepDurationMs

### Error/Success
- `error` - string or null
- `successReason` - string or null

### Validators & Soft Failures
- `validators` - array of validator result objects
- `softFailures` - object with hasSoftFailure (boolean), failureCount (number), warnCount (number)

### Discovery Signals
- `discoverySignals.consoleErrorCount` - number
- `discoverySignals.pageErrorCount` - number

### Optional/Context-Dependent
- `attemptId` - string (sometimes present, sometimes needs to be added)
- `attemptName` - string (sometimes present)
- `goal` - string (sometimes present)
- `skipReason` - string (for SKIPPED/NOT_APPLICABLE/DISCOVERY_FAILED)
- `tracePath` - string (path to trace.zip, sometimes present)

## Step Object Properties

From code analysis, step objects have:
- `id` - string (step identifier)
- `type` - string (step type: 'navigate', 'click', 'waitFor', etc.)
- `target` - string (selector, URL, etc.)
- `description` - string
- `startedAt` - string (ISO timestamp)
- `endedAt` - string (ISO timestamp) or undefined
- `durationMs` - number or undefined
- `status` - string ('success', 'failed')
- `retries` - number
- `screenshots` - array of strings (paths)
- `domPath` - string (path to DOM snapshot) or undefined
- `error` - string (error message) or undefined

## Artifacts/Paths

From attempt.js and snapshot.js:
- `attempt-report.json` - JSON report path
- `attempt-report.html` - HTML report path
- `attempt-screenshots` - Screenshot directory
- `trace.zip` - Network trace (if enabled)
- `attempt.json` - Attempt snapshot JSON

## Inconsistencies Found

1. **Timestamps**: Sometimes Date objects, sometimes ISO strings - need to standardize to ISO strings
2. **attemptId/attemptName/goal**: Sometimes present in result, sometimes added later - need to ensure consistency
3. **Step properties**: `endedAt` and `durationMs` may be undefined for failed steps - need to document this
4. **tracePath**: Sometimes in result, sometimes in artifacts - need to clarify location

