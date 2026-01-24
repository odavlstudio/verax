import { resolve } from 'path';
import { atomicWriteJson } from '../support/atomic-write.js';
import { ARTIFACT_REGISTRY } from '../../../verax/core/artifacts/registry.js';
import { JUDGMENT_TYPES, getJudgmentPriority, explainJudgment } from '../../../verax/detect/judgment-mapper.js';

/**
 * Create deterministic judgments from observations.
 * Rule of thumb (deterministic, evidence-based):
 * - observed=true       => PASS
 * - attempted=true & observed=false => FAILURE_SILENT
 * - else                => NEEDS_REVIEW
 *
 * @param {Array<Object>} observations
 * @returns {Array<Object>} judgments
 */
function deriveJudgments(observations = []) {
  const judgments = observations.map((o) => {
    let judgment = JUDGMENT_TYPES.NEEDS_REVIEW;
    if (o?.observed === true) {
      judgment = JUDGMENT_TYPES.PASS;
    } else if (o?.attempted === true && o?.observed === false) {
      judgment = JUDGMENT_TYPES.FAILURE_SILENT;
    }

    const title = humanTitleForObservation(o);

    return {
      promiseId: o?.id || o?.promise?.id || 'unknown',
      judgment,
      title,
      explanation: explainJudgment(judgment),
      category: o?.category || o?.type || 'unknown',
      selector: o?.promise?.selector || null,
    };
  });

  // Group and order by severity/impact deterministically
  return judgments.sort((a, b) => {
    const pa = getJudgmentPriority(a.judgment);
    const pb = getJudgmentPriority(b.judgment);
    if (pb !== pa) return pb - pa;
    return String(a.title || '').localeCompare(String(b.title || ''), 'en');
  });
}

function humanTitleForObservation(o) {
  const kind = o?.type || o?.category || 'interaction';
  const selector = o?.promise?.selector || o?.selector || null;
  const href = o?.promise?.value || o?.runtimeNav?.normalizedHref || null;
  if (selector) return `${kind}: ${selector}`;
  if (href) return `${kind}: ${href}`;
  return kind;
}

/**
 * Write judgments.json for Output Contract 2.0
 *
 * @param {string} runDir
 * @param {Object} observeData
 */
export function writeJudgmentsJson(runDir, observeData) {
  const judgmentsPath = resolve(runDir, 'judgments.json');
  const observations = Array.isArray(observeData?.observations) ? observeData.observations : [];
  const judgments = deriveJudgments(observations);

  const counts = {
    PASS: judgments.filter(j => j.judgment === JUDGMENT_TYPES.PASS).length,
    WEAK_PASS: judgments.filter(j => j.judgment === JUDGMENT_TYPES.WEAK_PASS).length,
    NEEDS_REVIEW: judgments.filter(j => j.judgment === JUDGMENT_TYPES.NEEDS_REVIEW).length,
    FAILURE_SILENT: judgments.filter(j => j.judgment === JUDGMENT_TYPES.FAILURE_SILENT).length,
    FAILURE_MISLEADING: judgments.filter(j => j.judgment === JUDGMENT_TYPES.FAILURE_MISLEADING).length,
  };

  const payload = {
    contractVersion: ARTIFACT_REGISTRY.judgments?.contractVersion || 1,
    judgments,
    counts,
  };

  atomicWriteJson(judgmentsPath, payload);
}
