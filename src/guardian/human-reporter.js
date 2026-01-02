/**
 * Human Report Generator
 * Transforms journey results into human-readable summaries
 */

const fs = require('fs');
const path = require('path');
const { analyzeFailure, recordSignature, getSignatureCount } = require('./failure-intelligence');

class HumanReporter {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generate a complete human summary and save to file
   */
  generateSummary(journeyResult, outputDir) {
    const summary = this._buildSummary(journeyResult);
    
    // Save as both .txt and .md
    const txtPath = path.join(outputDir, 'summary.txt');
    const mdPath = path.join(outputDir, 'summary.md');

    fs.writeFileSync(txtPath, summary.text, 'utf8');
    fs.writeFileSync(mdPath, summary.markdown, 'utf8');

    return {
      text: txtPath,
      markdown: mdPath,
      content: summary.text
    };
  }

  /**
   * Generate JSON report for programmatic access
   */
  generateJSON(journeyResult, outputDir) {
    const { toCanonicalJourneyVerdict } = require('./verdicts');
    const decisionCanonical = toCanonicalJourneyVerdict(journeyResult.finalDecision);
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        journey: journeyResult.journey
      },
      target: {
        url: journeyResult.url,
        reachable: journeyResult.executedSteps.length > 0
      },
      intentDetection: journeyResult.intentDetection || { intent: 'unknown', confidence: 0, signals: [] },
      goal: journeyResult.goal || { goalReached: false, goalDescription: '' },
      baseline: journeyResult.baseline || null,
      drift: journeyResult.drift || { driftDetected: false, driftReasons: [] },
      execution: {
        totalSteps: journeyResult.executedSteps.length + journeyResult.failedSteps.length,
        succeededSteps: journeyResult.executedSteps.length,
        failedSteps: journeyResult.failedSteps.length,
        successRate: journeyResult.executedSteps.length > 0 
          ? Math.round((journeyResult.executedSteps.length / 
              (journeyResult.executedSteps.length + journeyResult.failedSteps.length)) * 100)
          : 0
      },
      classification: journeyResult.errorClassification || { type: 'UNKNOWN' },
      decision: journeyResult.finalDecision,
      decisionCanonical,
      reasoning: this._buildReasoning(journeyResult),
      impact: this._assessUserImpact(journeyResult),
      timing: {
        started: journeyResult.startedAt,
        ended: journeyResult.endedAt
      },
      details: {
        steps: journeyResult.executedSteps,
        failures: journeyResult.failedSteps,
        evidence: journeyResult.evidence
      }
    };

    // Failure intelligence section
    const info = analyzeFailure(journeyResult);
    const rec = recordSignature(journeyResult.url, info);
    report.failureInsights = {
      failureStage: info.failureStage,
      failureStepId: info.failureStepId,
      cause: info.cause,
      hint: info.hint,
      signature: rec.signature,
      occurrences: rec.count,
    };

    const reportPath = path.join(outputDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    return report;
  }

  /**
   * Build human text summary
   */
  _buildSummary(journeyResult) {
    // Legacy code - decision and classification were used in earlier versions
    // Keeping structure for potential future use
    // eslint-disable-next-line no-unused-vars
    const decision = journeyResult.finalDecision || 'UNKNOWN';
    // eslint-disable-next-line no-unused-vars
    const classification = journeyResult.errorClassification || {};
    
    const text = this._formatText(journeyResult);
    const markdown = this._formatMarkdown(journeyResult);

    return { text, markdown };
  }

  _formatText(journeyResult) {
    const { toCanonicalJourneyVerdict } = require('./verdicts');
    const canonical = toCanonicalJourneyVerdict(journeyResult.finalDecision);
        // Baseline compare
        if (journeyResult.baseline) {
          lines.push('BASELINE');
          lines.push('─────────────────────────────────────────────────────────────────');
          const b = journeyResult.baseline;
          lines.push(`Saved decision: ${b.decision}`);
          lines.push(`Saved intent:   ${String(b.intent || 'unknown').toUpperCase()}`);
          lines.push(`Saved goal:     ${b.goalReached ? 'Reached' : 'Not reached'}\n`);

          lines.push('CURRENT VS BASELINE');
          lines.push('─────────────────────────────────────────────────────────────────');
          const d = journeyResult.drift || { driftDetected: false, driftReasons: [] };
          if (d.driftDetected) {
            lines.push('Regression detected:');
            for (const r of d.driftReasons) lines.push(`– ${r}`);
          } else {
            lines.push('No regression detected');
          }
          lines.push();
        }
    const lines = [];
    const decision = canonical || 'DO_NOT_LAUNCH';

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    ODAVL GUARDIAN — JOURNEY REPORT');
    lines.push('═══════════════════════════════════════════════════════════════\n');

    lines.push(`DECISION: ${this._decisionEmoji(decision)} ${decision}`);
    lines.push(`Journey: ${journeyResult.journey || 'Unknown'}`);
    lines.push(`Target:  ${journeyResult.url}\n`);

    // Intent detection
    if (journeyResult.intentDetection) {
      const id = journeyResult.intentDetection;
      lines.push('SITE TYPE');
      lines.push('─────────────────────────────────────────────────────────────────');
      lines.push(`Detected: ${String(id.intent || 'unknown').toUpperCase()} (confidence ${id.confidence || 0}%)`);
      lines.push(`Visitor Goal: ${this._intentToHumanGoal(id.intent)}`);
      const goal = journeyResult.goal || { goalReached: false, goalDescription: '' };
      lines.push(`Goal Reached: ${goal.goalReached ? 'Yes' : 'No'} — ${goal.goalDescription}\n`);
    }

    lines.push('EXECUTION SUMMARY');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(`Steps Executed:  ${journeyResult.executedSteps.length}`);
    lines.push(`Steps Failed:    ${journeyResult.failedSteps.length}`);
    lines.push(`Total Steps:     ${journeyResult.executedSteps.length + journeyResult.failedSteps.length}`);
    
    if (journeyResult.executedSteps.length > 0) {
      const rate = Math.round((journeyResult.executedSteps.length / 
        (journeyResult.executedSteps.length + journeyResult.failedSteps.length)) * 100);
      lines.push(`Success Rate:    ${rate}%\n`);
    }

    lines.push('WHAT GUARDIAN TESTED');
    lines.push('─────────────────────────────────────────────────────────────────');
    const steps = journeyResult.executedSteps || [];
    for (let i = 0; i < steps.length; i++) {
      lines.push(`${i + 1}. ${steps[i].name || `Step ${i + 1}`}`);
    }
    lines.push();

    if (journeyResult.failedSteps && journeyResult.failedSteps.length > 0) {
      lines.push('WHAT FAILED');
      lines.push('─────────────────────────────────────────────────────────────────');
      for (const failure of journeyResult.failedSteps) {
        const step = journeyResult.executedSteps.find(s => s.id === failure);
        if (step) {
          lines.push(`✗ ${step.name || failure}: ${step.error || 'Unknown failure'}`);
        }
      }
      lines.push();
    }

    if (journeyResult.errorClassification) {
      lines.push('ERROR CLASSIFICATION');
      lines.push('─────────────────────────────────────────────────────────────────');
      lines.push(`Type:   ${journeyResult.errorClassification.type || 'UNKNOWN'}`);
      lines.push(`Reason: ${journeyResult.errorClassification.reason || 'N/A'}\n`);
    }

    lines.push('DECISION REASONING');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(this._buildReasoning(journeyResult));
    lines.push();

    // Failure intelligence
    const fi = analyzeFailure(journeyResult);
    const occurrences = getSignatureCount(journeyResult.url, fi);
    lines.push('WHERE USERS STOP');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(`Stage: ${fi.failureStage}`);
    lines.push(`Step:  ${fi.failureStepId ?? 'unknown'}`);
    lines.push();

    lines.push('WHY IT LIKELY HAPPENS');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(fi.cause);
    lines.push();

    lines.push('FIRST FIX TO TRY');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(fi.hint);
    lines.push(`\nThis failure pattern occurred ${occurrences} time(s).`);
    lines.push();

    lines.push('USER IMPACT');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push(this._assessUserImpact(journeyResult));
    lines.push();

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('RECOMMENDATION');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(this._getRecommendation(journeyResult));
    lines.push();

    return lines.join('\n');
  }

  _formatMarkdown(journeyResult) {
    const { toCanonicalJourneyVerdict } = require('./verdicts');
    const canonical = toCanonicalJourneyVerdict(journeyResult.finalDecision);
        if (journeyResult.baseline) {
          const b = journeyResult.baseline;
          const d = journeyResult.drift || { driftDetected: false, driftReasons: [] };
          lines.push(`## Baseline`);
          lines.push(`- Decision: ${b.decision}`);
          lines.push(`- Intent: ${String(b.intent || 'unknown').toUpperCase()}`);
          lines.push(`- Goal: ${b.goalReached ? 'Reached' : 'Not reached'}`);
          lines.push();
          lines.push(`## Current vs Baseline`);
          if (d.driftDetected) {
            lines.push('Regression detected:');
            for (const r of d.driftReasons) lines.push(`- ${r}`);
          } else {
            lines.push('No regression detected');
          }
          lines.push();
        }
    const lines = [];
    const decision = canonical || 'DO_NOT_LAUNCH';

    lines.push(`# ODAVL Guardian — Journey Report\n`);
    
    lines.push(`## Decision: ${this._decisionEmoji(decision)} **${decision}**\n`);
    lines.push(`- **Journey:** ${journeyResult.journey || 'Unknown'}`);
    lines.push(`- **Target:** ${journeyResult.url}`);
    lines.push(`- **Time:** ${journeyResult.startedAt}\n`);

    if (journeyResult.intentDetection) {
      const id = journeyResult.intentDetection;
      lines.push(`## Site Type`);
      lines.push(`- **Detected:** ${String(id.intent || 'unknown').toUpperCase()} (confidence ${id.confidence || 0}%)`);
      lines.push(`- **Visitor Goal:** ${this._intentToHumanGoal(id.intent)}`);
      const goal = journeyResult.goal || { goalReached: false, goalDescription: '' };
      lines.push(`- **Goal Reached:** ${goal.goalReached ? 'Yes' : 'No'} — ${goal.goalDescription}\n`);
    }

    lines.push(`## Execution Summary\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Steps Executed | ${journeyResult.executedSteps.length} |`);
    lines.push(`| Steps Failed | ${journeyResult.failedSteps.length} |`);
    const rate = journeyResult.executedSteps.length > 0
      ? Math.round((journeyResult.executedSteps.length / 
          (journeyResult.executedSteps.length + journeyResult.failedSteps.length)) * 100)
      : 0;
    lines.push(`| Success Rate | ${rate}% |\n`);

    lines.push(`## What Guardian Tested\n`);
    const steps = journeyResult.executedSteps || [];
    for (let i = 0; i < steps.length; i++) {
      lines.push(`${i + 1}. ${steps[i].name || `Step ${i + 1}`}`);
    }
    lines.push();

    if (journeyResult.failedSteps?.length > 0) {
      lines.push(`## Failures\n`);
      for (const failure of journeyResult.failedSteps) {
        const step = journeyResult.executedSteps.find(s => s.id === failure);
        if (step) {
          lines.push(`- ✗ **${step.name || failure}**: ${step.error || 'Unknown failure'}`);
        }
      }
      lines.push();
    }

    if (journeyResult.errorClassification) {
      lines.push(`## Error Classification\n`);
      lines.push(`- **Type:** ${journeyResult.errorClassification.type || 'UNKNOWN'}`);
      lines.push(`- **Reason:** ${journeyResult.errorClassification.reason || 'N/A'}\n`);
    }

    lines.push(`## Reasoning\n`);
    lines.push(this._buildReasoning(journeyResult));
    lines.push();

    lines.push(`## User Impact\n`);
    lines.push(this._assessUserImpact(journeyResult));
    lines.push();

    const fi = analyzeFailure(journeyResult);
    const occurrences = getSignatureCount(journeyResult.url, fi);
    lines.push(`## Where Users Stop`);
    lines.push(`- **Stage:** ${fi.failureStage}`);
    lines.push(`- **Step:** ${fi.failureStepId ?? 'unknown'}`);
    lines.push();
    lines.push(`## Why It Likely Happens`);
    lines.push(`- ${fi.cause}`);
    lines.push();
    lines.push(`## First Fix To Try`);
    lines.push(`- ${fi.hint}`);
    lines.push();
    lines.push(`> This failure pattern occurred ${occurrences} time(s).`);
    lines.push();

    lines.push(`## Recommendation\n`);
    lines.push(this._getRecommendation(journeyResult));
    lines.push();

    return lines.join('\n');
  }

  _decisionEmoji(decision) {
    const map = {
      'READY': '✅',
      'FRICTION': '⚠️ ',
      'DO_NOT_LAUNCH': '🚫'
    };
    return map[decision] || '❓';
  }

  _buildReasoning(journeyResult) {
    const decision = journeyResult.finalDecision;
    const executed = journeyResult.executedSteps?.length || 0;
    const failed = journeyResult.failedSteps?.length || 0;
    const goalReached = journeyResult.goal?.goalReached === true;

    if (decision === 'SAFE') {
      return `All ${executed} steps completed, and the visitor goal was reached. Journey is fully functional.`;
    }

    if (decision === 'RISK') {
      if (failed === 0 && !goalReached) {
        return `Journey steps succeeded, but the visitor goal was not reached. Conversion risk exists.`;
      }
      return `${executed} of ${executed + failed} steps succeeded (${Math.round((executed / (executed + failed)) * 100)}%). Some parts of the critical journey work, but risks exist.`;
    }

    if (decision === 'DO_NOT_LAUNCH') {
      if (journeyResult.fatalError) {
        return `Site is unreachable or blocked. Cannot complete user journey at all. Error: ${journeyResult.fatalError}`;
      }
      return `Journey failed completely (0/${executed + failed} steps succeeded). Site or critical elements are broken. Do not launch.`;
    }

    return 'Unable to determine outcome from results.';
  }

  _assessUserImpact(journeyResult) {
    const classification = journeyResult.errorClassification?.type;

    if (journeyResult.finalDecision === 'SAFE') {
      return 'Visitors will successfully complete the critical user journey. No blockers detected.';
    }

    if (classification === 'CTA_NOT_FOUND') {
      return 'Visitors cannot find the key conversion element. Sign-up/checkout CTA is missing or inaccessible.';
    }

    if (classification === 'NAVIGATION_BLOCKED') {
      return 'Visitors cannot navigate to critical pages. Internal navigation is broken.';
    }

    if (classification === 'SITE_UNREACHABLE') {
      return 'Site is entirely unreachable. Visitors cannot access the website at all.';
    }

    if (journeyResult.finalDecision === 'RISK') {
      return 'Some steps work but the journey is incomplete. Visitors may struggle to convert.';
    }

    return 'Site has critical failures that impact user conversion.';
  }

  _getRecommendation(journeyResult) {
    const decision = journeyResult.finalDecision;

    if (decision === 'SAFE') {
      return '✅ **READY TO LAUNCH** — Critical journey is fully functional. Monitor for regressions.';
    }

    if (decision === 'RISK') {
      if (journeyResult.goal?.goalReached === false && journeyResult.failedSteps?.length === 0) {
        return '⚠️  **LAUNCH WITH CAUTION** — Help visitors reach the goal (signup, checkout, contact) before launch.';
      }
      return '⚠️  **LAUNCH WITH CAUTION** — Fix identified failures before launch. Test thoroughly.';
    }

    if (decision === 'DO_NOT_LAUNCH') {
      return '🚫 **DO NOT LAUNCH** — Critical failures detected. Fix issues before attempting deployment.';
    }

    return 'Unable to make recommendation.';
  }

  _intentToHumanGoal(intent) {
    switch (intent) {
      case 'saas': return 'Sign up or view pricing';
      case 'shop': return 'Add to cart or begin checkout';
      case 'landing': return 'Send a message or reach contact section';
      default: return 'Find a clear action and proceed';
    }
  }
}

module.exports = { HumanReporter };
