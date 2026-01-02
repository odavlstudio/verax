// ODAVL Guardian — Real-World Proof Narrative Generator
// Stage 3: Proof Narratives
//
// Reads evidence.json for each scenario and produces a narrative.json

const fs = require('fs');
const path = require('path');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');

function safeReadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function narrativeForEvidence(evidence, scenarioMeta) {
  // Strictly map only the fields present in the frozen evidence schema
  // Narrative will be a direct, human-readable summary of the evidence fields
  const summary = [];
  summary.push(`Scenario: ${evidence.scenarioId || scenarioMeta.scenarioId || 'unknown'}`);
  summary.push(`Site type: ${evidence.siteType || scenarioMeta.siteType || 'unknown'}`);
  summary.push(`Verdict: ${evidence.verdict || 'UNKNOWN'}`);
  summary.push(`Confidence: ${evidence.confidence || 'UNKNOWN'}`);
  if (Array.isArray(evidence.topReasons) && evidence.topReasons.length) {
    summary.push('Top reasons:');
    evidence.topReasons.forEach(r => summary.push(`- ${r}`));
  }
  if (Array.isArray(evidence.errors) && evidence.errors.length) {
    summary.push('Errors:');
    evidence.errors.forEach(e => summary.push(`- ${e.message || e.error || JSON.stringify(e)}`));
  }
  if (evidence.coverage && typeof evidence.coverage.executed === 'number' && typeof evidence.coverage.total === 'number') {
    summary.push(`Coverage: ${evidence.coverage.executed}/${evidence.coverage.total} attempts executed`);
    if (Array.isArray(evidence.coverage.skippedMissing) && evidence.coverage.skippedMissing.length) {
      summary.push(`Skipped missing: ${evidence.coverage.skippedMissing.join(', ')}`);
    }
    if (Array.isArray(evidence.coverage.skippedNotApplicable) && evidence.coverage.skippedNotApplicable.length) {
      summary.push(`Skipped not applicable: ${evidence.coverage.skippedNotApplicable.join(', ')}`);
    }
    if (Array.isArray(evidence.coverage.skippedDisabledByPreset) && evidence.coverage.skippedDisabledByPreset.length) {
      summary.push(`Skipped disabled by preset: ${evidence.coverage.skippedDisabledByPreset.join(', ')}`);
    }
    if (Array.isArray(evidence.coverage.skippedUserFiltered) && evidence.coverage.skippedUserFiltered.length) {
      summary.push(`Skipped user filtered: ${evidence.coverage.skippedUserFiltered.join(', ')}`);
    }
  }
  if (Array.isArray(evidence.limits) && evidence.limits.length) {
    summary.push('Limits:');
    evidence.limits.forEach(l => summary.push(`- ${l}`));
  }
  if (evidence.artifactPaths && typeof evidence.artifactPaths === 'object') {
    summary.push('Artifact paths:');
    Object.entries(evidence.artifactPaths).forEach(([k, v]) => summary.push(`- ${k}: ${v}`));
  }
  summary.push(`Run directory: ${evidence.runDir || 'unknown'}`);

  // Output as a single narrative string and a structured object for downstream use
  return {
    scenarioId: evidence.scenarioId || scenarioMeta.scenarioId || 'unknown',
    siteType: evidence.siteType || scenarioMeta.siteType || 'unknown',
    verdict: evidence.verdict || 'UNKNOWN',
    confidence: evidence.confidence || 'UNKNOWN',
    topReasons: Array.isArray(evidence.topReasons) ? evidence.topReasons.slice() : [],
    errors: Array.isArray(evidence.errors) ? evidence.errors.slice() : [],
    coverage: evidence.coverage || {},
    limits: Array.isArray(evidence.limits) ? evidence.limits.slice() : [],
    artifactPaths: evidence.artifactPaths || {},
    runDir: evidence.runDir || 'unknown',
    summary: summary.join('\n')
  };
}

function main() {
  // Load scenario meta
  const { realWorldScenarios } = require('../src/guardian/realworld-scenarios');
  const dirs = fs.readdirSync(ARTIFACTS_ROOT).filter(d => d && fs.statSync(path.join(ARTIFACTS_ROOT, d)).isDirectory());
  let count = 0;
  for (const dir of dirs) {
    const evidencePath = path.join(ARTIFACTS_ROOT, dir, 'evidence.json');
    if (!fs.existsSync(evidencePath)) continue;
    const evidence = safeReadJSON(evidencePath);
    if (!evidence) continue;
    // Find scenario meta
    const scenarioMeta = realWorldScenarios.find(s => dir.startsWith(s.scenarioId));
    if (!scenarioMeta) continue;
    const narrative = narrativeForEvidence(evidence, scenarioMeta);
    fs.writeFileSync(path.join(ARTIFACTS_ROOT, dir, 'narrative.json'), JSON.stringify(narrative, null, 2));
    count++;
  }
  console.log(`Generated narratives for ${count} scenario(s).`);
}

if (require.main === module) {
  main();
}
