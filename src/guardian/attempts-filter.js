/**
 * Guardian Attempts Filter
 * Validates and filters attempts/flows based on user input
 */

const { getAttemptDefinition } = require('./attempt-registry');
const { getFlowDefinition } = require('./flow-registry');

function validateAttemptFilter(filterString) {
  if (!filterString || !filterString.trim()) {
    return { valid: true, ids: [] };
  }

  const ids = filterString.split(',').map(s => s.trim()).filter(Boolean);
  
  if (ids.length === 0) {
    return { valid: true, ids: [] };
  }

  // Validate each ID exists
  const invalid = [];
  for (const id of ids) {
    const attemptDef = getAttemptDefinition(id);
    const flowDef = getFlowDefinition(id);
    if (!attemptDef && !flowDef) {
      invalid.push(id);
    }
  }

  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Unknown attempt/flow: ${invalid[0]}`,
      hint: `Run 'guardian presets' to see available attempts/flows`
    };
  }

  return { valid: true, ids };
}

function filterAttempts(attempts, filterIds) {
  if (!filterIds || filterIds.length === 0) {
    return attempts;
  }

  const filterSet = new Set(filterIds);
  return attempts.filter(id => filterSet.has(id));
}

function filterFlows(flows, filterIds) {
  if (!filterIds || filterIds.length === 0) {
    return flows;
  }

  const filterSet = new Set(filterIds);
  return flows.filter(id => filterSet.has(id));
}

module.exports = {
  validateAttemptFilter,
  filterAttempts,
  filterFlows
};
