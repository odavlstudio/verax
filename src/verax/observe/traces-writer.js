import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

export function writeTraces(projectDir, url, traces, coverage = null, warnings = []) {
  const observeDir = resolve(projectDir, '.veraxverax', 'observe');
  mkdirSync(observeDir, { recursive: true });
  
  const observation = {
    version: 1,
    observedAt: new Date().toISOString(),
    url: url,
    traces: traces
  };

  if (coverage) {
    observation.coverage = coverage;
  }
  if (warnings && warnings.length > 0) {
    observation.warnings = warnings;
  }
  
  const tracesPath = resolve(observeDir, 'observation-traces.json');
  writeFileSync(tracesPath, JSON.stringify(observation, null, 2) + '\n');
  
  let externalNavigationBlockedCount = 0;
  let timeoutsCount = 0;
  let settleChangedCount = 0;
  
  for (const trace of traces) {
    if (trace.policy) {
      if (trace.policy.externalNavigationBlocked) {
        externalNavigationBlockedCount++;
      }
      if (trace.policy.timeout) {
        timeoutsCount++;
      }
    }

    if (trace.dom && trace.dom.settle && trace.dom.settle.domChangedDuringSettle) {
      settleChangedCount++;
    }
  }
  
  const observeTruth = {
    interactionsObserved: traces.length,
    externalNavigationBlockedCount: externalNavigationBlockedCount,
    timeoutsCount: timeoutsCount,
    settleChangedCount: settleChangedCount
  };

  if (coverage) {
    observeTruth.coverage = coverage;
    if (coverage.capped) {
      if (!warnings || warnings.length === 0) {
        warnings = [{ code: 'INTERACTIONS_CAPPED', message: 'Interaction discovery reached the cap (30). Scan coverage is incomplete.' }];
      }
    }
  }
  if (warnings && warnings.length > 0) {
    observeTruth.warnings = warnings;
  }
  
  return {
    ...observation,
    tracesPath: tracesPath,
    observeTruth: observeTruth
  };
}

