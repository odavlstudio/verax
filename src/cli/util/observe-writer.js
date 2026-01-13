import { atomicWriteJson } from './atomic-write.js';
import { resolve } from 'path';

/**
 * Write observe.json artifact
 */
export function writeObserveJson(runDir, observeData) {
  const observePath = resolve(runDir, 'observe.json');
  
  const payload = {
    observations: observeData.observations || [],
    stats: {
      attempted: observeData.stats?.attempted || 0,
      observed: observeData.stats?.observed || 0,
      notObserved: observeData.stats?.notObserved || 0,
    },
    redaction: {
      headersRedacted: observeData.redaction?.headersRedacted || 0,
      tokensRedacted: observeData.redaction?.tokensRedacted || 0,
    },
    observedAt: observeData.observedAt || new Date().toISOString(),
  };
  
  atomicWriteJson(observePath, payload);
}
