/**
 * Guardian Attempt Reporter
 * Generates JSON and HTML reports for single user attempts
 * 
 * @typedef {import('./truth/attempt.contract.js').AttemptResult} AttemptResult
 */

const fs = require('fs');
const path = require('path');

class AttemptReporter {
  /**
   * Create attempt report from execution result
   * @param {AttemptResult} attemptResult - Attempt execution result
   * @param {string} baseUrl - Base URL
   * @param {string} attemptId - Attempt identifier
   * @returns {Object} Report object
   */
  createReport(attemptResult, baseUrl, attemptId) {
    const { outcome, steps, startedAt, endedAt, totalDurationMs, friction, error, successReason } = attemptResult;

    return {
      version: '1.0.0',
      runId: this._generateRunId(),
      timestamp: new Date().toISOString(),
      attemptId,
      baseUrl,
      outcome,
      meta: {
        goal: this._getGoalForAttempt(attemptId),
        startedAt,
        endedAt,
        durationMs: totalDurationMs
      },
      steps: steps.map((step, index) => ({
        index: index + 1,
        ...step
      })),
      friction: {
        isFriction: friction.isFriction,
        signals: friction.signals || [],
        summary: friction.summary || null,
        reasons: friction.reasons,
        thresholds: friction.thresholds,
        metrics: friction.metrics
      },
      error,
      successReason,
      evidence: {
        screenshotDir: 'attempt-screenshots',
        tracePath: 'trace.zip'
      }
    };
  }

  /**
   * Save report to JSON
   */
  saveJsonReport(report, artifactsDir) {
    const reportPath = path.join(artifactsDir, 'attempt-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport(report) {
    const { outcome, attemptId, meta, steps, friction, error, successReason } = report;

    const outcomeColor = outcome === 'SUCCESS' ? '#10b981' : outcome === 'FRICTION' ? '#f59e0b' : '#ef4444';
    const outcomeText = outcome === 'SUCCESS' ? '✅ SUCCESS' : outcome === 'FRICTION' ? '⚠️ FRICTION' : '❌ FAILURE';
    const outcomeEmoji = outcome === 'SUCCESS' ? '🟢' : outcome === 'FRICTION' ? '🟡' : '🔴';

    const stepsHtml = steps.map(step => `
      <tr>
        <td class="step-index">${step.index}</td>
        <td class="step-id">${step.id}</td>
        <td class="step-desc">${step.description || step.type}</td>
        <td class="step-duration">${step.durationMs || 0}ms</td>
        <td class="step-status ${step.status}">
          ${step.status === 'success' ? '✅' : '❌'}
          ${step.status}
          ${step.retries > 0 ? `<br/>(${step.retries} retries)` : ''}
        </td>
        ${step.error ? `<td class="step-error">${step.error}</td>` : '<td></td>'}
      </tr>
    `).join('');

    const frictionHtml = friction.isFriction ? `
      <div class="friction-block">
        <h3>⚠️ Friction Detected</h3>
        ${friction.summary ? `<p class="friction-summary">${friction.summary}</p>` : ''}
        
        ${friction.signals && friction.signals.length > 0 ? `
          <div class="friction-signals">
            <h4>Friction Signals:</h4>
            ${friction.signals.map(signal => {
              const severityClass = signal.severity || 'medium';
              const severityLabel = signal.severity ? signal.severity.toUpperCase() : 'MEDIUM';
              return `
                <div class="signal-card severity-${severityClass}">
                  <div class="signal-header">
                    <span class="signal-id">${signal.id}</span>
                    <span class="signal-severity severity-${severityClass}">${severityLabel}</span>
                  </div>
                  <p class="signal-description">${signal.description}</p>
                  <div class="signal-metrics">
                    <div class="signal-metric">
                      <strong>Metric:</strong> ${signal.metric}
                    </div>
                    <div class="signal-metric">
                      <strong>Threshold:</strong> ${signal.threshold}
                    </div>
                    <div class="signal-metric">
                      <strong>Observed:</strong> ${signal.observedValue}
                    </div>
                    ${signal.affectedStepId ? `
                      <div class="signal-metric">
                        <strong>Affected Step:</strong> ${signal.affectedStepId}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        
        ${friction.reasons && friction.reasons.length > 0 ? `
          <details class="legacy-friction">
            <summary>Legacy Friction Reasons</summary>
            <ul>
              ${friction.reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
          </details>
        ` : ''}
        
        <p><strong>Metrics:</strong></p>
        <ul>
          <li>Total duration: ${friction.metrics.totalDurationMs || 0}ms</li>
          <li>Steps executed: ${friction.metrics.stepCount || 0}</li>
          <li>Total retries: ${friction.metrics.totalRetries || 0}</li>
          <li>Max step duration: ${friction.metrics.maxStepDurationMs || 0}ms</li>
        </ul>
      </div>
    ` : '';

    const errorHtml = error ? `
      <div class="error-block">
        <h3>Error Details</h3>
        <p class="error-message">${error}</p>
      </div>
    ` : '';

    const successHtml = successReason ? `
      <div class="success-block">
        <h3>✅ Success Criteria Met</h3>
        <p>${successReason}</p>
      </div>
    ` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guardian Attempt Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .outcome-badge {
      display: inline-block;
      padding: 12px 20px;
      border-radius: 25px;
      font-weight: bold;
      font-size: 1.1em;
      background: ${outcomeColor};
      color: white;
      margin-top: 15px;
    }
    .meta-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .meta-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .meta-item:last-child {
      border-bottom: none;
    }
    .meta-label {
      font-weight: bold;
      color: #666;
      min-width: 150px;
    }
    .meta-value {
      color: #333;
    }
    .steps-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .steps-table thead {
      background: #f0f0f0;
      font-weight: bold;
    }
    .steps-table th, .steps-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .steps-table tbody tr:hover {
      background: #f9f9f9;
    }
    .step-index {
      font-weight: bold;
      color: #667eea;
      width: 60px;
    }
    .step-id {
      font-family: monospace;
      font-size: 0.9em;
      color: #666;
    }
    .step-duration {
      font-family: monospace;
      width: 80px;
      text-align: right;
    }
    .step-status {
      text-align: center;
      font-weight: bold;
    }
    .step-status.success {
      color: #10b981;
    }
    .step-status.failed {
      color: #ef4444;
    }
    .step-error {
      color: #ef4444;
      font-size: 0.9em;
    }
    .friction-block, .error-block, .success-block {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border-left: 4px solid #f59e0b;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .error-block {
      border-left-color: #ef4444;
    }
    .success-block {
      border-left-color: #10b981;
    }
    .friction-block h3, .error-block h3, .success-block h3 {
      margin-bottom: 15px;
      font-size: 1.1em;
    }
    .friction-block ul, .error-block ul, .success-block ul {
      margin-left: 20px;
    }
    .friction-block li, .error-block li, .success-block li {
      margin-bottom: 8px;
    }
    .error-message {
      background: #fee2e2;
      padding: 12px;
      border-radius: 5px;
      border-left: 3px solid #ef4444;
      font-family: monospace;
      font-size: 0.9em;
    }
    .friction-summary {
      font-weight: bold;
      font-size: 1.05em;
      margin-bottom: 15px;
      color: #f59e0b;
    }
    .friction-signals {
      margin: 20px 0;
    }
    .friction-signals h4 {
      margin-bottom: 12px;
      color: #333;
    }
    .signal-card {
      background: #fefce8;
      border: 1px solid #fde047;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 12px;
    }
    .signal-card.severity-low {
      background: #f0f9ff;
      border-color: #7dd3fc;
      border-left-color: #0ea5e9;
    }
    .signal-card.severity-medium {
      background: #fefce8;
      border-color: #fde047;
      border-left-color: #f59e0b;
    }
    .signal-card.severity-high {
      background: #fef2f2;
      border-color: #fca5a5;
      border-left-color: #ef4444;
    }
    .signal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .signal-id {
      font-family: monospace;
      font-weight: bold;
      font-size: 0.95em;
      color: #333;
    }
    .signal-severity {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
    }
    .signal-severity.severity-low {
      background: #0ea5e9;
      color: white;
    }
    .signal-severity.severity-medium {
      background: #f59e0b;
      color: white;
    }
    .signal-severity.severity-high {
      background: #ef4444;
      color: white;
    }
    .signal-description {
      color: #666;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .signal-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      font-size: 0.9em;
    }
    .signal-metric {
      background: white;
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .signal-metric strong {
      color: #666;
      font-size: 0.85em;
      display: block;
      margin-bottom: 2px;
    }
    .legacy-friction {
      margin-top: 15px;
      font-size: 0.9em;
    }
    .legacy-friction summary {
      cursor: pointer;
      color: #666;
      font-weight: bold;
      margin-bottom: 8px;
    }
    .legacy-friction summary:hover {
      color: #333;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 0.9em;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Guardian Attempt Report</h1>
      <div class="outcome-badge">${outcomeEmoji} ${outcomeText}</div>
    </div>

    <div class="meta-info">
      <div class="meta-item">
        <span class="meta-label">Attempt</span>
        <span class="meta-value">${attemptId}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">URL</span>
        <span class="meta-value">${report.baseUrl}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Started</span>
        <span class="meta-value">${meta.startedAt}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Duration</span>
        <span class="meta-value">${meta.durationMs}ms</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Steps</span>
        <span class="meta-value">${steps.length}</span>
      </div>
    </div>

    <h2>Steps Timeline</h2>
    <table class="steps-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Step ID</th>
          <th>Description</th>
          <th>Duration</th>
          <th>Status</th>
          <th>Error (if any)</th>
        </tr>
      </thead>
      <tbody>
        ${stepsHtml}
      </tbody>
    </table>

    ${successHtml}
    ${frictionHtml}
    ${errorHtml}

    <div class="footer">
      <p>Generated by Guardian Phase 1 — Single User Attempt MVP</p>
      <p>Report ID: ${report.runId}</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Save HTML report
   */
  saveHtmlReport(html, artifactsDir) {
    const reportPath = path.join(artifactsDir, 'attempt-report.html');
    fs.writeFileSync(reportPath, html);
    return reportPath;
  }

  /**
   * Generate run ID
   */
  _generateRunId() {
    const now = new Date();
    return now.toISOString().replace(/[:\-]/g, '').substring(0, 15).replace('T', '-');
  }

  /**
   * Get goal description for attempt
   */
  _getGoalForAttempt(attemptId) {
    const goals = {
      contact_form: 'User submits a contact form successfully',
      language_switch: 'User switches site language successfully',
      newsletter_signup: 'User signs up for newsletter'
    };
    return goals[attemptId] || 'Complete user attempt';
  }
}

module.exports = { AttemptReporter };
