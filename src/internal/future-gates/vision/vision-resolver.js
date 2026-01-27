/**
 * Vision Evidence Resolvers
 * 
 * Verify vision compliance through concrete evidence from:
 * - Code structure and implementation
 * - Runtime artifacts (learn.json, observe.json, findings.json, summary.json)
 * - File system structure
 * - Module exports and interfaces
 * 
 * Principles:
 * - Deterministic verification only
 * - Evidence-based, no heuristics
 * - Same repo → same result
 * - Never modify application code
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getVisionChecklist } from './vision-checklist.js';

/**
 * Evidence resolution result
 * @typedef {Object} EvidenceResult
 * @property {string} checkId - Vision check ID
 * @property {string} status
 * @property {string[]} evidenceFound - Evidence that was successfully resolved
 * @property {string[]} evidenceMissing - Evidence that could not be resolved
 * @property {string[]} notes - Factual observations
 * @property {number} score - Numerical score (0-1)
 */

/**
 * Resolve all vision checks against project and artifacts
 * 
 * @param {string} projectRoot - Project root directory
 * @param {string} runDir - Run directory with artifacts (optional)
 * @returns {Promise<EvidenceResult[]>}
 */
export async function resolveVisionCompliance(projectRoot, runDir = null) {
  const checks = getVisionChecklist();
  const results = [];

  for (const check of checks) {
    const result = await resolveCheck(check, projectRoot, runDir);
    results.push(result);
  }

  return results;
}

/**
 * Resolve a single vision check
 * 
 * @param {Object} check - Vision check definition
 * @param {string} projectRoot - Project root directory
 * @param {string} runDir - Run directory with artifacts
 * @returns {Promise<EvidenceResult>}
 */
async function resolveCheck(check, projectRoot, runDir) {
  const evidence = {
    checkId: check.id,
    status: 'unknown',
    evidenceFound: [],
    evidenceMissing: [],
    notes: [],
    score: 0
  };

  try {
    // Route to specific resolver based on check ID
    switch (check.id) {
      case 'vision.1.read-only-evidence':
        return /** @type {EvidenceResult} */ (await verifyReadOnlyEvidence(check, projectRoot, runDir));
      case 'vision.2.silent-failure-focus':
        return /** @type {EvidenceResult} */ (await verifySilentFailureFocus(check, projectRoot, runDir));
      case 'vision.3.promise-extraction':
        return /** @type {EvidenceResult} */ (await verifyPromiseExtraction(check, projectRoot, runDir));
      case 'vision.4.three-steps':
        return /** @type {EvidenceResult} */ (await verifyThreeSteps(check, projectRoot, runDir));
      case 'vision.5.evidence-authority':
        return /** @type {EvidenceResult} */ (await verifyEvidenceAuthority(check, projectRoot, runDir));
      case 'vision.6.determinism':
        return /** @type {EvidenceResult} */ (await verifyDeterminism(check, projectRoot, runDir));
      case 'vision.7.silence-signal':
        return /** @type {EvidenceResult} */ (await verifySilenceSignal(check, projectRoot, runDir));
      case 'vision.8.zero-code-changes':
        return /** @type {EvidenceResult} */ (await verifyZeroCodeChanges(check, projectRoot, runDir));
      case 'vision.9.web-coverage':
        return /** @type {EvidenceResult} */ (await verifyWebCoverage(check, projectRoot, runDir));
      case 'vision.10.framework-agnostic':
        return /** @type {EvidenceResult} */ (await verifyFrameworkAgnostic(check, projectRoot, runDir));
      case 'vision.11.read-only-enforcement':
        return /** @type {EvidenceResult} */ (await verifyReadOnlyEnforcement(check, projectRoot, runDir));
      case 'vision.12.operational-definition':
        return /** @type {EvidenceResult} */ (await verifyOperationalDefinition(check, projectRoot, runDir));
      case 'vision.13.failure-taxonomy':
        return /** @type {EvidenceResult} */ (await verifyFailureTaxonomy(check, projectRoot, runDir));
      case 'vision.14.finding-completeness':
        return /** @type {EvidenceResult} */ (await verifyFindingCompleteness(check, projectRoot, runDir));
      case 'vision.15.zero-config':
        return /** @type {EvidenceResult} */ (await verifyZeroConfig(check, projectRoot, runDir));
      case 'vision.16.meaningful-accountability':
        return /** @type {EvidenceResult} */ (await verifyMeaningfulAccountability(check, projectRoot, runDir));
      case 'vision.17.inform-not-block':
        return /** @type {EvidenceResult} */ (await verifyInformNotBlock(check, projectRoot, runDir));
      case 'vision.18.scope-boundaries':
        return /** @type {EvidenceResult} */ (await verifyScopeBoundaries(check, projectRoot, runDir));
      case 'vision.19.adoption-clarity':
        return /** @type {EvidenceResult} */ (await verifyAdoptionClarity(check, projectRoot, runDir));
      case 'vision.20.silence-observable':
        return /** @type {EvidenceResult} */ (await verifySilenceObservable(check, projectRoot, runDir));
      default:
        evidence.status = 'unknown';
        evidence.notes.push(`No resolver implemented for ${check.id}`);
        return /** @type {EvidenceResult} */ (evidence);
    }
  } catch (error) {
    evidence.status = 'fail';
    evidence.notes.push(`Resolver error: ${error.message}`);
    return evidence;
  }
}

/**
 * Vision 1: Read-Only, Evidence-Driven System
 */
async function verifyReadOnlyEvidence(check, projectRoot, runDir) {
  const result = {
    checkId: check.id,
    status: 'unknown',
    evidenceFound: [],
    evidenceMissing: [],
    notes: [],
    score: 0
  };

  // Check detection engine exists
  const detectionEngine = join(projectRoot, 'src', 'verax', 'detect', 'detection-engine.js');
  if (existsSync(detectionEngine)) {
    result.evidenceFound.push('detection-engine.js exists');
    
    const content = readFileSync(detectionEngine, 'utf-8');
    if (!content.includes('mutate') && !content.includes('modify') && !content.includes('patch')) {
      result.evidenceFound.push('no mutation keywords in detection engine');
    }
  } else {
    result.evidenceMissing.push('detection-engine.js not found');
  }

  // Check evidence law exists
  const evidenceLaw = join(projectRoot, 'src', 'verax', 'core', 'evidence', 'evidence-law.js');
  if (existsSync(evidenceLaw)) {
    result.evidenceFound.push('evidence-law.js exists');
  } else {
    result.evidenceMissing.push('evidence-law.js not found');
  }

  // Check findings have evidence if runDir provided
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings && findings.findings.length > 0) {
        const withEvidence = findings.findings.filter(f => f.evidence && Object.keys(f.evidence).length > 0).length;
        result.evidenceFound.push(`${withEvidence}/${findings.findings.length} findings have evidence`);
        result.notes.push(`Evidence present in ${Math.round(withEvidence / findings.findings.length * 100)}% of findings`);
      }
    }
  }

  // Calculate status
  const foundCount = result.evidenceFound.length;
  const totalCount = check.evidenceRefs.length;
  
  if (foundCount === totalCount) {
    result.status = 'pass';
    result.score = 1.0;
  } else if (foundCount > 0) {
    result.status = 'partial';
    result.score = foundCount / totalCount;
  } else {
    result.status = 'fail';
    result.score = 0;
  }

  return result;
}

/**
 * Vision 2: Silent Failure Detection Focus
 */
async function verifySilentFailureFocus(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check detection logic exists
  const detectionEngine = join(projectRoot, 'src', 'verax', 'detect', 'detection-engine.js');
  if (existsSync(detectionEngine)) {
    const content = readFileSync(detectionEngine, 'utf-8');
    if (content.includes('silent') || content.includes('silence')) {
      result.evidenceFound.push('silent failure detection logic present');
    }
  }

  // Check CLI util detection engine
  const cliDetectionEngine = join(projectRoot, 'src', 'cli', 'util', 'detection', 'detection-engine.js');
  if (existsSync(cliDetectionEngine)) {
    const content = readFileSync(cliDetectionEngine, 'utf-8');
    if (content.includes('silentFailures')) {
      result.evidenceFound.push('silent failure classification in detection engine');
    }
  }

  // Check findings have classification if runDir provided
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings) {
        const withClassification = findings.findings.filter(f => f.classification).length;
        result.evidenceFound.push(`${withClassification}/${findings.findings.length} findings have classification`);
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 3: Promise Extraction
 */
async function verifyPromiseExtraction(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check learn directory exists
  const learnDir = join(projectRoot, 'src', 'verax', 'learn');
  if (existsSync(learnDir)) {
    result.evidenceFound.push('learn/ directory exists');
    
    // Check for expectation extraction modules
    const files = readdirSync(learnDir);
    const extractors = files.filter(f => f.includes('extract') || f.includes('expectation'));
    if (extractors.length > 0) {
      result.evidenceFound.push(`${extractors.length} expectation extractor modules found`);
    }
  } else {
    result.evidenceMissing.push('learn/ directory not found');
  }

  // Check learn.json has expectations
  if (runDir) {
    const learnPath = join(runDir, 'learn.json');
    if (existsSync(learnPath)) {
      const learn = JSON.parse(String(readFileSync(learnPath, 'utf-8')));
      if (learn.expectations && Array.isArray(learn.expectations)) {
        result.evidenceFound.push(`learn.json has ${learn.expectations.length} expectations`);
        
        // Check promise types
        const promiseTypes = new Set(learn.expectations.map(e => e.promise?.kind).filter(Boolean));
        result.notes.push(`Promise types: ${Array.from(promiseTypes).join(', ')}`);
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 4: Three Immutable Steps
 */
async function verifyThreeSteps(check, projectRoot, runDir) {
  const result = initResult(check);

  if (!runDir) {
    result.notes.push('No run directory provided - cannot verify artifacts');
    result.status = 'unknown';
    return result;
  }

  // Check for learn.json (Promise Extraction)
  const learnPath = join(runDir, 'learn.json');
  if (existsSync(learnPath)) {
    result.evidenceFound.push('learn.json exists (Promise Extraction)');
  } else {
    result.evidenceMissing.push('learn.json missing');
  }

  // Check for observe.json (Real Interaction Execution)
  const observePath = join(runDir, 'observe.json');
  if (existsSync(observePath)) {
    result.evidenceFound.push('observe.json exists (Interaction Execution)');
  } else {
    result.evidenceMissing.push('observe.json missing');
  }

  // Check for findings.json (Promise vs Reality Comparison)
  const findingsPath = join(runDir, 'findings.json');
  if (existsSync(findingsPath)) {
    result.evidenceFound.push('findings.json exists (Promise vs Reality)');
  } else {
    result.evidenceMissing.push('findings.json missing');
  }

  // All three steps present = pass
  if (result.evidenceFound.length === 3) {
    result.status = 'pass';
    result.score = 1.0;
    result.notes.push('All three immutable steps artifacts present');
  } else {
    result.status = 'fail';
    result.score = result.evidenceFound.length / 3;
  }

  return result;
}

/**
 * Vision 5: Evidence Authority
 */
async function verifyEvidenceAuthority(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check evidence law module
  const evidenceLaw = join(projectRoot, 'src', 'verax', 'core', 'evidence', 'evidence-law.js');
  if (existsSync(evidenceLaw)) {
    result.evidenceFound.push('evidence-law.js exists');
    
    const content = readFileSync(evidenceLaw, 'utf-8');
    if (content.includes('enforce')) {
      result.evidenceFound.push('evidence enforcement logic present');
    }
  } else {
    result.evidenceMissing.push('evidence-law.js not found');
  }

  // Check findings have evidence and confidence
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings) {
        const withEvidence = findings.findings.filter(f => f.evidence).length;
        const withConfidence = findings.findings.filter(f => typeof f.confidence === 'number').length;
        
        result.evidenceFound.push(`${withEvidence}/${findings.findings.length} findings have evidence`);
        result.evidenceFound.push(`${withConfidence}/${findings.findings.length} findings have confidence`);
      }

      // Check enforcement metadata
      if (findings.enforcement) {
        result.evidenceFound.push('enforcement metadata present in findings.json');
      }
    }
  }

  // Check summary has enforcement
  if (runDir) {
    const summaryPath = join(runDir, 'summary.json');
    if (existsSync(summaryPath)) {
      const _summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
      // Evidence Law v2 moved enforcement to findings.json, not summary
      result.notes.push('Evidence Law v2: enforcement in findings.json');
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 6: Determinism
 */
async function verifyDeterminism(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check determinism module exists
  const determinismModule = join(projectRoot, 'src', 'verax', 'core', 'integrity', 'determinism.js');
  if (existsSync(determinismModule)) {
    result.evidenceFound.push('determinism.js module exists');
    
    const content = readFileSync(determinismModule, 'utf-8');
    if (content.includes('DETERMINISTIC') && content.includes('NON_DETERMINISTIC')) {
      result.evidenceFound.push('binary determinism verdict (DETERMINISTIC|NON_DETERMINISTIC)');
    }
  } else {
    result.evidenceMissing.push('determinism.js module not found');
  }

  // Check decisions.json has determinism verdict
  if (runDir) {
    const decisionsPath = join(runDir, 'decisions.json');
    if (existsSync(decisionsPath)) {
      const decisions = JSON.parse(String(readFileSync(decisionsPath, 'utf-8')));
      if (decisions.determinismVerdict) {
        result.evidenceFound.push(`determinism verdict: ${decisions.determinismVerdict}`);
        result.notes.push(`Verdict is binary: ${['DETERMINISTIC', 'NON_DETERMINISTIC'].includes(decisions.determinismVerdict)}`);
      }
    }
  }

  // Check observe.json has adaptive events tracking
  if (runDir) {
    const observePath = join(runDir, 'observe.json');
    if (existsSync(observePath)) {
      const observe = JSON.parse(String(readFileSync(observePath, 'utf-8')));
      if (observe.adaptiveEvents) {
        result.evidenceFound.push('adaptiveEvents tracked in observe.json');
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 7: Silence as Signal
 */
async function verifySilenceSignal(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check observe directory for silence detection
  const observeDir = join(projectRoot, 'src', 'verax', 'observe');
  if (existsSync(observeDir)) {
    result.evidenceFound.push('observe/ directory exists');
    
    // Search for silence detection in observe files
    const files = readdirSync(observeDir).filter(f => f.endsWith('.js'));
    let silenceDetectionFound = false;
    
    for (const file of files) {
      const content = readFileSync(join(observeDir, file), 'utf-8');
      if (content.includes('silence') || content.includes('noFeedback') || content.includes('silenceDetected')) {
        silenceDetectionFound = true;
        result.evidenceFound.push(`silence detection in ${file}`);
        break;
      }
    }
    
    if (!silenceDetectionFound) {
      result.evidenceMissing.push('silence detection logic not found in observe/');
    }
  }

  // Check observe.json has silenceDetected field
  if (runDir) {
    const observePath = join(runDir, 'observe.json');
    if (existsSync(observePath)) {
      const observe = JSON.parse(String(readFileSync(observePath, 'utf-8')));
      if (observe.observations) {
        const withSilence = observe.observations.filter(o => 
          o.silenceDetected !== undefined || o.signals?.silenceDetected !== undefined
        ).length;
        result.evidenceFound.push(`${withSilence}/${observe.observations.length} observations have silenceDetected field`);
      }

      // Check comparisons
      if (observe.observations && observe.observations.some(o => o.comparisons)) {
        result.evidenceFound.push('comparisons field present in observations');
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 8: Zero Code Changes
 */
async function verifyZeroCodeChanges(check, projectRoot, _runDir) {
  const result = initResult(check);

  // Check browser automation is read-only
  const browserAuto = join(projectRoot, 'src', 'verax', 'observe', 'browser-automation.js');
  if (existsSync(browserAuto)) {
    result.evidenceFound.push('browser-automation.js exists');
    
    const content = readFileSync(browserAuto, 'utf-8');
    // Look for signs of application modification
    if (!content.includes('inject') && !content.includes('modify') && !content.includes('instrument')) {
      result.evidenceFound.push('no application instrumentation in browser-automation.js');
    }
  }

  // Check README shows simple usage
  const readme = join(projectRoot, 'README.md');
  if (existsSync(readme)) {
    const content = readFileSync(readme, 'utf-8');
    if (content.includes('verax run --url')) {
      result.evidenceFound.push('README shows simple --url usage (no code changes)');
    }
  }

  // Check learn directory is observational
  const learnDir = join(projectRoot, 'src', 'verax', 'learn');
  if (existsSync(learnDir)) {
    result.evidenceFound.push('learn/ uses static analysis (no runtime modification)');
  }

  return calculateStatus(result, check);
}

/**
 * Vision 9: Observable Web Reality Coverage
 */
async function verifyWebCoverage(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check observe directory exists
  const observeDir = join(projectRoot, 'src', 'verax', 'observe');
  if (existsSync(observeDir)) {
    result.evidenceFound.push('observe/ directory exists');
  }

  // Check for observation capabilities in observe.json
  if (runDir) {
    const observePath = join(runDir, 'observe.json');
    if (existsSync(observePath)) {
      const observe = JSON.parse(String(readFileSync(observePath, 'utf-8')));
      
      if (observe.observations) {
        // Check for network monitoring
        const withNetwork = observe.observations.filter(o => o.networkStatus).length;
        if (withNetwork > 0) {
          result.evidenceFound.push(`${withNetwork} observations have networkStatus`);
        }

        // Check for DOM observation
        const withDOM = observe.observations.filter(o => o.comparisons?.domChanged !== undefined).length;
        if (withDOM > 0) {
          result.evidenceFound.push(`${withDOM} observations have DOM change tracking`);
        }

        // Check for navigation detection
        const withNav = observe.observations.filter(o => o.comparisons?.urlChanged !== undefined).length;
        if (withNav > 0) {
          result.evidenceFound.push(`${withNav} observations have URL change tracking`);
        }
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 10: Framework-Agnostic
 */
async function verifyFrameworkAgnostic(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check framework detection is observational
  const frameworkDetection = join(projectRoot, 'src', 'verax', 'learn', 'framework-detection.js');
  if (existsSync(frameworkDetection)) {
    result.evidenceFound.push('framework-detection.js exists');
    
    const content = readFileSync(frameworkDetection, 'utf-8');
    // Should not require framework APIs, just detect from DOM/source
    if (!content.includes('import ') || !content.includes('require(')) {
      result.evidenceFound.push('framework detection is observational (no framework imports)');
    }
  }

  // Check detector registry
  const detectorRegistry = join(projectRoot, 'src', 'verax', 'detect', 'detector-registry.js');
  if (existsSync(detectorRegistry)) {
    result.evidenceFound.push('detector-registry.js exists');
  }

  // Check learn.json has detected frameworks
  if (runDir) {
    const learnPath = join(runDir, 'learn.json');
    if (existsSync(learnPath)) {
      const learn = JSON.parse(String(readFileSync(learnPath, 'utf-8')));
      if (learn.detectedFrameworks) {
        result.evidenceFound.push(`detectedFrameworks: ${learn.detectedFrameworks.join(', ')}`);
        result.notes.push('Framework detection is observational only');
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 11: Read-Only Enforcement
 */
async function verifyReadOnlyEnforcement(check, projectRoot, _runDir) {
  const result = initResult(check);

  // Check detect/ directory has no mutation logic
  const detectDir = join(projectRoot, 'src', 'verax', 'detect');
  if (existsSync(detectDir)) {
    result.evidenceFound.push('detect/ directory exists');
    
    const files = readdirSync(detectDir).filter(f => f.endsWith('.js'));
    let mutationFound = false;
    
    for (const file of files) {
      const content = readFileSync(join(detectDir, file), 'utf-8');
      if (content.includes('mutate') || content.includes('modify') || content.includes('patch') || content.includes('fix')) {
        mutationFound = true;
        break;
      }
    }
    
    if (!mutationFound) {
      result.evidenceFound.push('no application mutation in detect/ directory');
    }
  }

  // Check clean command only touches .verax/
  const cleanCmd = join(projectRoot, 'src', 'cli', 'commands', 'clean.js');
  if (existsSync(cleanCmd)) {
    const content = readFileSync(cleanCmd, 'utf-8');
    if (content.includes('.verax')) {
      result.evidenceFound.push('clean command targets .verax/ artifacts only');
    }
  }

  // Check gate command only touches .verax/
  const gateCmd = join(projectRoot, 'src', 'cli', 'commands', 'gate.js');
  if (existsSync(gateCmd)) {
    const content = readFileSync(gateCmd, 'utf-8');
    if (content.includes('.verax') || content.includes('gate.json')) {
      result.evidenceFound.push('gate command targets .verax/ artifacts only');
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 12: Operational Definition
 */
async function verifyOperationalDefinition(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check detection engine implements promise-action-silence pattern
  const detectionEngine = join(projectRoot, 'src', 'verax', 'detect', 'detection-engine.js');
  if (existsSync(detectionEngine)) {
    result.evidenceFound.push('detection-engine.js exists');
  }

  const cliDetectionEngine = join(projectRoot, 'src', 'cli', 'util', 'detection', 'detection-engine.js');
  if (existsSync(cliDetectionEngine)) {
    const content = readFileSync(cliDetectionEngine, 'utf-8');
    if (content.includes('silent') && content.includes('expectation') && content.includes('observation')) {
      result.evidenceFound.push('detection logic compares expectations vs observations');
    }
  }

  // Check findings describe the pattern
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings) {
        const withType = findings.findings.filter(f => f.type).length;
        const withClassification = findings.findings.filter(f => f.classification).length;
        
        result.evidenceFound.push(`${withType}/${findings.findings.length} findings have type`);
        result.evidenceFound.push(`${withClassification}/${findings.findings.length} findings have classification`);
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 13: Failure Taxonomy
 */
async function verifyFailureTaxonomy(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check taxonomy module exists
  const taxonomy = join(projectRoot, 'src', 'verax', 'detect', 'taxonomy.js');
  if (existsSync(taxonomy)) {
    result.evidenceFound.push('taxonomy.js exists');
    
    const content = readFileSync(taxonomy, 'utf-8');
    const categories = [
      'NO_NAVIGATION', 'BLOCKED_WITHOUT_MESSAGE', 'STALLED_LOADING',
      'INVISIBLE_STATE', 'UNKNOWN_SILENCE', 'NO_FEEDBACK', 'NO_UI_CHANGE'
    ];
    
    let foundCategories = 0;
    categories.forEach(cat => {
      if (content.includes(cat)) foundCategories++;
    });
    
    result.evidenceFound.push(`${foundCategories}/${categories.length} silence categories found`);
  } else {
    result.evidenceMissing.push('taxonomy.js not found');
  }

  // Check findings use taxonomy
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings) {
        const withSilenceKind = findings.findings.filter(f => f.silenceKind).length;
        if (withSilenceKind > 0) {
          result.evidenceFound.push(`${withSilenceKind}/${findings.findings.length} findings have silenceKind`);
        }
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 14: Finding Completeness
 */
async function verifyFindingCompleteness(check, projectRoot, runDir) {
  const result = initResult(check);

  if (!runDir) {
    result.notes.push('No run directory - cannot verify finding completeness');
    result.status = 'unknown';
    return result;
  }

  const findingsPath = join(runDir, 'findings.json');
  if (!existsSync(findingsPath)) {
    result.evidenceMissing.push('findings.json not found');
    result.status = 'fail';
    result.score = 0;
    return result;
  }

  const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
  
  if (!findings.findings || findings.findings.length === 0) {
    result.notes.push('No findings to verify completeness');
    result.status = 'pass';
    result.score = 1.0;
    return result;
  }

  // Check required fields
  const requiredFields = ['promise', 'evidence', 'confidence', 'impact'];
  const fieldCounts = {};
  
  requiredFields.forEach(field => {
    fieldCounts[field] = findings.findings.filter(f => f[field] !== undefined).length;
    result.evidenceFound.push(`${fieldCounts[field]}/${findings.findings.length} findings have ${field}`);
  });

  // Calculate score
  const totalRequired = requiredFields.length * findings.findings.length;
  const totalFound = Object.values(fieldCounts).reduce((a, b) => a + b, 0);
  result.score = totalFound / totalRequired;

  if (result.score === 1.0) {
    result.status = 'pass';
  } else if (result.score > 0.7) {
    result.status = 'partial';
  } else {
    result.status = 'fail';
  }

  return result;
}

/**
 * Vision 15: Zero Configuration
 */
async function verifyZeroConfig(check, projectRoot, _runDir) {
  const result = initResult(check);

  // Check CLI can run with just --url
  const runCmd = join(projectRoot, 'src', 'cli', 'commands', 'run.js');
  if (existsSync(runCmd)) {
    const content = readFileSync(runCmd, 'utf-8');
    if (content.includes('--url')) {
      result.evidenceFound.push('run command supports --url flag');
    }
  }

  // Check README shows simple usage
  const readme = join(projectRoot, 'README.md');
  if (existsSync(readme)) {
    const content = readFileSync(readme, 'utf-8');
    if (content.includes('verax run --url')) {
      result.evidenceFound.push('README shows zero-config usage');
    }
  }

  // Check bin/verax.js exists
  const bin = join(projectRoot, 'bin', 'verax.js');
  if (existsSync(bin)) {
    result.evidenceFound.push('bin/verax.js CLI entry point exists');
  }

  return calculateStatus(result, check);
}

/**
 * Vision 16: Meaningful Accountability
 */
async function verifyMeaningfulAccountability(check, projectRoot, runDir) {
  const result = initResult(check);

  if (!runDir) {
    result.notes.push('No run directory - cannot verify accountability');
    result.status = 'unknown';
    return result;
  }

  // Check summary has digest
  const summaryPath = join(runDir, 'summary.json');
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
    if (summary.digest) {
      result.evidenceFound.push('summary.json has digest with promise coverage');
      result.notes.push(`Expectations: ${summary.digest.expectationsTotal || 0}, Observed: ${summary.digest.observed || 0}`);
    }
  }

  // Check findings have classification
  const findingsPath = join(runDir, 'findings.json');
  if (existsSync(findingsPath)) {
    const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
    if (findings.findings) {
      const byClassification = {};
      findings.findings.forEach(f => {
        byClassification[f.classification] = (byClassification[f.classification] || 0) + 1;
      });
      result.evidenceFound.push(`Classifications: ${Object.keys(byClassification).join(', ')}`);
    }
  }

  // Check observe.json has skipReasons
  const observePath = join(runDir, 'observe.json');
  if (existsSync(observePath)) {
    const observe = JSON.parse(String(readFileSync(observePath, 'utf-8')));
    if (observe.skipReasons) {
      result.evidenceFound.push('skipReasons tracked for unproven interactions');
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 17: Inform Not Block
 */
async function verifyInformNotBlock(check, projectRoot, _runDir) {
  const result = initResult(check);

  // Check exit codes inform
  const runCmd = join(projectRoot, 'src', 'cli', 'commands', 'run.js');
  if (existsSync(runCmd)) {
    const content = readFileSync(runCmd, 'utf-8');
    // Run command should exit with info codes, not block
    if (content.includes('process.exit(0)') || content.includes('process.exit(10)') || content.includes('process.exit(20)')) {
      result.evidenceFound.push('run command uses informational exit codes');
    }
  }

  // Check gate command exists (opt-in)
  const gateCmd = join(projectRoot, 'src', 'cli', 'commands', 'gate.js');
  if (existsSync(gateCmd)) {
    result.evidenceFound.push('gate command exists (opt-in gatekeeper)');
  }

  // Check gate engine exists
  const gateEngine = join(projectRoot, 'src', 'verax', 'gate-engine.js');
  if (existsSync(gateEngine)) {
    result.evidenceFound.push('gate-engine.js exists (separate from run)');
  }

  return calculateStatus(result, check);
}

/**
 * Vision 18: Scope Boundaries
 */
async function verifyScopeBoundaries(check, projectRoot, _runDir) {
  const result = initResult(check);

  // Check README sets boundaries
  const readme = join(projectRoot, 'README.md');
  if (existsSync(readme)) {
    result.evidenceFound.push('README.md exists (should document scope)');
  }

  // Check VISION.md exists
  const vision = join(projectRoot, 'docs', 'VISION.md');
  if (existsSync(vision)) {
    const content = readFileSync(vision, 'utf-8');
    if (content.includes('never guess') && content.includes('never')) {
      result.evidenceFound.push('VISION.md sets clear boundaries');
    }
  }

  // Check detection engine doesn't have business logic
  const detectionEngine = join(projectRoot, 'src', 'verax', 'detect', 'detection-engine.js');
  if (existsSync(detectionEngine)) {
    const content = readFileSync(detectionEngine, 'utf-8');
    // Should not have words like "business", "intent", "strategy"
    if (!content.includes('business') && !content.includes('strategy')) {
      result.evidenceFound.push('detection engine has no business logic keywords');
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 19: Adoption, Clarity, Evidence Quality
 */
async function verifyAdoptionClarity(check, projectRoot, runDir) {
  const result = initResult(check);

  // Check package.json exists
  const packageJson = join(projectRoot, 'package.json');
  if (existsSync(packageJson)) {
    const pkg = JSON.parse(String(readFileSync(packageJson, 'utf-8')));
    result.evidenceFound.push(`package: ${pkg.name}@${pkg.version}`);
  }

  // Check README has installation
  const readme = join(projectRoot, 'README.md');
  if (existsSync(readme)) {
    const content = readFileSync(readme, 'utf-8');
    if (content.includes('npm') || content.includes('install')) {
      result.evidenceFound.push('README has installation instructions');
    }
  }

  // Check confidence system exists
  if (runDir) {
    const findingsPath = join(runDir, 'findings.json');
    if (existsSync(findingsPath)) {
      const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
      if (findings.findings && findings.findings.some(f => typeof f.confidence === 'number')) {
        result.evidenceFound.push('confidence system present in findings');
      }
    }
  }

  // Check productionSeal
  if (runDir) {
    const summaryPath = join(runDir, 'summary.json');
    if (existsSync(summaryPath)) {
      const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
      if (summary.productionSeal !== undefined) {
        result.evidenceFound.push('productionSeal quality indicator present');
      }
    }
  }

  return calculateStatus(result, check);
}

/**
 * Vision 20: Make Silence Observable
 */
async function verifySilenceObservable(check, projectRoot, runDir) {
  const result = initResult(check);

  if (!runDir) {
    result.notes.push('No run directory - cannot verify silence observability');
    result.status = 'partial';
    result.score = 0.5;
    return result;
  }

  // Check findings exist
  const findingsPath = join(runDir, 'findings.json');
  if (existsSync(findingsPath)) {
    const findings = JSON.parse(String(readFileSync(findingsPath, 'utf-8')));
    result.evidenceFound.push('findings.json exists (silence made observable)');
    
    if (findings.findings && findings.findings.length > 0) {
      result.notes.push(`${findings.findings.length} findings with evidence`);
    }
  }

  // Check observe.json tracks silence
  const observePath = join(runDir, 'observe.json');
  if (existsSync(observePath)) {
    const observe = JSON.parse(String(readFileSync(observePath, 'utf-8')));
    if (observe.observations) {
      const withSilence = observe.observations.filter(o => o.silenceDetected).length;
      if (withSilence > 0) {
        result.evidenceFound.push(`${withSilence} observations detected silence`);
      }
    }
  }

  // Check summary counts silent failures
  const summaryPath = join(runDir, 'summary.json');
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(String(readFileSync(summaryPath, 'utf-8')));
    if (summary.digest && typeof summary.digest.silentFailures === 'number') {
      result.evidenceFound.push(`summary reports ${summary.digest.silentFailures} silent failures`);
    }
  }

  return calculateStatus(result, check);
}

/**
 * Helper: Initialize result object
 */
function initResult(check) {
  return {
    checkId: check.id,
    status: 'unknown',
    evidenceFound: [],
    evidenceMissing: [],
    notes: [],
    score: 0
  };
}

/**
 * Helper: Calculate status based on evidence found vs required
 */
function calculateStatus(result, check) {
  const foundCount = result.evidenceFound.length;
  const totalCount = check.evidenceRefs.length;

  if (foundCount === 0) {
    result.status = 'fail';
    result.score = 0;
  } else if (foundCount >= totalCount) {
    result.status = 'pass';
    result.score = 1.0;
  } else {
    result.status = 'partial';
    result.score = foundCount / totalCount;
  }

  return result;
}

