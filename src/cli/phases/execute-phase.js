/**
 * Execute Phase Helper
 * 
 * Unified phase execution with timeout handling, error recovery, and event emission.
 * Issue #15: Eliminates duplicated try/catch patterns across phases.
 * 
 * @param {string} phaseName - Display name for the phase
 * @param {Function} phaseFunction - Pure async function to execute
 * @param {Object} context - Execution context { events, budget, paths, json }
 * @param {Function} fallbackFactory - Returns fallback result on timeout/error
 * @returns {Promise<Object>} Phase result or fallback
 */
export async function executePhase(phaseName, phaseFunction, context, fallbackFactory) {
  const { events, budget, paths: _paths, json } = context;
  const timeoutMs = budget?.[`${phaseName.toLowerCase()}MaxMs`] || 300000;
  
  events.emit('phase:started', {
    phase: phaseName,
    message: `${phaseName} phase starting...`,
  });
  
  events.startHeartbeat(phaseName, json);
  
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${phaseName} timeout: ${timeoutMs}ms`)), timeoutMs);
    });
    
    const result = await Promise.race([
      phaseFunction(),
      timeoutPromise
    ]);
    
    events.emit('phase:completed', {
      phase: phaseName,
      message: `${phaseName} phase complete`,
    });
    
    return result;
  } catch (error) {
    if (error.message.includes('timeout')) {
      events.emit(`${phaseName.toLowerCase()}:error`, {
        message: `${phaseName} phase timeout: ${timeoutMs}ms`,
      });
    } else {
      events.emit(`${phaseName.toLowerCase()}:error`, {
        message: error.message,
      });
    }
    
    const fallback = fallbackFactory(error);
    return fallback;
  } finally {
    events.stopHeartbeat();
  }
}
