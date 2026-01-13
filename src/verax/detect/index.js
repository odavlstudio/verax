import { readFileSync, existsSync } from 'fs';
import { dirname, basename } from 'path';
import { expectsNavigation } from './expectation-model.js';
import { hasMeaningfulUrlChange, hasVisibleChange, hasDomChange } from './comparison.js';
import { writeFindings } from './findings-writer.js';
import { getUrlPath } from './evidence-validator.js';
import { classifySkipReason, collectSkipReasons } from './skip-classifier.js';
import { detectInteractiveFindings } from './interactive-findings.js';

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
  
  const manifest = JSON.parse(manifestContent);
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
              const normalizedSelectorHint = selectorHint.replace(/[[\]()]/g, '');
              const normalizedInteractionSelector = interactionSelector.replace(/[[\]()]/g, '');
              
              if (selectorHint === interactionSelector || 
                  selectorHint.includes(interactionSelector) || 
                  interactionSelector.includes(normalizedSelectorHint) ||
                  normalizedSelectorHint === normalizedInteractionSelector) {
                if (expectation.type === 'navigation' && (interaction.type === 'link' || interaction.type === 'button')) {
                  matchingExpectations.push(expectation);
                } else if (expectation.type === 'form_submission' && interaction.type === 'form') {
                  matchingExpectations.push(expectation);
                }
              } else {
                if (expectation.type === 'navigation' && (interaction.type === 'link' || interaction.type === 'button')) {
                  selectorMismatch = true;
                } else if (expectation.type === 'form_submission' && interaction.type === 'form') {
                  selectorMismatch = true;
                }
              }
            } else if (!selectorHint && !interactionSelector) {
              if (expectation.type === 'navigation' && (interaction.type === 'link' || interaction.type === 'button')) {
                matchingExpectations.push(expectation);
              } else if (expectation.type === 'form_submission' && interaction.type === 'form') {
                matchingExpectations.push(expectation);
              }
            }
          }
        }
        
        if (matchingExpectations.length > 1) {
          multipleMatches = true;
        } else if (matchingExpectations.length === 1) {
          expectedTargetPath = matchingExpectations[0].targetPath;
          expectationType = matchingExpectations[0].type;
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
            type: 'silent_failure',
            interaction: {
              type: interaction.type,
              selector: interaction.selector,
              label: interaction.label
            },
            reason: 'Expected user-visible outcome did not occur',
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
  
  // Infer canonical run directory from tracesPath when available
  let runDir = null;
  try {
    runDir = dirname(tracesPath);
  } catch {
    // Ignore path parsing errors
  }

  const findingsResult = writeFindings(projectDir, observation.url, findings, [], runDir);
  
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
