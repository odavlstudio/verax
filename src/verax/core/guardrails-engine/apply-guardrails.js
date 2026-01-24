/**
 * Internal: Apply guardrails using policy
 */

import { getGuardrailsPolicy } from './policy-cache.js';
import { getPolicyReport } from '../guardrails/policy.loader.js';
import { mapActionToSeverity, evaluateRule } from './evaluate-rule.js';

export function applyGuardrails(finding, context = {}, options = {}) {
  const evidencePackage = context.evidencePackage || finding.evidencePackage || {};
  const signals = context.signals || evidencePackage.signals || {};
  const _confidenceReasons = context.confidenceReasons || finding.confidenceReasons || [];
  const _promiseType = context.promiseType || finding.expectation?.type || finding.promise?.type || null;
  
  const policy = getGuardrailsPolicy(options.policyPath, options.projectDir);
  const policyReport = getPolicyReport(policy);
  
  const appliedRules = [];
  const contradictions = [];
  let recommendedStatus = finding.severity || finding.status || 'SUSPECTED';
  const confidenceAdjustments = [];
  let confidenceDelta = 0;
  
  const sortedRules = [...policy.rules].sort((a, b) => a.id.localeCompare(b.id));
  
  for (const rule of sortedRules) {
    const appliesToFinding = rule.appliesTo.includes('*') || 
                             rule.appliesTo.some(cap => finding.type?.includes(cap));
    if (!appliesToFinding) continue;
    
    const evaluation = evaluateRule(rule, finding, signals, evidencePackage);
    
    if (evaluation.applies) {
      appliedRules.push({
        code: rule.id,
        severity: mapActionToSeverity(rule.action),
        message: evaluation.message,
        ruleId: rule.id,
        category: rule.category
      });
      
      if (evaluation.contradiction) {
        contradictions.push({ code: rule.id, message: evaluation.message });
      }
      
      if (evaluation.recommendedStatus) {
        recommendedStatus = evaluation.recommendedStatus;
      }
      
      const delta = rule.confidenceDelta || 0;
      confidenceDelta += delta;
      
      if (delta !== 0) {
        confidenceAdjustments.push({ reason: rule.id, delta, message: evaluation.message });
      }
    }
  }
  
  let finalConfidence = finding.confidence || 0;
  if (confidenceDelta !== 0) {
    finalConfidence = Math.max(0, Math.min(1, finalConfidence + confidenceDelta));
  }
  
  const guardrailsReport = {
    appliedRules,
    contradictions,
    recommendedStatus,
    confidenceAdjustments,
    confidenceDelta,
    finalDecision: recommendedStatus,
    policyReport: {
      version: policyReport.version,
      source: policyReport.source,
      appliedRuleIds: appliedRules.map(r => r.code)
    }
  };
  
  const updatedFinding = {
    ...finding,
    severity: recommendedStatus,
    status: recommendedStatus,
    confidence: finalConfidence,
    guardrails: guardrailsReport,
  };
  
  return { finding: updatedFinding, guardrails: guardrailsReport };
}
