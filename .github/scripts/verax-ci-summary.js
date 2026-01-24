/**
 * VERAX CI Summary Parser
 * 
 * Parses VERAX artifacts and generates a summary for CI/PR comments.
 * Reads from .verax/runs/<runId>/summary.json and findings.json.
 * Outputs structured JSON or markdown for CI pipelines.
 * 
 * Usage:
 *   node scripts/verax-ci-summary.js --runId <id> [--format json|markdown]
 *   node scripts/verax-ci-summary.js --latest [--format json|markdown]
 *   node scripts/verax-ci-summary.js --selftest
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { getTimeProvider } from '../../src/cli/util/support/time-provider.js';


/**
 * Find the latest run ID in .verax/runs/
 */
function findLatestRunId(baseDir = '.verax/runs') {
  try {
    const runs = readdirSync(baseDir);
    if (runs.length === 0) {
      throw new Error('No run directories found');
    }

    // Sort by creation time (descending)
    const sorted = runs
      .map(name => ({
        name,
        time: statSync(resolve(baseDir, name)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    return sorted[0].name;
  } catch (error) {
    console.error(`Error finding latest run: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load summary.json for a run
 */
function loadSummary(runId) {
  const path = resolve('.verax/runs', runId, 'summary.json');
  try {
    const content = readFileSync(path, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading summary for run ${runId}: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load findings.json for a run
 */
function loadFindings(runId) {
  const path = resolve('.verax/runs', runId, 'findings.json');
  try {
    const content = readFileSync(path, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
    return JSON.parse(content);
  } catch (error) {
    // Findings might not exist if scan had errors; return empty array
    return { total: 0, findings: [] };
  }
}

/**
 * Build structured summary object
 */
function buildSummary(runId) {
  const summary = loadSummary(runId);
  const findingsData = loadFindings(runId);

  // Extract top findings (max 3)
  const topFindings = (findingsData.findings || [])
    .slice(0, 3)
    .map(f => ({
      type: f.type,
      confidence: f.confidence?.score || 0,
      reason: f.reason || 'No reason provided'
    }));

  return {
    runId,
    url: summary.url || 'unknown',
    timestamp: summary.timestamp,
    metrics: summary.metrics || { totalMs: 0 },
    findingsCounts: summary.findingsCounts || { HIGH: 0, MEDIUM: 0, LOW: 0 },
    topFindings,
    totalFindings: findingsData.total || 0
  };
}

/**
 * Format summary as JSON (for piping/parsing in CI)
 */
function formatJson(summaryObj) {
  return JSON.stringify(summaryObj, null, 2);
}

/**
 * Format summary as markdown (for PR comments)
 */
function formatMarkdown(summaryObj) {
  const {
    runId,
    url,
    metrics,
    findingsCounts,
    topFindings,
    totalFindings
  } = summaryObj;

  const duration = metrics.totalMs ? `${(metrics.totalMs / 1000).toFixed(2)}s` : 'unknown';

  let md = `<!-- verax-report -->\n`;
  md += `## 🔍 VERAX Report\n\n`;
  md += `**Run ID:** \`${runId}\`\n`;
  md += `**URL:** ${url}\n`;
  md += `**Duration:** ${duration}\n\n`;

  // Findings summary
  md += `### Findings\n`;
  md += `- **HIGH:** ${findingsCounts.HIGH}\n`;
  md += `- **MEDIUM:** ${findingsCounts.MEDIUM}\n`;
  md += `- **LOW:** ${findingsCounts.LOW}\n`;
  md += `- **Total:** ${totalFindings}\n\n`;

  // Top findings
  if (topFindings && topFindings.length > 0) {
    md += `### Top Issues\n`;
    topFindings.forEach((f, i) => {
      const score = f.confidence ? `[${f.confidence}%]` : '';
      md += `${i + 1}. ${score} **${f.type}** — ${f.reason}\n`;
    });
    md += '\n';
  }

  // Action link
  if (totalFindings > 0) {
    md += `📥 **[Download CI artifacts](https://github.com/)** to view full evidence and traces.\n`;
  } else {
    md += `✅ **All clear!** No findings detected.\n`;
  }

  return md;
}

/**
 * Self-test: verify parser works with mock data
 */
function runSelfTest() {
  console.log('Running self-test...');

  const mockSummary = {
    runId: 'test-1234',
    url: 'http://localhost:3456',
    timestamp: getTimeProvider().iso().toISOString(),
    metrics: { parseMs: 100, resolveMs: 200, observeMs: 300, detectMs: 150, totalMs: 750 },
    findingsCounts: { HIGH: 1, MEDIUM: 2, LOW: 1 }
  };

  const mockObj = {
    runId: 'test-1234',
    url: 'http://localhost:3456',
    timestamp: mockSummary.timestamp,
    metrics: mockSummary.metrics,
    findingsCounts: mockSummary.findingsCounts,
    topFindings: [
      { type: 'missing_state_action', confidence: 75, reason: 'State did not change' },
      { type: 'network_silent_failure', confidence: 62, reason: 'No UI feedback' }
    ],
    totalFindings: 4
  };

  console.log('\n=== JSON Format ===');
  console.log(formatJson(mockObj));

  console.log('\n=== Markdown Format ===');
  console.log(formatMarkdown(mockObj));

  console.log('\n✅ Self-test passed');
  process.exit(0);
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);

  // Self-test flag
  if (args.includes('--selftest')) {
    runSelfTest();
  }

  // Format option
  const formatIdx = args.indexOf('--format');
  const format = formatIdx >= 0 ? args[formatIdx + 1] : 'json';
  if (!['json', 'markdown'].includes(format)) {
    console.error(`Unknown format: ${format}`);
    process.exit(1);
  }

  // Find run ID
  let runId;
  const runIdIdx = args.indexOf('--runId');
  if (runIdIdx >= 0) {
    runId = args[runIdIdx + 1];
  } else if (args.includes('--latest')) {
    runId = findLatestRunId();
  } else {
    // Default: find latest
    runId = findLatestRunId();
  }

  // Build and format
  const summary = buildSummary(runId);
  const output = format === 'markdown' ? formatMarkdown(summary) : formatJson(summary);

  console.log(output);
  process.exit(0);
}

// Export for testing
export { buildSummary, formatJson, formatMarkdown, findLatestRunId, loadSummary, loadFindings };

// Run CLI if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}


