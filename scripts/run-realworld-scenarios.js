// ODAVL Guardian — Real-World Proof Execution Harness
// Stage 2: Guardian Runs (Truth Capture)
//
// Iterates all real-world scenarios and runs Guardian in reality mode.
// Captures verdict, confidence, errors, coverage, and artifact paths per scenario.

const fs = require('fs');
const path = require('path');
const { realWorldScenarios } = require('../src/guardian/realworld-scenarios');
const { spawnSync } = require('child_process');

const ARTIFACTS_ROOT = path.resolve(__dirname, '../artifacts/realworld');
if (!fs.existsSync(ARTIFACTS_ROOT)) fs.mkdirSync(ARTIFACTS_ROOT, { recursive: true });

function nowIso() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runGuardianForScenario(scenario) {
  const tag = `${scenario.scenarioId}-${nowIso()}`;
  const runDir = path.join(ARTIFACTS_ROOT, tag);
  fs.mkdirSync(runDir, { recursive: true });

  // Run Guardian in reality mode, passing scenarioId as tag
  // (Assume Guardian supports --scenario-id and --artifacts-dir for isolation)
  const args = [
    'bin/guardian.js',
    'reality',
    '--scenario-id', scenario.scenarioId,
    '--artifacts-dir', runDir,
    '--json',
    '--quiet'
  ];
  const proc = spawnSync('node', args, { encoding: 'utf-8' });

  // Write stdout/stderr for debugging
  fs.writeFileSync(path.join(runDir, 'stdout.txt'), proc.stdout || '');
  fs.writeFileSync(path.join(runDir, 'stderr.txt'), proc.stderr || '');

  // Find main evidence file (decision.json or summary.json)
  let evidencePath = path.join(runDir, 'decision.json');
  if (!fs.existsSync(evidencePath)) {
    evidencePath = path.join(runDir, 'summary.json');
  }
  if (!fs.existsSync(evidencePath)) {
    throw new Error(`No evidence file found for scenario ${scenario.scenarioId}`);
  }

  // Parse evidence
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));

  // Compose schema-compliant evidence.json
  // Enums and required fields per evidence.schema.json
  function pickEnum(val, allowed, fallback) {
    return allowed.includes(val) ? val : fallback;
  }
  const siteTypeEnum = ["saas", "ecommerce", "marketing", "content", "dashboard", "edge"];
  const verdictEnum = ["READY", "FRICTION", "DO_NOT_LAUNCH"];
  const confidenceEnum = ["HIGH", "MEDIUM", "LOW"];

  // Compose coverage object
  let coverage = evidence.coverage || {};
  // Ensure required fields for coverage
  coverage = {
    executed: typeof coverage.executed === 'number' ? coverage.executed : 0,
    total: typeof coverage.total === 'number' ? coverage.total : 0,
    skippedMissing: Array.isArray(coverage.skippedMissing) ? coverage.skippedMissing : [],
    skippedNotApplicable: Array.isArray(coverage.skippedNotApplicable) ? coverage.skippedNotApplicable : [],
    skippedDisabledByPreset: Array.isArray(coverage.skippedDisabledByPreset) ? coverage.skippedDisabledByPreset : [],
    skippedUserFiltered: Array.isArray(coverage.skippedUserFiltered) ? coverage.skippedUserFiltered : []
  };

  // Compose artifactPaths object
  const artifactPaths = {
    decision: fs.existsSync(path.join(runDir, 'decision.json')) ? path.join(runDir, 'decision.json') : null,
    summary: fs.existsSync(path.join(runDir, 'summary.json')) ? path.join(runDir, 'summary.json') : null,
    screenshots: fs.existsSync(path.join(runDir, 'screenshots')) ? path.join(runDir, 'screenshots') : null
  };

  // Compose limits (array of string)
  let limits = [];
  if (Array.isArray(evidence.limits)) {
    limits = evidence.limits.filter(x => typeof x === 'string');
  } else if (Array.isArray(evidence.testingLimits)) {
    limits = evidence.testingLimits.filter(x => typeof x === 'string');
  }

  // Compose errors (array of object)
  let errors = [];
  if (Array.isArray(evidence.errors)) {
    errors = evidence.errors.filter(x => typeof x === 'object' && x !== null);
  } else if (Array.isArray(evidence.failures)) {
    errors = evidence.failures.filter(x => typeof x === 'object' && x !== null);
  }

  // Compose topReasons (array of string)
  let topReasons = [];
  if (Array.isArray(evidence.topReasons)) {
    topReasons = evidence.topReasons.filter(x => typeof x === 'string');
  } else if (Array.isArray(evidence.reasons)) {
    topReasons = evidence.reasons.filter(x => typeof x === 'string');
  }

  const bundle = {
    scenarioId: String(scenario.scenarioId),
    siteType: pickEnum(scenario.siteType, siteTypeEnum, siteTypeEnum[0]),
    verdict: pickEnum(evidence.verdict || evidence.status, verdictEnum, verdictEnum[2]),
    confidence: pickEnum(evidence.confidence || evidence.confidenceLevel, confidenceEnum, confidenceEnum[2]),
    topReasons,
    errors,
    coverage,
    limits,
    artifactPaths,
    runDir: runDir
  };

  // Persist bundle
  fs.writeFileSync(path.join(runDir, 'evidence.json'), JSON.stringify(bundle, null, 2));
  return bundle;
}

function main() {
  console.log('Guardian Real-World Proof — Stage 2: Running all scenarios...');
  const results = [];
  for (const scenario of realWorldScenarios) {
    try {
      console.log(`\nRunning scenario: ${scenario.scenarioId}`);
      const bundle = runGuardianForScenario(scenario);
      console.log(`  Verdict:    ${bundle.verdict}`);
      console.log(`  Confidence: ${bundle.confidence}`);
      console.log(`  Artifacts:  ${bundle.runDir}`);
      results.push(bundle);
    } catch (err) {
      console.error(`  ERROR in scenario ${scenario.scenarioId}:`, err.message);
    }
  }
  // Write summary
  fs.writeFileSync(
    path.join(ARTIFACTS_ROOT, 'realworld-summary.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\nAll scenarios complete. Evidence bundles written.');
}

if (require.main === module) {
  main();
}
