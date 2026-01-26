// Failure Mode Matrix — single source of truth

export function classifyFailureCause(cause, reason) {
  // Normalize
  const c = String(cause || '').toLowerCase();
  const r = String(reason || '').toLowerCase();

  // selector not found → UNPROVEN
  if (c === 'not-found' || r.includes('selector-not-found')) {
    return { classification: 'UNPROVEN', reasonCode: 'selector_mismatch' };
  }
  // timeout after any attempt → INCOMPLETE
  if (c === 'timeout' || r.includes('outcome-timeout')) {
    return { classification: 'INCOMPLETE', reasonCode: 'timing_instability' };
  }
  // network blocked → INCOMPLETE
  if (c === 'blocked' || r.includes('network')) {
    return { classification: 'INCOMPLETE', reasonCode: 'network_unavailable' };
  }
  // default: informational
  return { classification: 'INFORMATIONAL', reasonCode: 'unknown' };
}
