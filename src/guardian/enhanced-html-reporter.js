/**
 * Enhanced HTML Reporter
 * 
 * Generate interactive HTML reports with:
 * - Top Risks section
 * - Discovery results
 * - Diff view
 * - Evidence gallery
 * 
 * Vanilla HTML + CSS + minimal JS. Works offline.
 */

const fs = require('fs');
const path = require('path');
const { analyzePatterns, loadRecentRunsForSite } = require('./pattern-analyzer');
const {
  formatVerdictStatus,
  formatConfidence,
  formatVerdictWhy,
  formatKeyFindings,
  formatLimits,
  formatConfidenceMicroLine,
  formatFirstRunNote,
  formatJourneyMessage,
  formatNextRunHint,
  formatPatternSummary,
  formatPatternWhy,
  formatPatternFocus,
  formatPatternLimits,
  formatConfidenceDrivers,
  formatFocusSummary,
  formatDeltaInsight,
  // Stage V / Step 5.2: Silence Discipline helpers
  shouldRenderFocusSummary,
  shouldRenderDeltaInsight,
  shouldRenderPatterns,
  shouldRenderConfidenceDrivers,
  shouldRenderJourneyMessage,
  shouldRenderNextRunHint,
  shouldRenderFirstRunNote
} = require('./text-formatters');

/**
 * Generate enhanced HTML report
 */
function generateEnhancedHtml(snapshot, outputDir, options = {}) {
  if (!snapshot) {
    return '<html><body><h1>No snapshot data</h1></body></html>';
  }

  const meta = snapshot.meta || {};
  const marketImpact = snapshot.marketImpactSummary || {};
  const counts = marketImpact.countsBySeverity || { CRITICAL: 0, WARNING: 0, INFO: 0 };
  const topRisks = marketImpact.topRisks || [];
  const attempts = snapshot.attempts || [];
  const discovery = snapshot.discovery || {};
  const baseline = snapshot.baseline || {};

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Report - ${meta.url || 'Unknown'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; margin-bottom: 10px; font-size: 32px; }
    h2 { color: #34495e; margin-top: 30px; margin-bottom: 15px; font-size: 24px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h3 { color: #7f8c8d; margin-top: 20px; margin-bottom: 10px; font-size: 18px; }
    .meta { color: #7f8c8d; margin-bottom: 30px; }
    .meta span { display: inline-block; margin-right: 20px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
      .verdict-card { background: #ffffff; border: 2px solid #3498db; padding: 16px; border-radius: 8px; margin: 20px 0; }
      .verdict-title { font-weight: 600; font-size: 18px; color: #2c3e50; margin-bottom: 8px; }
      .verdict-item { margin: 4px 0; }
      .bullets { margin-top: 8px; padding-left: 18px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card.critical { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .stat-card.warning { background: linear-gradient(135deg, #fad961 0%, #f76b1c 100%); }
    .stat-card.info { background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%); color: #333; }
    .stat-number { font-size: 48px; font-weight: bold; margin-bottom: 10px; }
    .stat-label { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
    .pattern-item { background: #f9f9f9; border-left: 4px solid #9b59b6; padding: 15px; margin-bottom: 15px; border-radius: 4px; }
    .pattern-item.high { border-left-color: #e74c3c; }
    .pattern-item.medium { border-left-color: #f39c12; }
    .pattern-item.low { border-left-color: #95a5a6; }
    .pattern-summary { font-weight: 600; margin-bottom: 8px; }
    .pattern-why { color: #7f8c8d; font-size: 14px; margin-bottom: 8px; }
    .pattern-limits { color: #95a5a6; font-size: 13px; font-style: italic; }
    .pattern-focus { color: #2c3e50; font-size: 14px; margin-bottom: 6px; }
    .risk-item { background: #fff; border-left: 4px solid #e74c3c; padding: 15px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .risk-item.warning { border-left-color: #f39c12; }
    .risk-item.info { border-left-color: #3498db; }
    .risk-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .risk-title { font-weight: bold; font-size: 16px; }
    .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .risk-badge.critical { background: #e74c3c; color: white; }
    .risk-badge.warning { background: #f39c12; color: white; }
    .risk-badge.info { background: #3498db; color: white; }
    .risk-details { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
    .attempt-list { list-style: none; }
    .attempt-item { background: #ecf0f1; padding: 10px 15px; margin-bottom: 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
    .attempt-name { font-weight: 500; }
    .attempt-outcome { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .attempt-outcome.success { background: #2ecc71; color: white; }
    .attempt-outcome.failure { background: #e74c3c; color: white; }
    .discovery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
    .discovery-card { background: #ecf0f1; padding: 15px; border-radius: 4px; }
    .discovery-stat { font-size: 24px; font-weight: bold; color: #3498db; margin-bottom: 5px; }
    .discovery-label { font-size: 14px; color: #7f8c8d; }
    .diff-section { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin-bottom: 15px; }
    .diff-item { margin: 10px 0; padding-left: 20px; }
    .diff-item.added { border-left: 3px solid #2ecc71; color: #27ae60; }
    .diff-item.removed { border-left: 3px solid #e74c3c; color: #c0392b; }
    .diff-item.changed { border-left: 3px solid #f39c12; color: #d68910; }
    .evidence-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .evidence-card { background: white; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
    .evidence-img { width: 100%; height: 200px; object-fit: cover; background: #f8f9fa; cursor: pointer; }
    .evidence-caption { padding: 10px; font-size: 14px; color: #7f8c8d; }
    .no-data { text-align: center; color: #95a5a6; padding: 40px; font-style: italic; }
    footer { margin-top: 40px; text-align: center; color: #95a5a6; font-size: 14px; border-top: 1px solid #ecf0f1; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ Guardian Reality Report</h1>
    <div class="meta">
      <span><strong>URL:</strong> ${meta.url || 'Unknown'}</span>
      <span><strong>Run ID:</strong> ${meta.runId || 'Unknown'}</span>
      <span><strong>Date:</strong> ${meta.createdAt || 'Unknown'}</span>
    </div>

    <!-- Verdict & Confidence -->
    <div class="verdict-card">
      <div class="verdict-title">Verdict & Confidence</div>
      ${(() => {
        const v = snapshot.verdict || meta.verdict || null;
        if (!v) return '<div class="verdict-item">No verdict available</div>';
        // First-run context detection
        let firstRunLine = '';
        let journeyLineHtml = '';
        let priorRuns = 0; // Declare in outer scope for use in drivers logic
        try {
          const artifactsDir = options.artifactsDir;
          const siteSlug = options.siteSlug || (meta.siteSlug);
          if (artifactsDir && siteSlug) {
            const runs = loadRecentRunsForSite(artifactsDir, siteSlug, 10);
            priorRuns = runs.length;
          }
          const runIndex = priorRuns;
          if (shouldRenderFirstRunNote(runIndex)) {
            firstRunLine = `<div class=\"verdict-item\"><em>${formatFirstRunNote()}</em></div>`;
          }
          // Confidence interpretation micro-line (Stage IV)
          const cfLevel = (v.confidence || {}).level;
          const showMicro = ((cfLevel && cfLevel !== 'high') || runIndex < 2);
          var confidenceLineHtml = showMicro ? `<div class=\"verdict-item\">${formatConfidenceMicroLine()}</div>` : '';

          // Three-Runs Journey Messaging (Stage IV)
          try {
            if (artifactsDir && siteSlug) {
              const patterns = analyzePatterns(artifactsDir, siteSlug, 10) || [];
              const patternsPresent = patterns.length > 0;
              if (!patternsPresent) {
                if (shouldRenderJourneyMessage(runIndex)) {
                  const journeyMsg = formatJourneyMessage(runIndex);
                  if (journeyMsg) {
                    journeyLineHtml = `<div class=\"verdict-item\">${journeyMsg}</div>`;
                  }
                }
              }
            }
          } catch (_) {}
        } catch (_) {}
        const vStatus = formatVerdictStatus(v);
        const vConf = formatConfidence(v);
        const vWhy = formatVerdictWhy(v);
        const vFindings = formatKeyFindings(v);
        const vLimits = formatLimits(v);
        const vNextHint = formatNextRunHint(v);

        // Confidence Drivers Card (Layer 4 / Step 4.2)
        // Stage V / Step 5.2: Use centralized suppression helper
        let vDrivers = [];
        if (shouldRenderConfidenceDrivers(v, priorRuns)) {
          vDrivers = formatConfidenceDrivers(v);
        }

        // Focus Summary (Layer 5 - Advisor Mode)
        // Stage V / Step 5.2: Use centralized suppression helper
        let vFocus = [];
        try {
          const patterns = options.artifactsDir && options.siteSlug 
            ? analyzePatterns(options.artifactsDir, options.siteSlug, 10) 
            : [];
          if (shouldRenderFocusSummary(v, patterns)) {
            vFocus = formatFocusSummary(v, patterns);
          }
        } catch (_) {}

        // Delta Insight (Stage V / Step 5.1)
        let deltaImproved = [];
        let deltaRegressed = [];
        try {
          if (options.artifactsDir && options.siteSlug) {
            const runs = loadRecentRunsForSite(options.artifactsDir, options.siteSlug, 10);
            if (runs.length >= 2) {
              const previousRun = runs[1];
              let previousVerdict = null;
              let previousPatterns = [];
              
              if (previousRun.snapshotPath) {
                try {
                  const prevSnap = JSON.parse(fs.readFileSync(previousRun.snapshotPath, 'utf8'));
                  previousVerdict = prevSnap.verdict || prevSnap.meta?.verdict || null;
                } catch (_) {}
              }
              
              try {
                previousPatterns = analyzePatterns(options.artifactsDir, options.siteSlug, 10, previousRun.runId) || [];
              } catch (_) {}
              
              const detectedPatterns = options.artifactsDir && options.siteSlug 
                ? analyzePatterns(options.artifactsDir, options.siteSlug, 10) 
                : [];
              
              const delta = formatDeltaInsight(v, previousVerdict, detectedPatterns, previousPatterns);
              
              // Stage V / Step 5.2: Use centralized suppression helper
              if (shouldRenderDeltaInsight(delta)) {
                deltaImproved = delta.improved || [];
                deltaRegressed = delta.regressed || [];
              }
            }
          }
        } catch (_) {}

        return `
          <div class="verdict-item"><strong>Verdict:</strong> ${vStatus}</div>
          <div class="verdict-item"><strong>Confidence:</strong> ${vConf}</div>
          ${confidenceLineHtml || ''}
          ${vWhy ? `<div class="verdict-item"><strong>Why:</strong> ${vWhy}</div>` : ''}
          ${vDrivers.length ? `<div class="verdict-item"><strong>Confidence Drivers:</strong>
            <ul class="bullets">${vDrivers.map(d => `<li>${d}</li>`).join('')}</ul>
          </div>` : ''}
          ${vFocus.length ? `<div class="verdict-item"><strong>Focus Summary:</strong>
            <ul class="bullets">${vFocus.map(f => `<li>${f}</li>`).join('')}</ul>
          </div>` : ''}
          ${(deltaImproved.length || deltaRegressed.length) ? `<div class="verdict-item"><strong>Delta Insight:</strong>
            <ul class="bullets">
              ${deltaImproved.map(line => `<li>✅ ${line}</li>`).join('')}
              ${deltaRegressed.map(line => `<li>⚠️ ${line}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${firstRunLine}
          ${journeyLineHtml}
          ${vFindings.length ? `<div class="verdict-item"><strong>Key Findings:</strong>
            <ul class="bullets">${vFindings.map(f => `<li>${f}</li>`).join('')}</ul>
          </div>` : ''}
          ${vLimits.length ? `<div class="verdict-item"><strong>Limits:</strong>
            <ul class="bullets">${vLimits.map(l => `<li>${l}</li>`).join('')}</ul>
          </div>` : ''}
          ${(() => {
            if (shouldRenderNextRunHint(v)) {
              const hint = formatNextRunHint(v);
              return hint ? `<div class="verdict-item"><strong>Next Run Hint:</strong> ${hint}</div>` : '';
            }
            return '';
          })()}
        `;
      })()}
    </div>

    <!-- Observed Patterns -->
    ${(() => {
      if (!options.artifactsDir || !options.siteSlug) return '';
      try {
        const patterns = analyzePatterns(options.artifactsDir, options.siteSlug, 10);
        // Stage V / Step 5.2: Use centralized suppression helper
        if (!shouldRenderPatterns(patterns)) return '';
        return `
    <div style="margin-top: 30px;">
      <h2>🔍 Observed Patterns (Cross-Run Analysis)</h2>
      ${patterns.slice(0, 5).map((pattern, idx) => {
        const summary = formatPatternSummary(pattern);
        const why = formatPatternWhy(pattern);
        const focus = formatPatternFocus(pattern);
        const limits = formatPatternLimits(pattern);
        return `
      <div class="pattern-item ${pattern.confidence}">
        <div class="pattern-summary">${idx + 1}. ${summary}</div>
        <div class="pattern-why">${why}</div>
        ${focus ? `<div class="pattern-focus">${focus}</div>` : ''}
        ${limits ? `<div class="pattern-limits">Limits: ${limits}</div>` : ''}
      </div>
      `;
      }).join('')}
      ${patterns.length > 5 ? `<p style="color: #7f8c8d; margin-top: 10px;">... ${patterns.length - 5} more pattern(s) detected.</p>` : ''}
    </div>
        `;
      } catch (err) {
        return '';
      }
    })()}

    <!-- Summary Cards -->
    <div class="summary">
      <div class="stat-card critical">
        <div class="stat-number">${counts.CRITICAL || 0}</div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-number">${counts.WARNING || 0}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card info">
        <div class="stat-number">${counts.INFO || 0}</div>
        <div class="stat-label">Info</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${attempts.length}</div>
        <div class="stat-label">Attempts</div>
      </div>
    </div>
`;

  // Top Risks Section
  if (topRisks.length > 0) {
    html += `
    <h2>🔥 Top Risks</h2>
    <div class="risks-section">
`;
    topRisks.slice(0, 5).forEach(risk => {
      const severityClass = risk.severity ? risk.severity.toLowerCase() : 'info';
      html += `
      <div class="risk-item ${severityClass}">
        <div class="risk-header">
          <div class="risk-title">${risk.humanReadableReason || 'Unknown risk'}</div>
          <span class="risk-badge ${severityClass}">${risk.severity || 'INFO'}</span>
        </div>
        <div class="risk-details">
          Category: ${risk.category || 'Unknown'} | 
          Impact Score: ${risk.impactScore || 0} | 
          Attempt: ${risk.attemptId || 'N/A'}
        </div>
      </div>
`;
    });
    html += `
    </div>
`;
  }

  // Attempts Section
  if (attempts.length > 0) {
    html += `
    <h2>🎯 Attempts</h2>
    <ul class="attempt-list">
`;
    attempts.forEach(attempt => {
      const outcomeClass = attempt.outcome === 'SUCCESS' ? 'success' : 'failure';
      const outcomeLabel = attempt.outcome === 'SKIPPED' ? 'Not Executed' : (attempt.outcome || 'UNKNOWN');
      const reasonLine = attempt.outcome === 'SKIPPED' && attempt.skipReason ? `<div class="risk-details" style="font-size:12px;color:#7f8c8d;">Reason: ${attempt.skipReason}</div>` : '';
      html += `
      <li class="attempt-item">
        <span class="attempt-name">${attempt.attemptName || attempt.attemptId}</span>
        <span class="attempt-outcome ${outcomeClass}">${outcomeLabel}</span>
      </li>
`;
      if (reasonLine) {
        html += reasonLine;
      }
    });
    html += `
    </ul>
`;
  }

  // Discovery Section
  if (discovery.pagesVisitedCount > 0) {
    html += `
    <h2>🔍 Discovery</h2>
    <div class="discovery-grid">
      <div class="discovery-card">
        <div class="discovery-stat">${discovery.pagesVisitedCount || 0}</div>
        <div class="discovery-label">Pages Visited</div>
      </div>
      <div class="discovery-card">
        <div class="discovery-stat">${discovery.interactionsDiscovered || 0}</div>
        <div class="discovery-label">Interactions Discovered</div>
      </div>
      <div class="discovery-card">
        <div class="discovery-stat">${discovery.interactionsExecuted || 0}</div>
        <div class="discovery-label">Interactions Executed</div>
      </div>
    </div>
`;

    // Discovery Results
    if (discovery.results && discovery.results.length > 0) {
      html += `
    <h3>Interaction Results</h3>
    <ul class="attempt-list">
`;
      discovery.results.slice(0, 10).forEach(result => {
        const outcomeClass = result.outcome === 'SUCCESS' ? 'success' : 'failure';
        html += `
      <li class="attempt-item">
        <span class="attempt-name">${result.interactionId || 'unknown'}</span>
        <span class="attempt-outcome ${outcomeClass}">${result.outcome || 'UNKNOWN'}</span>
      </li>
`;
      });
      html += `
    </ul>
`;
    }
  }

  // Baseline Diff Section
  if (baseline.diff && (baseline.diff.regressions || baseline.diff.improvements)) {
    html += `
    <h2>📊 Changes Since Last Run</h2>
    <div class="diff-section">
`;
    
    if (baseline.diff.regressions && Object.keys(baseline.diff.regressions).length > 0) {
      html += `
      <h3>⚠️ Regressions</h3>
`;
      Object.entries(baseline.diff.regressions).forEach(([attemptId, details]) => {
        html += `
      <div class="diff-item removed">
        <strong>${attemptId}:</strong> ${details.reason || 'Regressed'}
      </div>
`;
      });
    }

    if (baseline.diff.improvements && Object.keys(baseline.diff.improvements).length > 0) {
      html += `
      <h3>✅ Improvements</h3>
`;
      Object.entries(baseline.diff.improvements).forEach(([attemptId, details]) => {
        html += `
      <div class="diff-item added">
        <strong>${attemptId}:</strong> ${details.reason || 'Improved'}
      </div>
`;
      });
    }

    html += `
    </div>
`;
  }

  // Evidence Gallery
  const attemptsWithScreenshots = attempts.filter(a => a.evidence && a.evidence.screenshotPath);
  if (attemptsWithScreenshots.length > 0) {
    html += `
    <h2>📸 Evidence Gallery</h2>
    <div class="evidence-gallery">
`;
    attemptsWithScreenshots.forEach(attempt => {
      const screenshotPath = attempt.evidence.screenshotPath || '';
      const relativePath = screenshotPath.replace(outputDir, '').replace(/\\/g, '/');
      html += `
      <div class="evidence-card">
        <img src=".${relativePath}" alt="${attempt.attemptName || attempt.attemptId}" class="evidence-img" onclick="window.open(this.src)">
        <div class="evidence-caption">
          <strong>${attempt.attemptName || attempt.attemptId}</strong><br>
          ${attempt.outcome || 'UNKNOWN'}
        </div>
      </div>
`;
    });
    html += `
    </div>
`;
  }

  html += `
    <footer>
      Generated by ODAVL Guardian | ${new Date().toISOString()}
    </footer>
  </div>
</body>
</html>
`;

  return html;
}

/**
 * Write enhanced HTML report to file
 */
function writeEnhancedHtml(snapshot, outputDir, options = {}) {
  const html = generateEnhancedHtml(snapshot, outputDir, options);
  const reportPath = path.join(outputDir, 'report.html');
  
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(reportPath, html, 'utf-8');
  return reportPath;
}

module.exports = {
  generateEnhancedHtml,
  writeEnhancedHtml
};
