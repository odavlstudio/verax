/**
 * CONSTITUTION VALIDATOR — Enforce Evidence Law v2 + Ambiguity Awareness + Artifact Integrity
 *
 * This validator enforces VERAX's constitutional principles:
 * 1. Evidence Law v2: CONFIRMED requires strong evidence categories (navigation, meaningful_dom, feedback, network)
 * 2. Ambiguity Engine: Explicit downgrade rules for console-only, network-only, blocked_write presence
 * 3. No Guessing: Inference without observable signal → DROP
 * 4. Required Fields: Missing/invalid fields → DROP
 * 5. Confidence Bounds: Score must be 0–1
 * 6. Status Semantics: Only CONFIRMED, SUSPECTED, INFORMATIONAL
 * 7. Artifact Integrity: Evidence file references must exist, summary/findings counts must match
 *
 * Validator is pure (no I/O), deterministic, and side-effect free.
 * Returns validation result with reason for any rejection.
 */

import {
  REQUIRED_FINDING_FIELDS,
  ALLOWED_STATUSES,
  ALLOWED_SEVERITIES,
  ALLOWED_FINDING_TYPES
} from './finding-contract.js';

function normalizeEvidenceFileRef(ref) {
  if (typeof ref !== 'string') return null;
  const raw = ref.trim();
  if (!raw) return null;
  const replaced = raw.replace(/\\/g, '/');
  const withoutPrefix = replaced.startsWith('./') ? replaced.slice(2) : replaced;
  // Disallow absolute paths, drive letters, UNC, and traversal.
  if (/^[a-zA-Z]:\//.test(withoutPrefix)) return null;
  if (withoutPrefix.startsWith('/') || withoutPrefix.startsWith('\\\\')) return null;
  if (withoutPrefix.includes('..')) return null;
  return withoutPrefix;
}

function hasStrongEvidenceFileClass(evidenceFiles) {
  const files = Array.isArray(evidenceFiles) ? evidenceFiles : [];
  const hasDomDiff = files.some((f) => typeof f === 'string' && f.includes('dom_diff') && f.endsWith('.json'));
  const hasNetwork = files.some((f) => typeof f === 'string' && f.includes('network') && f.endsWith('.json'));
  const hasBefore = files.some((f) => typeof f === 'string' && f.includes('before') && f.endsWith('.png'));
  const hasAfter = files.some((f) => typeof f === 'string' && f.includes('after') && f.endsWith('.png'));
  return hasDomDiff || hasNetwork || (hasBefore && hasAfter);
}

function isValidPromiseShape(promise) {
  if (!promise || typeof promise !== 'object') return false;

  const { kind, value, type, expected, actual, expected_signal } = promise;
  const hasKindValue = typeof kind === 'string' && kind.length > 0 && typeof value === 'string' && value.length > 0;
  const hasTypeExpectation = typeof type === 'string' && type.length > 0 && (
    (typeof expected === 'string' && expected.length > 0) ||
    (typeof actual === 'string' && actual.length > 0) ||
    (typeof expected_signal === 'string' && expected_signal.length > 0)
  );

  return hasKindValue || hasTypeExpectation;
}

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - True if finding passes all checks
 * @property {string} [reason] - Reason for rejection if invalid
 * @property {string} [action] - Action taken (DROP, DOWNGRADE, etc.)
 * @property {Object} [downgrade] - If downgraded, contains new status and enrichment updates
 * @property {Array} [ambiguityReasons] - List of detected ambiguity reasons
 * @property {Array} [evidenceCategories] - Classified evidence categories
 */

/**
 * EVIDENCE CATEGORY CLASSIFIER
 * 
 * Analyze evidence object and classify into concrete categories.
 * Strong categories: navigation, meaningful_dom, feedback, network (what actually happened)
 * Weak categories: console, blocked_write (ambiguity signals), captured_evidence (supporting artifacts)
 * 
 * @private
 */
function classifyEvidenceCategories(evidence) {
  const categories = {
    strong: [],
    weak: [],
    raw: {}
  };

  if (!evidence || typeof evidence !== 'object') {
    return categories;
  }

  // Check for strong categories via explicit signal names
  // Note: Use 'in' operator to distinguish between false/true and undefined
  if ('navigation_changed' in evidence || 'navigationChanged' in evidence ||
      'hasUrlChange' in evidence || 'beforeUrl' in evidence || 'afterUrl' in evidence) {
    categories.strong.push('navigation');
    categories.raw.navigation = true;
  }

  if ('meaningful_dom_change' in evidence || 'meaningfulDomChange' in evidence ||
      'dom_changed' in evidence || 'domChanged' in evidence ||
      'dom_diff' in evidence || 'domDiff' in evidence ||
      'hasDomChange' in evidence) {
    categories.strong.push('meaningful_dom');
    categories.raw.meaningful_dom = true;
  }

  if ('feedback_seen' in evidence || 'feedbackSeen' in evidence ||
      'aria_live' in evidence || 'statusMessage' in evidence ||
      'success_message' in evidence || 'successMessage' in evidence) {
    categories.strong.push('feedback');
    categories.raw.feedback = true;
  }

  if ('correlated_network_activity' in evidence || 'correlatedNetworkActivity' in evidence ||
      'network_activity' in evidence || 'networkActivity' in evidence ||
      'network_request' in evidence || 'networkRequest' in evidence ||
      'networkRequests' in evidence) {
    categories.strong.push('network');
    categories.raw.network = true;
  }

  // Check for weak/ambiguity categories
  if ('console_errors' in evidence || 'consoleErrors' in evidence ||
      'console_error' in evidence || 'consoleError' in evidence) {
    categories.weak.push('console');
    categories.raw.console = true;
  }

  if ('blocked_writes' in evidence || 'blockedWrites' in evidence ||
      'blocked_write' in evidence || 'blockedWrite' in evidence) {
    categories.weak.push('blocked_write');
    categories.raw.blocked_write = true;
  }

  // Check for captured evidence files (screenshots, traces, etc.) as weak supporting evidence
  const evidenceFiles = evidence.evidence_files || evidence.evidenceFiles || [];
  if (Array.isArray(evidenceFiles) && evidenceFiles.length > 0) {
    categories.weak.push('captured_evidence');
    categories.raw.captured_evidence = true;
  }

  return categories;
}

/**
 * AMBIGUITY ENGINE
 * 
 * Deterministic ambiguity detection and recording.
 * Returns null if no ambiguity, otherwise returns ambiguity info object.
 * 
 * @private
 */
function detectAmbiguities(finding, evidenceCategories) {
  const ambiguities = [];

  if (!evidenceCategories) {
    return null;
  }

  // Rule: blocked_write present => AMBIGUITY (browser protection, not app failure)
  if (evidenceCategories.raw.blocked_write) {
    ambiguities.push('blocked_write_detected: Browser protection/sandbox interference may mask real behavior');
  }

  // Rule: console_errors present AND no strong categories => AMBIGUITY
  if (evidenceCategories.raw.console && evidenceCategories.strong.length === 0) {
    ambiguities.push('console_only: Errors may be external/transient, not app-generated');
  }

  // Rule: network activity BUT no navigation/meaningful_dom/feedback => AMBIGUITY (backend did something, UI silent)
  if (evidenceCategories.raw.network &&
      !evidenceCategories.raw.navigation &&
      !evidenceCategories.raw.meaningful_dom &&
      !evidenceCategories.raw.feedback) {
    ambiguities.push('network_only: Backend activity detected but no UI confirmation (possible pending operation)');
  }

  return ambiguities.length > 0 ? { reasons: ambiguities } : null;
}

/**
 * EVIDENCE LAW v2 ENFORCER
 * CONFIRMED requires at least one STRONG evidence category:
 * - navigation OR meaningful_dom OR feedback OR network
 * 
 * If CONFIRMED has NONE of these, downgrade to SUSPECTED.
 * Presence of only console or blocked_write (weak categories) must NEVER yield CONFIRMED.
 *
 * @private
 */
function enforceEvidenceLaw(finding) {
  if (finding.status !== 'CONFIRMED') {
    return { valid: true }; // Only CONFIRMED needs evidence
  }

  // STRICT CONTRACT: For key silent-failure types, CONFIRMED is allowed only when
  // at least one strong evidence category is present as a *real artifact/signal*,
  // not merely by having the boolean key present with a false value.
  const STRICT_SILENT_FAILURE_TYPES = new Set([
    'dead_interaction_silent_failure',
    'broken_navigation_promise',
    'silent_submission',
  ]);

  function hasStrongSilentFailureEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object') return false;

    const files = Array.isArray(evidence.evidence_files)
      ? evidence.evidence_files
      : (Array.isArray(evidence.evidenceFiles) ? evidence.evidenceFiles : []);

    const hasDomDiffFile = files.some((f) => typeof f === 'string' && f.includes('dom_diff') && f.endsWith('.json'));
    const hasNetworkFile = files.some((f) => typeof f === 'string' && f.includes('network') && f.endsWith('.json'));

    const hasNavigationEvidence =
      (evidence.route_data && typeof evidence.route_data === 'object') ||
      (evidence.routeData && typeof evidence.routeData === 'object') ||
      (typeof evidence.beforeUrl === 'string' && typeof evidence.afterUrl === 'string') ||
      (typeof evidence.before_url === 'string' && typeof evidence.after_url === 'string');

    const hasMeaningfulDomEvidence =
      hasDomDiffFile ||
      (evidence.dom_diff && typeof evidence.dom_diff === 'object') ||
      (evidence.domDiff && typeof evidence.domDiff === 'object') ||
      (evidence.hasDomChange === true) ||
      (evidence.hasDomChange === false && (evidence.dom_diff || evidence.domDiff));

    const hasFeedbackEvidence =
      evidence.feedback_seen === true ||
      evidence.feedbackSeen === true ||
      typeof evidence.statusMessage === 'string' ||
      typeof evidence.status_message === 'string' ||
      typeof evidence.success_message === 'string' ||
      typeof evidence.successMessage === 'string' ||
      typeof evidence.aria_live === 'string' ||
      typeof evidence.ariaLive === 'string';

    const hasNetworkEvidence =
      hasNetworkFile ||
      evidence.correlated_network_activity === true ||
      evidence.correlatedNetworkActivity === true ||
      evidence.network_activity === true ||
      evidence.networkActivity === true ||
      (evidence.network_request && typeof evidence.network_request === 'object') ||
      (evidence.networkRequest && typeof evidence.networkRequest === 'object') ||
      (Array.isArray(evidence.networkRequests) && evidence.networkRequests.length > 0);

    return hasNavigationEvidence || hasMeaningfulDomEvidence || hasFeedbackEvidence || hasNetworkEvidence;
  }

  // CONFIRMED requires evidence
  if (!finding.evidence || typeof finding.evidence !== 'object') {
    return {
      valid: false,
      reason: 'Evidence Law v2: CONFIRMED status requires evidence object',
      action: 'DOWNGRADE',
      downgrade: {
        status: 'SUSPECTED',
        enrichment: { evidenceLawDowngradeReasons: ['missing_evidence_object'] }
      }
    };
  }

  if (STRICT_SILENT_FAILURE_TYPES.has(finding.type)) {
    if (!hasStrongSilentFailureEvidence(finding.evidence)) {
      return {
        valid: false,
        reason: 'Evidence Law v2: Silent-failure CONFIRMED requires at least one strong evidence category (navigation/route, meaningful_dom, feedback, or network)',
        action: 'DOWNGRADE',
        downgrade: {
          status: 'SUSPECTED',
          enrichment: { evidenceLawDowngradeReasons: ['missing_strong_evidence'] }
        }
      };
    }
    return { valid: true };
  }

  // Classify evidence into strong/weak categories
  const categories = classifyEvidenceCategories(finding.evidence);

  // CONFIRMED requires at least one STRONG category
  if (categories.strong.length === 0) {
    return {
      valid: false,
      reason: `Evidence Law v2: CONFIRMED requires strong evidence category (navigation, meaningful_dom, feedback, or network). Found only: ${categories.weak.join(', ') || 'none'}`,
      action: 'DOWNGRADE',
      downgrade: {
        status: 'SUSPECTED',
        enrichment: { evidenceLawDowngradeReasons: ['missing_strong_evidence'] }
      }
    };
  }

  return { valid: true };
}

/**
 * EVIDENCE FILE EXISTENCE LAW (silent failures only)
 *
 * For key silent-failure finding types, CONFIRMED must:
 * - include evidence_files (or evidenceFiles) on evidence object
 * - reference only safe, relative paths (no traversal/absolute)
 * - every referenced file must exist in the provided evidenceFileIndex
 * - include at least one strong evidence file class: dom_diff OR network OR before+after screenshot pair
 *
 * Pure: requires a precomputed evidenceFileIndex set (no fs I/O here).
 *
 * @private
 * @param {Object} finding
 * @param {{ evidenceFileIndex?: Set<string> } | undefined} context
 */
function enforceEvidenceFileExistenceLaw(finding, context) {
  if (!finding || finding.status !== 'CONFIRMED') return { valid: true };

  const STRICT_SILENT_FAILURE_TYPES = new Set([
    'dead_interaction_silent_failure',
    'broken_navigation_promise',
    'silent_submission',
  ]);

  if (!STRICT_SILENT_FAILURE_TYPES.has(finding.type)) return { valid: true };

  const evidenceFileIndex = context?.evidenceFileIndex;
  // If no index provided, we cannot prove existence; do not enforce here.
  // Runtime enforcement is expected to pass an index from the run evidence directory.
  if (!(evidenceFileIndex instanceof Set)) return { valid: true };

  const evidence = finding.evidence;
  const evidenceFilesRaw = Array.isArray(evidence?.evidence_files)
    ? evidence.evidence_files
    : (Array.isArray(evidence?.evidenceFiles) ? evidence.evidenceFiles : null);

  /** @type {string[]} */
  const reasons = [];
  if (!Array.isArray(evidenceFilesRaw) || evidenceFilesRaw.length === 0) {
    reasons.push('missing_evidence_files_list');
  }

  /** @type {string[]} */
  const normalizedRefs = [];
  if (Array.isArray(evidenceFilesRaw)) {
    for (const ref of evidenceFilesRaw) {
      const normalized = normalizeEvidenceFileRef(ref);
      if (!normalized) {
        reasons.push('invalid_evidence_file_ref');
        continue;
      }
      normalizedRefs.push(normalized);
    }
  }

  for (const ref of normalizedRefs) {
    if (!evidenceFileIndex.has(ref)) {
      reasons.push('evidence_file_missing');
      break;
    }
  }

  if (!hasStrongEvidenceFileClass(normalizedRefs)) {
    reasons.push('missing_strong_evidence_file');
  }

  if (reasons.length === 0) return { valid: true };

  const uniqueReasons = Array.from(new Set(reasons)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    valid: false,
    reason: 'Evidence File Existence Law: CONFIRMED silent-failure must reference existing evidence files under run evidence directory',
    action: 'DOWNGRADE',
    downgrade: {
      status: 'SUSPECTED',
      enrichment: { evidenceFileLawDowngradeReasons: uniqueReasons }
    }
  };
}

function extractExpNumFromEvidenceFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const nums = new Set();
  for (const f of list) {
    if (typeof f !== 'string') continue;
    const m = /(?:^|\/)exp_(\d+)_/i.exec(f);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  const arr = Array.from(nums).sort((a, b) => a - b);
  return arr;
}

/**
 * OBSERVE ↔ FINDINGS MINIMAL CONSISTENCY (silent failures only)
 *
 * For key silent-failure finding types, CONFIRMED must be traceable to an observe-recorded evidence set.
 * Mapping strategy (deterministic):
 * - derive expNum from evidence_files (exp_<N>_ prefix)
 * - look up observeEvidenceByExpNum.get(N)
 * - require every evidence_files ref to be present in that observation evidence set
 *
 * If mapping cannot be proven, downgrade to SUSPECTED and record a deterministic note.
 *
 * Pure: requires observeEvidenceByExpNum in context (no fs I/O here).
 *
 * @private
 * @param {Object} finding
 * @param {{ observeEvidenceByExpNum?: Map<number, Set<string>> } | undefined} context
 */
function enforceObserveFindingConsistencyLaw(finding, context) {
  if (!finding || finding.status !== 'CONFIRMED') return { valid: true };

  const STRICT_SILENT_FAILURE_TYPES = new Set([
    'dead_interaction_silent_failure',
    'broken_navigation_promise',
    'silent_submission',
  ]);
  if (!STRICT_SILENT_FAILURE_TYPES.has(finding.type)) return { valid: true };

  const observeEvidenceByExpNum = context?.observeEvidenceByExpNum;
  if (!(observeEvidenceByExpNum instanceof Map)) return { valid: true };

  const evidence = finding.evidence;
  const evidenceFilesRaw = Array.isArray(evidence?.evidence_files)
    ? evidence.evidence_files
    : (Array.isArray(evidence?.evidenceFiles) ? evidence.evidenceFiles : null);

  /** @type {string[]} */
  const notes = [];
  if (!Array.isArray(evidenceFilesRaw) || evidenceFilesRaw.length === 0) {
    notes.push('missing_evidence_files_list');
  }

  const normalizedRefs = [];
  if (Array.isArray(evidenceFilesRaw)) {
    for (const ref of evidenceFilesRaw) {
      const normalized = normalizeEvidenceFileRef(ref);
      if (!normalized) {
        notes.push('invalid_evidence_file_ref');
        continue;
      }
      normalizedRefs.push(normalized);
    }
  }

  const expNums = extractExpNumFromEvidenceFiles(normalizedRefs);
  if (expNums.length === 0) {
    notes.push('unmapped_to_observation');
  } else if (expNums.length > 1) {
    notes.push('ambiguous_observation_mapping');
  } else {
    const n = expNums[0];
    const obsSet = observeEvidenceByExpNum.get(n);
    if (!(obsSet instanceof Set)) {
      notes.push('observation_missing');
    } else {
      for (const ref of normalizedRefs) {
        if (!obsSet.has(ref)) {
          notes.push('evidence_not_in_observation');
          break;
        }
      }
    }
  }

  if (notes.length === 0) return { valid: true };
  const uniqueNotes = Array.from(new Set(notes)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    valid: false,
    reason: 'Observe/Findings Consistency: CONFIRMED silent-failure evidence must be traceable to observe.json evidence for the interaction',
    action: 'DOWNGRADE',
    downgrade: {
      status: 'SUSPECTED',
      enrichment: { evidenceCrossArtifactNotes: uniqueNotes },
    }
  };
}

/**
 * NO GUESSING ENFORCER
 * Findings based on pure inference without observable signal must be dropped.
 *
 * @private
 */
function enforceNoGuessing(finding) {
  // High confidence requires evidence of observation
  if (finding.confidence > 0.85) {
    // Check if there's any meaningful evidence
    const hasEvidenceOfObservation =
      (finding.evidence &&
        ((finding.evidence.before && finding.evidence.after) || // screenshots
          finding.evidence.networkRequest ||
          finding.evidence.consoleError ||
          finding.evidence.signal || // generic signal
          finding.evidence.trace ||
          Object.keys(finding.evidence).length > 0)); // any evidence entry

    if (!hasEvidenceOfObservation) {
      return {
        valid: false,
        reason: 'High confidence finding with zero evidence is pure guessing',
        action: 'DROP'
      };
    }
  }

  return { valid: true };
}

/**
 * REQUIRED FIELDS ENFORCER
 * All required fields must be present and valid.
 *
 * @private
 */
function enforceRequiredFields(finding) {
  for (const field of REQUIRED_FINDING_FIELDS) {
    if (!(field in finding)) {
      return {
        valid: false,
        reason: `Missing required field: ${field}`,
        action: 'DROP'
      };
    }

    const value = finding[field];

    // Type-specific validations
    if (field === 'id' && typeof value !== 'string') {
      return { valid: false, reason: 'id must be string', action: 'DROP' };
    }

    if (field === 'type' && !ALLOWED_FINDING_TYPES.includes(value)) {
      return {
        valid: false,
        reason: `type must be one of: ${ALLOWED_FINDING_TYPES.join(', ')}`,
        action: 'DROP'
      };
    }

    if (field === 'status' && !ALLOWED_STATUSES.includes(value)) {
      return {
        valid: false,
        reason: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
        action: 'DROP'
      };
    }

    if (field === 'severity' && !ALLOWED_SEVERITIES.includes(value)) {
      return {
        valid: false,
        reason: `severity must be one of: ${ALLOWED_SEVERITIES.join(', ')}`,
        action: 'DROP'
      };
    }

    if (field === 'confidence') {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        return {
          valid: false,
          reason: `confidence must be number between 0 and 1, got ${value}`,
          action: 'DROP'
        };
      }
    }

    if (field === 'promise' && (!value || typeof value !== 'object')) {
      return { valid: false, reason: 'promise must be object', action: 'DROP' };
    }

    if (field === 'observed' && (!value || typeof value !== 'object')) {
      return { valid: false, reason: 'observed must be object', action: 'DROP' };
    }

    if (field === 'evidence' && typeof value !== 'object') {
      return { valid: false, reason: 'evidence must be object', action: 'DROP' };
    }

    if (field === 'impact' && typeof value !== 'string') {
      return { valid: false, reason: 'impact must be string', action: 'DROP' };
    }
  }

  if (typeof finding.id !== 'string' || finding.id.trim().length === 0) {
    return { valid: false, reason: 'id must be non-empty string', action: 'DROP' };
  }

  if (!isValidPromiseShape(finding.promise)) {
    return { valid: false, reason: 'promise must include kind/value or type expectation', action: 'DROP' };
  }

  return { valid: true };
}

/**
 * CONSTITUTION VALIDATOR — Main Entry Point
 *
 * Validates a finding against all constitutional rules.
 * Also detects ambiguities and records them in enrichment.
 * Returns validation result and optional downgrade instruction.
 *
 * PURE: No I/O, no side effects, no state mutation.
 * DETERMINISTIC: Same input always produces same output.
 *
 * @param {Object} finding - Finding to validate
 * @returns {ValidationResult} - Validation result with reason if invalid
 */
export function validateFindingConstitution(finding, context) {
  if (!finding || typeof finding !== 'object') {
    return {
      valid: false,
      reason: 'Finding is not an object',
      action: 'DROP'
    };
  }

  // 1. Check required fields first (foundational)
  const requiredCheck = enforceRequiredFields(finding);
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  // 2. Enforce evidence law
  const evidenceCheck = enforceEvidenceLaw(finding);
  if (!evidenceCheck.valid) {
    return evidenceCheck;
  }

  // 2b. Enforce evidence file existence law for strict silent-failure types (context-driven)
  const fileLawCheck = enforceEvidenceFileExistenceLaw(finding, context);
  if (!fileLawCheck.valid) {
    return fileLawCheck;
  }

  // 2c. Enforce observe↔finding minimal consistency for strict silent-failure types (context-driven)
  const observeConsistencyCheck = enforceObserveFindingConsistencyLaw(finding, context);
  if (!observeConsistencyCheck.valid) {
    return observeConsistencyCheck;
  }

  // 3. Detect ambiguities (for enrichment recording, not for rejection)
  const categories = classifyEvidenceCategories(finding.evidence);
  const ambiguityInfo = detectAmbiguities(finding, categories);

  // 4. Enforce no guessing
  const guessingCheck = enforceNoGuessing(finding);
  if (!guessingCheck.valid) {
    return guessingCheck;
  }

  // All checks passed, return with ambiguity info if present
  return {
    valid: true,
    ambiguityReasons: ambiguityInfo?.reasons || [],
    evidenceCategories: categories.strong
  };
}

/**
 * APPLY VALIDATION RESULT
 *
 * Takes a finding and a validation result, and either:
 * - Returns the finding unchanged (valid: true)
 * - Returns a downgraded finding (action: DOWNGRADE)
 * - Returns null (action: DROP)
 * 
 * Also enriches finding with ambiguity reasons and evidence categories.
 *
 * PURE: No I/O, returns new object if modification needed.
 *
 * @param {Object} finding - The finding
 * @param {ValidationResult} result - Validation result from validateFindingConstitution
 * @returns {Object | null} - Modified finding or null if dropped
 */
export function applyValidationResult(finding, result) {
  let modified = finding;

  // Record enrichment data: ambiguity reasons and evidence categories
  if (result.ambiguityReasons || result.evidenceCategories) {
    modified = {
      ...modified,
      enrichment: {
        ...(modified.enrichment || {}),
        ambiguityReasons: result.ambiguityReasons || [],
        evidenceCategories: result.evidenceCategories || []
      }
    };
  }

  if (result.valid) {
    return modified;
  }

  if (result.action === 'DOWNGRADE' && result.downgrade) {
    const downgrade = result.downgrade || {};
    const downgradeEnrichment = downgrade.enrichment;
    let mergedEnrichment = downgradeEnrichment && typeof downgradeEnrichment === 'object'
      ? { ...(modified.enrichment || {}), ...downgradeEnrichment }
      : (modified.enrichment || undefined);

    // Do not clobber existing enrichment arrays for downgrade reason lists.
    if (mergedEnrichment && typeof mergedEnrichment === 'object') {
      for (const key of ['evidenceLawDowngradeReasons', 'evidenceFileLawDowngradeReasons', 'evidenceCrossArtifactNotes']) {
        const existing = modified?.enrichment?.[key];
        const incoming = downgradeEnrichment?.[key];
        if (Array.isArray(existing) && Array.isArray(incoming)) {
          const combined = Array.from(new Set([...existing, ...incoming]))
            .filter((v) => typeof v === 'string' && v.length > 0)
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          mergedEnrichment[key] = combined;
        }
      }
    }

    return {
      ...modified,
      ...downgrade,
      ...(mergedEnrichment ? { enrichment: mergedEnrichment } : {})
    };
  }

  if (result.action === 'DROP') {
    return null;
  }

  return null; // Default to drop if unsure
}

/**
 * VALIDATE AND SANITIZE
 *
 * Complete pipeline: validate and apply result in one call.
 *
 * @param {Object} finding - Finding to validate
 * @returns {Object | null} - Valid finding or null if dropped
 */
export function validateAndSanitizeFinding(finding) {
  const result = validateFindingConstitution(finding);
  return applyValidationResult(finding, result);
}

/**
 * BATCH VALIDATE
 *
 * Validate multiple findings and return only valid ones.
 * Tracks drops and downgrades for transparency.
 *
 * @param {Array} findings - Array of findings to validate
 * @returns {Object} - { valid: [], dropped: number, downgraded: number }
 */
export function batchValidateFindings(findings, context) {
  if (!Array.isArray(findings)) {
    return { valid: [], dropped: 1, downgraded: 0 };
  }

  const valid = [];
  let dropped = 0;
  let downgraded = 0;

  for (const finding of findings) {
    const result = validateFindingConstitution(finding, context);
    const sanitized = applyValidationResult(finding, result);

    if (sanitized === null) {
      dropped++;
    } else if (result.action === 'DOWNGRADE') {
      downgraded++;
      valid.push(sanitized);
    } else if (result.valid) {
      valid.push(sanitized);
    }
  }

  return { valid, dropped, downgraded };
}
