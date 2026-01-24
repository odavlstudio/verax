import { observeExpectations } from '../util/observation/observation-engine.js';

/**
 * Observe Phase
 * 
 * @param {Object} params - { expectations, url, paths, events, authConfig, profile }
 * @returns {Promise<Object>} observeData
 */
export async function observePhase(params) {
  const { expectations, url, paths, events, authConfig, runtimeNavigation, profile } = params;
  
  const observeData = await observeExpectations(
    expectations,
    url,
    paths.evidenceDir,
    (progress) => {
      events.emit(progress.event, progress);
    },
    { authConfig, runtimeNavigation, profile }
  );
  
  return observeData;
}
