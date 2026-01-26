import { readFileSync, existsSync } from 'fs';
import { dirname, basename } from 'path';
import { expectsNavigation } from './expectation-model.js';
import { hasMeaningfulUrlChange, hasVisibleChange, hasDomChange, getUrlPath } from '../shared/observable-utilities.js';
import { writeFindings } from './findings-writer.js';
import { classifySkipReason, collectSkipReasons } from './skip-classifier.js';
import { detectInteractiveFindings } from './interactive-findings.js';
import { detectPostAuthFindings } from './post-auth-findings.js';
import { enforceGateOutcomesForFindings } from '../core/gates/enforce-gate-outcome.js';

/**
 * Pure helper: Normalize CSS selector by removing brackets and parentheses.
 * Used for fuzzy selector matching when exact match fails.
 * @param {string} selector - CSS selector
 * @returns {string} Normalized selector
 */
function normalizeSelector(selector) {
  return selector.replace(/[[\]()]/g, '');
}

/**
 * Pure helper: Check if two selectors match (exact or fuzzy).
 * @param {string} selector1 - First selector
 * @param {string} selector2 - Second selector
 * @returns {boolean} True if selectors match
 */
function selectorsMatch(selector1, selector2) {
  if (selector1 === selector2) return true;
  if (selector1.includes(selector2) || selector2.includes(selector1)) return true;
  
  const normalized1 = normalizeSelector(selector1);
  const normalized2 = normalizeSelector(selector2);
  return normalized1 === normalized2;
}

/**
 * Pure helper: Check if expectation type matches interaction type.
 * @param {string} expectationType - Expectation type ('navigation', 'spa_navigation', 'form_submission')
 * @param {string} interactionType - Interaction type ('link', 'button', 'form')
 * @returns {boolean} True if types are compatible
 */
function expectationMatchesInteractionType(expectationType, interactionType) {
  if ((expectationType === 'navigation' || expectationType === 'spa_navigation') && 
      (interactionType === 'link' || interactionType === 'button')) {
    return true;
  }
  if (expectationType === 'form_submission' && interactionType === 'form') {
    return true;
  }
  return false;
}

/**
 * @param {string} manifestPath
 * @param {string} tracesPath
 * @param {Object} [validation]
 * @returns {Promise<any>}
 */
export async function detect(manifestPath, tracesPath, validation = null, _expectationCoverageGaps = null, _silenceTracker = null) {
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  
  if (!existsSync(tracesPath)) {
    throw new Error(`Observation traces not found: ${tracesPath}`);
  }
  
  const manifestContent = readFileSync(manifestPath, 'utf-8');
  const tracesContent = readFileSync(tracesPath, 'utf-8');
  
  // @ts-expect-error - readFileSync with encoding returns string
  const manifest = JSON.parse(manifestContent);
  // @ts-expect-error - readFileSync with encoding returns string
  const observation = JSON.parse(tracesContent);
  
  const projectDir = manifest.projectDir;
  const findings = [];
  
  // Extract runId from tracesPath: .verax/runs/<runId>/observation-traces.json
  let runId = null;
  try {
    const runDir = dirname(tracesPath);
    const runDirBasename = basename(runDir);
    // Check if runDir is in .verax/runs/<runId> structure
    const parentDir = dirname(runDir);
    if (basename(parentDir) === 'runs' && basename(dirname(parentDir)) === '.verax') {
      runId = runDirBasename;
    }
  } catch {
    // Ignore path parsing errors
  }
  
  let interactionsAnalyzed = 0;
  const skips = [];
  
  for (const trace of observation.traces) {
    const interaction = trace.interaction;
    const beforeUrl = trace.before.url;
    const afterUrl = trace.after.url;
    const beforeScreenshot = trace.before.screenshot;
    const afterScreenshot = trace.after.screenshot;
    
    const expectsNav = expectsNavigation(manifest, interaction, beforeUrl);
    
    if (!expectsNav) {
      const skipReason = classifySkipReason(manifest, interaction, beforeUrl, validation);
      if (skipReason) {
        skips.push({
          code: skipReason.code,
          message: skipReason.message,
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          }
        });
      }
      continue;
    }
    
    let expectedTargetPath = null;
    let expectationType = null;
    let selectorMismatch = false;
    let multipleMatches = false;
    
    if (manifest.staticExpectations && manifest.staticExpectations.length > 0) {
      const beforePath = getUrlPath(beforeUrl);
      if (beforePath) {
        const normalizedBefore = beforePath.replace(/\/$/, '') || '/';
        const matchingExpectations = [];
        
        for (const expectation of manifest.staticExpectations) {
          const normalizedFrom = expectation.fromPath.replace(/\/$/, '') || '/';
          if (normalizedFrom === normalizedBefore) {
            const selectorHint = expectation.selectorHint || '';
            const interactionSelector = interaction.selector || '';
            
            if (selectorHint && interactionSelector) {
              if (selectorsMatch(selectorHint, interactionSelector)) {
                if (expectationMatchesInteractionType(expectation.type, interaction.type)) {
                  matchingExpectations.push(expectation);
                }
              } else {
                if (expectationMatchesInteractionType(expectation.type, interaction.type)) {
                  selectorMismatch = true;
                }
              }
            } else if (!selectorHint && !interactionSelector) {
              if (expectationMatchesInteractionType(expectation.type, interaction.type)) {
                matchingExpectations.push(expectation);
              }
            }
          }
        }
        
        if (matchingExpectations.length > 1) {
          multipleMatches = true;
          // VISION TRANSPARENCY: Record ambiguity explicitly (not silent skip)
          if (_silenceTracker) {
            _silenceTracker.record({
              scope: 'expectation',
              reason: 'ambiguous_promise',
              description: `Multiple expectations match interaction "${interaction.label}" (${matchingExpectations.length} candidates). Cannot determine intent without guessing.`,
              context: {
                interaction: { type: interaction.type, selector: interaction.selector, label: interaction.label },
                candidateCount: matchingExpectations.length,
                candidates: matchingExpectations.map(e => e.targetPath)
              },
              impact: 'interaction_not_evaluated',
              outcome: 'UNPROVEN_INTERACTION'
            });
          }
        } else if (matchingExpectations.length === 1) {
          expectedTargetPath = matchingExpectations[0].targetPath;
          expectationType = matchingExpectations[0].type === 'spa_navigation' ? 'navigation' : matchingExpectations[0].type;
        } else if (selectorMismatch) {
          skips.push({
            code: 'SELECTOR_MISMATCH',
            message: 'Expectations exist but selector mismatch and no safe fallback match',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            }
          });
          continue;
        }
      }
    }
    
    if (!expectedTargetPath && manifest.projectType === 'react_spa' && interaction.type === 'link') {
      const beforePath = getUrlPath(beforeUrl);
      if (beforePath) {
        const matchingRoutes = [];
        const unreachableRoutes = new Set();
        
        if (validation && validation.details) {
          for (const detail of validation.details) {
            if (detail.status === 'UNREACHABLE') {
              unreachableRoutes.add(detail.path);
            }
          }
        }
        
        for (const route of manifest.routes) {
          if (!route.public) continue;
          if (unreachableRoutes.has(route.path)) {
            continue;
          }
          const routePath = route.path.toLowerCase();
          const routeName = routePath.split('/').pop() || 'home';
          const interactionLabel = (interaction.label || '').toLowerCase().trim();
          
          if (interactionLabel.includes(routeName) || routeName.includes(interactionLabel)) {
            matchingRoutes.push(route.path);
          }
        }
        
        if (matchingRoutes.length > 1) {
          // VISION TRANSPARENCY: Record ambiguity explicitly
          if (_silenceTracker) {
            _silenceTracker.record({
              scope: 'expectation',
              reason: 'ambiguous_promise',
              description: `Multiple routes match interaction "${interaction.label}" (${matchingRoutes.length} candidates). Conservative approach requires single clear match.`,
              context: {
                interaction: { type: interaction.type, selector: interaction.selector, label: interaction.label },
                candidateCount: matchingRoutes.length,
                candidates: matchingRoutes
              },
              impact: 'interaction_not_evaluated',
              outcome: 'UNPROVEN_INTERACTION'
            });
          }
          skips.push({
            code: 'AMBIGUOUS_MATCH',
            message: 'Multiple expectations could match; conservative approach requires single clear match',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            }
          });
          continue;
        } else if (matchingRoutes.length === 1) {
          expectedTargetPath = matchingRoutes[0];
          expectationType = 'navigation';
        }
      }
    }
    
    if (multipleMatches) {
      // VISION TRANSPARENCY: Ambiguity already recorded in silence tracker above
      skips.push({
        code: 'AMBIGUOUS_MATCH',
        message: 'Multiple expectations could match; conservative approach requires single clear match',
        interaction: {
          type: interaction.type,
          selector: interaction.selector,
          label: interaction.label
        }
      });
      continue;
    }
    
    interactionsAnalyzed++;
    
    const hasUrlChange = hasMeaningfulUrlChange(beforeUrl, afterUrl);
    // hasVisibleChange requires runId, skip comparison if runId unavailable
    let hasVisibleChangeResult = false;
    if (runId) {
      try {
        hasVisibleChangeResult = hasVisibleChange(beforeScreenshot, afterScreenshot, projectDir, runId);
      } catch (e) {
        // If screenshot comparison fails, treat as no visible change
        hasVisibleChangeResult = false;
      }
    }
    const hasDomChangeResult = hasDomChange(trace);
    
    if (expectedTargetPath) {
      const afterPath = getUrlPath(afterUrl);
      const normalizedTarget = expectedTargetPath.replace(/\/$/, '') || '/';
      const normalizedAfter = afterPath ? afterPath.replace(/\/$/, '') || '/' : '';
      
      if (expectationType === 'form_submission') {
        if (normalizedAfter !== normalizedTarget && !hasUrlChange && !hasDomChangeResult) {
          findings.push({
            type: 'silent_failure',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'Expected form submission did not occur',
            evidence: {
              before: beforeScreenshot,
              after: afterScreenshot,
              beforeUrl: beforeUrl,
              afterUrl: afterUrl
            }
          });
        }
      } else if (expectationType === 'navigation') {
        const urlMatchesTarget = normalizedAfter === normalizedTarget;
        const hasEffect = urlMatchesTarget || hasVisibleChangeResult || hasDomChangeResult;
        
        if (!hasEffect) {
          findings.push({
            type: 'navigation_silent_failure',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'Expected user-visible outcome did not occur',
            what_happened: 'Navigation attempt produced no visible effect',
            what_was_expected: `Navigate to ${normalizedTarget || 'target page'}`,
            what_was_observed: 'URL, DOM, and visuals remained unchanged',
            why_it_matters: 'Users cannot reach the intended destination despite interacting',
            evidence: {
              before: beforeScreenshot,
              after: afterScreenshot,
              beforeUrl: beforeUrl,
              afterUrl: afterUrl
            }
          });
        }
      }
    } else {
      if (!hasUrlChange && !hasVisibleChangeResult && !hasDomChangeResult) {
        findings.push({
          type: 'silent_failure',
          interaction: {
            type: interaction.type,
            selector: interaction.selector,
            label: interaction.label
          },
          reason: 'Expected user-visible outcome did not occur',
          what_happened: 'User action produced no visible effect',
          what_was_expected: 'Some user-visible change after interaction',
          what_was_observed: 'URL, DOM, and visuals remained unchanged',
          why_it_matters: 'Users cannot complete the intended action',
          evidence: {
            before: beforeScreenshot,
            after: afterScreenshot,
            beforeUrl: beforeUrl,
            afterUrl: afterUrl
          }
        });
      }
    }
  }
  
  // Interactive and accessibility intelligence
  detectInteractiveFindings(observation.traces, manifest, findings);
  
  // Post-Auth & RBAC Detection (Vision 1.0 Scope Lock)
  // Detect post-auth contexts and emit OUT_OF_SCOPE markers instead of findings
  const postAuthResult = detectPostAuthFindings(observation.traces, manifest, findings);
  // Post-auth never produces findings, but may produce skip markers
  if (postAuthResult.skips && postAuthResult.skips.length > 0) {
    for (const skip of postAuthResult.skips) {
      skips.push({
        code: 'OUT_OF_SCOPE_POST_AUTH',
        message: skip.reason,
        reason: skip.reason
      });
    }
  }
  
  // Infer canonical run directory from tracesPath when available
  let runDir = null;
  try {
    runDir = dirname(tracesPath);
  } catch {
    // Ignore path parsing errors
  }

  const findingsResult = writeFindings(projectDir, observation.url, findings, [], runDir);
  
  // Optional gate enforcement (only if VERAX_ENFORCE_GATES=1)
  enforceGateOutcomesForFindings(findings);
  
  const skipSummary = collectSkipReasons(skips);
  
  const detectTruth = {
    interactionsAnalyzed: interactionsAnalyzed,
    interactionsSkippedNoExpectation: skipSummary.total,
    findingsCount: findings.length,
    skips: skipSummary
  };
  
  return {
    ...findingsResult,
    detectTruth: detectTruth
  };
}



