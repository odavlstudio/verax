// ODAVL Guardian — Trust Closure Generator
// Stage 5: Trust Closure
//
// Reads evidence.json and narrative.json for each scenario, produces trust.json
// Aggregates global trust-summary.json

const fs = require('fs');
const path = require('path');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');

function trustLevelFromEvidence(evidence) {
  // Use confidence and verdict for trust level
  const conf = (evidence.confidence || '').toUpperCase();
  const verdict = (evidence.verdict || '').toUpperCase();
  if (conf === 'HIGH' && verdict === 'READY') return 'HIGH';
  if (conf === 'LOW' || verdict === 'DO_NOT_LAUNCH') return 'LOW';
  return 'MEDIUM';
}

function recommendedAction(trustLevel, verdict) {
  if (trustLevel === 'HIGH' && verdict === 'READY') return 'Proceed';
  if (trustLevel === 'LOW' || verdict === 'DO_NOT_LAUNCH') return 'Block';
  return 'Proceed with Caution';
}

function trustWhyFromEvidence(evidence, narrative) {
  // Only use string array, no objects, and only from evidence fields
  const why = [];
  if (Array.isArray(evidence.topReasons) && evidence.topReasons.length) {
    why.push(...evidence.topReasons.slice(0, 2));
  }
  if (!why.length && evidence.confidence) why.push(`Confidence: ${evidence.confidence}`);
  if (!why.length && evidence.verdict) why.push(`Verdict: ${evidence.verdict}`);
  if (!why.length) why.push('Evidence is thin; trust is limited.');
  return why;
}

function trustLimitsFromEvidence(evidence, narrative) {
  if (Array.isArray(evidence.limits) && evidence.limits.length) return evidence.limits;
  return ['No explicit limits recorded.'];
}

function perScenarioTrust(scenarioDir) {
  const evidencePath = path.join(scenarioDir, 'evidence.json');
  const narrativePath = path.join(scenarioDir, 'narrative.json');
  if (!fs.existsSync(evidencePath) || !fs.existsSync(narrativePath)) return null;
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
  const narrative = JSON.parse(fs.readFileSync(narrativePath, 'utf-8'));
  const trustLevel = trustLevelFromEvidence(evidence);
  const trustWhy = trustWhyFromEvidence(evidence, narrative);
  const trustLimits = trustLimitsFromEvidence(evidence, narrative);
  const action = recommendedAction(trustLevel, evidence.verdict);
  // Only include required fields, match types/enums
  const trust = {
    trustLevel,
    trustWhy: Array.isArray(trustWhy) ? trustWhy.map(String) : [],
    trustLimits: Array.isArray(trustLimits) ? trustLimits.map(String) : [],
    recommendedAction: action
  };
  fs.writeFileSync(path.join(scenarioDir, 'trust.json'), JSON.stringify(trust, null, 2));
  return trust;
}

function globalTrustSummary(scenarioDirs) {
  const allTrust = [];
  for (const dir of scenarioDirs) {
    const trustPath = path.join(dir, 'trust.json');
    if (fs.existsSync(trustPath)) {
      const trust = JSON.parse(fs.readFileSync(trustPath, 'utf-8'));
      allTrust.push(trust);
    }
  }
  // Distribution (required fields only)
  const dist = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const t of allTrust) {
    if (dist[t.trustLevel] !== undefined) dist[t.trustLevel]++;
  }
  // Common limits (array of string)
  const allLimits = allTrust.flatMap(t => Array.isArray(t.trustLimits) ? t.trustLimits : []);
  const limitCounts = {};
  for (const l of allLimits) {
    limitCounts[l] = (limitCounts[l] || 0) + 1;
  }
  const commonLimits = Object.entries(limitCounts)
    .filter(([_, count]) => count > 1)
    .map(([limit]) => limit);
  // Overall recommendation (enum)
  let overall;
  if (dist.LOW > 0) overall = 'Block';
  else if (dist.MEDIUM > 0) overall = 'Proceed with Caution';
  else overall = 'Proceed';
  const summary = {
    trustDistribution: dist,
    commonLimits,
    overallRecommendation: overall
  };
  fs.writeFileSync(path.join(ARTIFACTS_ROOT, 'trust-summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function main() {
  const dirs = fs.readdirSync(ARTIFACTS_ROOT)
    .map(d => path.join(ARTIFACTS_ROOT, d))
    .filter(d => fs.statSync(d).isDirectory());
  let count = 0;
  for (const dir of dirs) {
    if (perScenarioTrust(dir)) count++;
  }
  const summary = globalTrustSummary(dirs);
  console.log(`Trust closure complete for ${count} scenario(s).`);
  console.log('Global trust summary:', summary);
}

if (require.main === module) {
  main();
}
