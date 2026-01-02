/**
 * Journey Scan CLI Command
 * Entry point for running human journey scans from command line
 */

const fs = require('fs');
const path = require('path');
const { JourneyScanner } = require('./journey-scanner');
const { getJourneyDefinition } = require('./journey-definitions');
const { HumanReporter } = require('./human-reporter');

async function runJourneyScanCLI(config) {
  const {
    baseUrl,
    preset = 'saas',
    artifactsDir = './.odavlguardian',
    headless = true,
    timeout = 20000,
    presetProvided = false
  } = config;

  // Set a process timeout to ensure we don't hang forever
  const processTimeout = setTimeout(() => {
    throw new Error('Scan timeout: Process took too long (>120s)');
  }, 120000); // 120 second hard limit

  // Validate URL
  let url;
  try {
    url = new URL(baseUrl);
  } catch (_err) {
    clearTimeout(processTimeout);
    throw new Error(`Invalid URL: ${baseUrl}`);
  }

  console.log(`\n🛡️  ODAVL Guardian — Human Journey Scanner`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📍 Target URL:  ${baseUrl}`);
  console.log(`🎯 Preset:      ${presetProvided ? preset : '(auto)'}`);
  console.log(`📁 Output:      ${artifactsDir}\n`);
  process.stdout.write('');  // Flush stdout

  // Create output directory
  try {
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const screenshotDir = path.join(artifactsDir, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Detect site intent if preset not provided
    let finalPreset = preset;
    let intentDetection = null;
    if (!presetProvided) {
      const { detectIntent } = require('./intent-detector');
      console.log('🔎 Detecting site intent...');
      intentDetection = await detectIntent(baseUrl, { timeout, headless });
      console.log(`   Detected: ${intentDetection.intent.toUpperCase()} (confidence ${intentDetection.confidence}%)`);
      if (intentDetection.intent === 'saas') finalPreset = 'saas';
      else if (intentDetection.intent === 'shop') finalPreset = 'shop';
      else if (intentDetection.intent === 'landing') finalPreset = 'landing';
      else finalPreset = 'landing'; // default for unknown
    }

    // Get journey definition
    const journey = getJourneyDefinition(finalPreset);
    console.log(`🚀 Starting journey: ${journey.name}`);
    console.log(`   ${journey.description}\n`);
    process.stdout.write('');  // Flush stdout

    // Run scanner
    const scanner = new JourneyScanner({
      timeout,
      headless,
      screenshotDir
    });

    console.log('⏳ Executing journey steps...\n');
    process.stdout.write('');  // Flush stdout
    
    const result = await scanner.scan(baseUrl, journey);
    if (intentDetection) {
      result.intentDetection = intentDetection;
    }

    // Generate reports
    const reporter = new HumanReporter();
    const humanReport = reporter.generateSummary(result, artifactsDir);
    const jsonReport = reporter.generateJSON(result, artifactsDir);

    // Print summary to console
    console.log('\n' + humanReport.content);
    process.stdout.write('');  // Flush stdout

    // Determine canonical verdict and exit code
    const { toCanonicalJourneyVerdict, mapExitCodeFromCanonical } = require('./verdicts');
    const canonical = toCanonicalJourneyVerdict(result.finalDecision);
    const exitCode = mapExitCodeFromCanonical(canonical);

    // Save results metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      url: baseUrl,
      preset: finalPreset,
      decision: result.finalDecision,
      decisionCanonical: canonical,
      executedSteps: result.executedSteps.length,
      failedSteps: result.failedSteps.length
    };

    fs.writeFileSync(
      path.join(artifactsDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // Exit with canonical-mapped code

    console.log(`📁 Reports saved to: ${artifactsDir}`);
    console.log(`   - summary.txt (human readable)`);
    console.log(`   - summary.md (markdown)`);
    console.log(`   - report.json (full results)`);
    console.log(`   - screenshots/ (evidence images)`);
    process.stdout.write('');  // Flush stdout

    clearTimeout(processTimeout);
    return {
      exitCode,
      verdict: canonical,
      artifactsDir,
      result
    };
  } catch (err) {
    clearTimeout(processTimeout);
    throw err;
  }
}

module.exports = { runJourneyScanCLI };
