import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { atomicWriteFileSync } from '../../cli/util/atomic-write.js';
import { aggregateProblems } from './finding-aggregator.js';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

/**
 * Generate human-readable SUMMARY.md for a scan run
 * 
 * @param {string} runDir - Run directory path
 * @param {string} url - URL that was scanned
 * @param {string} srcDir - Source directory used
 * @param {Object} findings - Findings from detect phase
 * @param {Object} learnData - Learn phase output
 * @param {Object} observeData - Observe phase output
 * @returns {string} Path to written SUMMARY.md file
 */
export function writeSummaryMarkdown(runDir, url, srcDir, findings, learnData, observeData) {
  const summaryPath = resolve(runDir, 'SUMMARY.md');
  const evidenceDir = resolve(runDir, 'EVIDENCE');
  const hasBefore = existsSync(resolve(evidenceDir, 'before.png'));
  const hasAfter = existsSync(resolve(evidenceDir, 'after.png'));
  const hasElement = existsSync(resolve(evidenceDir, 'element.png'));
  const hasDomDiff = existsSync(resolve(evidenceDir, 'dom_diff.json'));
  const evidenceLines = [];
  if (hasBefore) evidenceLines.push('- **Before:** [before.png](EVIDENCE/before.png)');
  if (hasAfter) evidenceLines.push('- **After:** [after.png](EVIDENCE/after.png)');
  if (hasElement) evidenceLines.push('- **Element (optional):** [element.png](EVIDENCE/element.png)');
  if (hasDomDiff) evidenceLines.push('- **DOM diff:** [dom_diff.json](EVIDENCE/dom_diff.json)');
  const evidenceSection = evidenceLines.length > 0 ? evidenceLines.join('\n') : '*No evidence files captured.*';
  
  // Determine framework if possible
  const framework = detectFramework(learnData);
  
  // Aggregate problems from findings
  const problems = aggregateProblems(findings.findings || [], { projectType: framework });
  
  // Build findings list
  const findingsList = buildFindingsList(findings, observeData);
  
  // Determine result status
  const resultStatus = determineResultStatus(findings);

  // Detect fallback debug artifacts
  let fallbackEvidenceNote = '';
  try {
    const debugDir = resolve(runDir, 'DEBUG');
    if (existsSync(debugDir)) {
      const files = readdirSync(debugDir).sort((a, b) => a.localeCompare(b, 'en'));
      const hasPage = files.includes('page.html');
      const hasConsole = files.includes('console.log');
      if (hasPage || hasConsole) {
        fallbackEvidenceNote = '\n**Evidence warning:** Some screenshots may have appeared blank during capture. We saved fallback artifacts for review in the `DEBUG/` folder (non-blocking):\n- Page HTML: [page.html](DEBUG/page.html)\n- Console log: [console.log](DEBUG/console.log)\n';
      }
    }
  } catch (e) { /* noop */ }
  
  // Build markdown content
  const timeProvider = getTimeProvider();
  const isoDateTime = timeProvider.iso();
  
  const markdown = `# VERAX Scan Summary

**Date:** ${isoDateTime}  
**URL scanned:** ${url}  
**Source directory:** ${srcDir}  
${framework ? `**Framework detected:** ${framework}\n` : ''}

---

## Result

${resultStatus}

---

## Decision-Level Problems

${problems.length > 0 ? buildProblemsMarkdown(problems, findingsList) : '*No problems detected.*'}

---

## Detailed Findings

${
  findingsList.length === 0 
    ? '*No silent failures detected.*'
    : buildFindingsByCategoryMarkdown(findingsList)
}

---

## Evidence

Key evidence for this run is in the \`EVIDENCE/\` folder:
${evidenceSection}

${
  (findingsList.some(f => f.noElementScreenshot) || findingsList.some(f => f.whiteScreenshot))
    ? '\n**Evidence notes:** Some element screenshots may be missing or blank. This can happen if:\n- The element was not visible at interaction time\n- Screenshots captured before visual render stabilized\n- The clicked element was outside the viewport\n\nPage-level screenshots are still available for review.\n'
    : ''
}
${fallbackEvidenceNote}

---

## Capabilities & Limitations

### ✅ VERAX Can Detect

- **Interactions that produce no observable effect** (buttons that don't work, links that don't navigate)
- **State mutations that don't update UI** (state changes in React/Vue that don't trigger re-renders)
- **Form submissions without feedback** (successful API calls with no success message or redirect)
- **Navigation without content rendering** (URL changes but page content doesn't load)
- **Missing UI feedback elements** (validation messages, toast notifications, loading states that never appear)

### ❌ VERAX Cannot Detect (Unsupported)

- **Async race conditions** - Concurrent operations are too complex to reliably detect without semantic analysis
- **Response body validation** - VERAX does not parse API responses to validate success semantics
- **Semantic correctness** - Cannot verify if an action is "correct" only that observable effects occurred
- **Performance issues** - Slow operations that eventually complete are not silent failures
- **Partial/delayed rendering** - Changes that occur after the observation window closes

### ⚠️ PARTIAL SUPPORT

- **Conditional rendering bugs** - Detected via state change + no UI change rule (confidence 60%)
- **Complex state dependencies** - Simple state mutations detected, but complex derived state may be missed

---

## Statistics

- **Expectations extracted:** ${learnData?.stats?.totalExpectations || 0}
- **Interactions attempted:** ${observeData?.stats?.attempted || 0}
- **Interactions observed:** ${observeData?.stats?.observed || 0}
- **Silent failures:** ${findings?.stats?.silentFailures || 0}
- **Coverage gaps:** ${findings?.stats?.coverageGaps || 0}

---

## Next Steps

1. **Review the findings** above for details on each silent failure
2. **Examine the evidence** in the \`EVIDENCE/\` folder (screenshots, DOM diffs)
3. **Categorize by priority** - Use Impact and Confidence levels to prioritize fixes
4. **Fix the code** to provide proper feedback or complete the intended action
5. **Re-run VERAX** after fixes to verify the silent failures are resolved

For more details, see the full machine-readable report in \`REPORT.json\`.

---

*Generated by VERAX — Silent Failure Detection Engine*
`;


  atomicWriteFileSync(summaryPath, markdown);
  
  return summaryPath;
}

/**
 * Detect framework from learn data
 */
function detectFramework(learnData) {
  if (!learnData) return null;
  
  const type = learnData.projectType || learnData.detectedFramework;
  if (!type) return null;
  
  // Map internal type names to human-friendly names
  const typeMap = {
    'nextjs': 'Next.js',
    'nextjs_app_router': 'Next.js (App Router)',
    'nextjs_pages_router': 'Next.js (Pages Router)',
    'react': 'React',
    'react_spa': 'React SPA',
    'vue': 'Vue.js',
    'angular': 'Angular',
    'sveltekit': 'SvelteKit',
    'static_html': 'Static HTML',
    'astro': 'Astro'
  };
  
  return typeMap[type] || type;
}

/**
 * Determine overall result status
 */
function determineResultStatus(findings) {
  if (!findings) {
    return '⚠️ **Status:** Run incomplete or no findings available';
  }
  
  const silentFailures = findings.stats?.silentFailures || 0;
  
  if (silentFailures === 0) {
    return '✅ **Status:** No silent failures detected';
  } else if (silentFailures === 1) {
    return '❌ **Status:** 1 silent failure detected';
  } else {
    return `❌ **Status:** ${silentFailures} silent failures detected`;
  }
}

/**
 * Build problems markdown section
 */
function buildProblemsMarkdown(problems, findingsList) {
  // Show max 5 problems
  const topProblems = problems.slice(0, 5);
  
  let result = '*High-level problems for decision makers. Each problem groups related findings from the same page/workflow.*\n\n';
  
  topProblems.forEach((problem, i) => {
    result += `### ${i + 1}. ${problem.title}\n\n`;
    result += `**Page:** ${problem.page}  \n`;
    result += `**User Intent:** ${problem.userIntent}  \n`;
    result += `**Impact:** ${problem.impact}  \n`;
    result += `**Confidence:** ${Math.round(problem.confidence * 100)}%  \n`;
    result += `**Related Findings:** ${problem.findingCount}\n\n`;
    
    result += `#### What the user tried:\n${problem.whatUserTried}\n\n`;
    result += `#### What was expected:\n${problem.whatWasExpected}\n\n`;
    result += `#### What actually happened:\n${problem.whatActuallyHappened}\n\n`;
    result += `#### Why it matters:\n${problem.whyItMatters}\n\n`;
    
    // Likely causes section
    const problemCauses = [];
    problem.findings.forEach(findingId => {
      const finding = findingsList.find(f => f.id === findingId);
      if (finding && finding.causes && finding.causes.length > 0) {
        finding.causes.forEach(cause => {
          if (!problemCauses.find(c => c.id === cause.id)) {
            problemCauses.push(cause);
          }
        });
      }
    });
    
    if (problemCauses.length > 0) {
      result += `#### Likely Causes:\n`;
      problemCauses.forEach(cause => {
        result += `- ${cause.statement}\n`;
      });
      result += '\n';
    }
    
    // List underlying findings
    result += `<details>\n<summary><strong>View ${problem.findingCount} underlying finding(s)</strong></summary>\n\n`;
    
    problem.findings.forEach(findingId => {
      const finding = findingsList.find(f => f.id === findingId);
      if (finding) {
        result += `- **${finding.promise}** (${finding.source?.file || 'unknown'}:${finding.source?.line || '?'})\n`;
      } else {
        result += `- Finding ${findingId}\n`;
      }
    });
    
    result += `\n</details>\n\n`;
    
    // Evidence section
    if (problem.evidence && problem.evidence.length > 0) {
      result += `**Evidence:**\n`;
      problem.evidence.forEach(ev => {
        if (ev.type === 'screenshot' && ev.path) {
          result += `- Screenshot: [${ev.path}](${ev.path})\n`;
        }
      });
      result += '\n';
    }
    
    result += '---\n\n';
  });
  
  if (problems.length > 5) {
    result += `*Showing top 5 of ${problems.length} problems. See Detailed Findings section below for complete list.*\n\n`;
  }
  
  return result;
}

/**
 * Group findings by category and format as markdown
 */
function buildFindingsByCategoryMarkdown(findingsList) {
  // Group by category
  const byCategory = {
    interaction: [],
    navigation: [],
    form: [],
    state: [],
    feedback: [],
    other: []
  };
  
  findingsList.forEach(f => {
    const cat = f.category || 'other';
    byCategory[cat].push(f);
  });
  
  // Build markdown
  let result = '';
  
  if (byCategory.interaction.length > 0) {
    result += '### Interaction Issues\n\n';
    byCategory.interaction.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
    result += '\n';
  }
  
  if (byCategory.navigation.length > 0) {
    result += '### Navigation Issues\n\n';
    byCategory.navigation.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
    result += '\n';
  }
  
  if (byCategory.form.length > 0) {
    result += '### Form Issues\n\n';
    byCategory.form.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
    result += '\n';
  }
  
  if (byCategory.state.length > 0) {
    result += '### State Management Issues\n\n*State changes that don\'t produce visible UI updates (likely reactive rendering bugs):*\n\n';
    byCategory.state.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
    result += '\n';
  }
  
  if (byCategory.feedback.length > 0) {
    result += '### Missing Feedback\n\n*UI feedback elements that should appear but don\'t:*\n\n';
    byCategory.feedback.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
    result += '\n';
  }
  
  if (byCategory.other.length > 0) {
    result += '### Other Issues\n\n';
    byCategory.other.forEach((f, i) => {
      result += `**${i + 1}. ${f.title}**\n\n${f.content}\n\n`;
    });
  }
  
  return result.trim();
}

/**
 * Build human-readable findings list from findings object
 */
function buildFindingsList(findings, observeData) {
  if (!findings || !findings.findings) {
    return [];
  }
  
  const observeMap = buildObserveMap(observeData);
  
  return (findings.findings || []).slice(0, 100).map((finding) => {
    const observation = observeMap.get(finding.id);
    
    // Determine promise description based on promise.kind
    let promise = 'Unknown interaction';
    let category = 'other';
    
    if (finding.promise?.kind === 'click') {
      promise = `Click "${finding.promise.value}"`;
      category = 'interaction';
    } else if (finding.promise?.kind === 'submit') {
      promise = `Submit form`;
      category = 'form';
    } else if (finding.promise?.kind === 'navigate') {
      promise = `Navigate to ${finding.promise.value}`;
      category = 'navigation';
    } else if (finding.promise?.kind === 'state_mutation') {
      // State mutations that don't produce observable UI changes
      promise = `State change: ${finding.promise.value}`;
      category = 'state';
    } else if (finding.promise?.kind === 'validation') {
      promise = `Validation feedback: ${finding.promise.value}`;
      category = 'feedback';
    }
    
    let observed = 'No observable outcome';
    if (observation && observation.signals) {
      if (!observation.signals.navigationChanged && !observation.signals.domChanged && !observation.signals.feedbackSeen) {
        observed = 'Nothing visible happened';
      } else if (observation.signals.navigationChanged) {
        observed = 'Navigation changed (but not as expected)';
      } else if (observation.signals.domChanged) {
        observed = 'Page updated (but not as expected)';
      }
    }
    
    const noElementScreenshot = !finding.evidence?.some(e => e.path?.includes('_element'));
    const whiteScreenshot = finding.evidence?.some(e => e.type === 'screenshot' && e.available === false);
    
    return {
      id: finding.id,
      title: promise,
      category,
      interaction: finding.interaction || {},
      promise,
      observed,
      confidence: finding.confidence || 0.5,
      impact: finding.impact || 'UNKNOWN',
      source: finding.source,
      noElementScreenshot,
      whiteScreenshot,
      content: `
**Code location:** ${finding.source?.file || 'unknown'}:${finding.source?.line || '?'}

**Promise:** ${promise}  
**Observed:** ${observed}  
**Confidence:** ${Math.round((finding.confidence || 0.5) * 100)}%  
**Impact:** ${finding.impact || 'UNKNOWN'}

Evidence:
${
  (finding.evidence || [])
    .map(e => {
      const evidencePath = e.path ? e.path.replace(/^evidence\//i, 'EVIDENCE/') : null;
      if (e.type === 'screenshot') {
        return `- Screenshot: [\`${evidencePath || 'unknown'}\`](${evidencePath || '#'})`;
      } else if (e.type === 'dom-diff') {
        return `- DOM diff: [\`${evidencePath || 'unknown'}\`](${evidencePath || '#'})`;
      } else if (e.type === 'network') {
        return `- Network events captured`;
      } else if (e.type === 'console') {
        return `- Console errors captured`;
      }
      return null;
    })
    .filter(Boolean)
    .join('\n')
}

${
  finding.causes && finding.causes.length > 0
    ? `Likely Causes:
${finding.causes.map(c => `- **${c.title}** (${c.id}): ${c.statement}`).join('\n')}`
    : ''
}
`.trim()
    };
  });
}

/**
 * Build a map of observation IDs to observation data for quick lookup
 */
function buildObserveMap(observeData) {
  const map = new Map();
  
  if (observeData && observeData.observations) {
    observeData.observations.forEach(obs => {
      map.set(obs.id, obs);
    });
  }
  
  return map;
}

/**
 * Export for integration into detect phase
 */
export function integrateHumanSummary(runDir, url, srcDir, findings, learnData, observeData) {
  // Summary generation is MANDATORY - throw if it fails
  return writeSummaryMarkdown(runDir, url, srcDir, findings, learnData, observeData);
}








