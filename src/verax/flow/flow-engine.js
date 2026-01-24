/**
 * Wave 7 — Flow Engine
 *
 * Executes deterministic multi-step flows with strict safety gates.
 * - No guessing: explicit selectors and expected outcomes only
 * - Safety gates: denyKeywords, allowlist enforcement
 * - Per-step sensor capture: network, console, UI signals
 * - Deterministic: uses waitForSettle after each interactive step
 */

import { waitForSettle } from '../observe/wait-for-settle.js';
import { resolveSecrets, extractSecretValues } from './flow-spec.js';
import { redactObject } from './redaction.js';

/**
 * Execute a flow on a Playwright page.
 *
 * @param {Object} page - Playwright page
 * @param {Object} spec - Validated flow spec
 * @param {Object} sensors - Sensor collectors {network, console, etc.}
 * @returns {Promise<Object>} - {success, findings, stepResults}
 */
export async function executeFlow(page, spec, sensors = {}) {
  const secretValues = extractSecretValues(spec.secrets);
  const stepResults = [];
  const findings = [];

  try {
    for (let idx = 0; idx < spec.steps.length; idx++) {
      const step = spec.steps[idx];
      const stepResult = await executeStep(page, step, idx, spec, sensors, secretValues);

      stepResults.push(stepResult);

      if (!stepResult.success) {
        findings.push({
          type: stepResult.findingType,
          stepIndex: idx,
          stepType: step.type,
          reason: stepResult.reason,
          evidence: redactObject(stepResult.evidence, secretValues)
        });

        // Stop on first failure
        if (step.failureMode !== 'continue') {
          break;
        }
      }
    }
  } catch (err) {
    findings.push({
      type: 'flow_step_failed',
      stepIndex: -1,
      reason: `Unexpected error: ${err.message}`,
      evidence: { error: err.toString() }
    });
  }

  return {
    success: findings.length === 0,
    findings,
    stepResults: stepResults.map(r => redactObject(r, secretValues))
  };
}

async function executeStep(page, step, idx, spec, _sensors, _secretValues) {
  const baseResult = {
    stepIndex: idx,
    type: step.type,
    success: false,
    reason: '',
    evidence: {}
  };

  try {
    switch (step.type) {
      case 'goto':
        return await stepGoto(page, step, baseResult, spec);

      case 'fill':
        return await stepFill(page, step, baseResult, spec);

      case 'click':
        return await stepClick(page, step, baseResult, spec);

      case 'expect':
        return await stepExpect(page, step, baseResult);

      default:
        baseResult.reason = `Unknown step type: ${step.type}`;
        baseResult.findingType = 'flow_step_failed';
        return baseResult;
    }
  } catch (err) {
    baseResult.reason = err.message;
    baseResult.findingType = 'flow_step_failed';
    baseResult.evidence = { error: err.toString() };
    return baseResult;
  }
}

async function stepGoto(page, step, result, spec) {
  const url = new URL(step.url, spec.baseUrl).toString();

  // Check allowlist
  try {
    const urlObj = new URL(url);
    const domainAllowed = spec.allowlist.domains.length === 0 ||
      spec.allowlist.domains.some(d => urlObj.hostname.includes(d) || urlObj.hostname === d);

    if (!domainAllowed) {
      result.reason = `Domain ${urlObj.hostname} not in allowlist`;
      result.findingType = 'unexpected_navigation';
      result.evidence = { url, allowedDomains: spec.allowlist.domains };
      return result;
    }

    const pathAllowed = spec.allowlist.pathsPrefix.length === 0 ||
      spec.allowlist.pathsPrefix.some(prefix => urlObj.pathname.startsWith(prefix));

    if (!pathAllowed) {
      result.reason = `Path ${urlObj.pathname} does not match allowlist prefixes`;
      result.findingType = 'unexpected_navigation';
      result.evidence = { url, allowedPrefixes: spec.allowlist.pathsPrefix };
      return result;
    }
  } catch (err) {
    result.reason = `Invalid URL: ${url}`;
    result.findingType = 'flow_step_failed';
    result.evidence = { url, error: err.message };
    return result;
  }

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await waitForSettle(page, { timeoutMs: 3000, settleMs: 500 });

  result.success = true;
  result.evidence = { url };
  return result;
}

async function stepFill(page, step, result, spec) {
  const selector = step.selector;
  const resolvedValue = resolveSecrets(step.value, spec.secrets);

  // Check if element exists
  const element = await page.$(selector);
  if (!element) {
    result.reason = `Selector not found: ${selector}`;
    result.findingType = 'flow_step_failed';
    result.evidence = { selector };
    return result;
  }

  // Fill the field
  await element.fill(resolvedValue);
  await waitForSettle(page, { timeoutMs: 2000, settleMs: 300 });

  result.success = true;
  result.evidence = { selector };
  // NOTE: resolved value NOT stored in evidence for security
  return result;
}

async function stepClick(page, step, result, spec) {
  const selector = step.selector;

  // Check if element exists
  const element = await page.$(selector);
  if (!element) {
    result.reason = `Selector not found: ${selector}`;
    result.findingType = 'flow_step_failed';
    result.evidence = { selector };
    return result;
  }

  // Check for deny keywords in element text/aria-label
  // Use textContent instead of innerText for better compatibility
  let elementText = await page.evaluate(el => el.textContent || '', element);
  let elementAriaLabel = '';
  let elementValue = '';

  try {
    elementAriaLabel = await element.getAttribute('aria-label') || '';
  } catch (e) {
    // Ignore
  }

  try {
    elementValue = await element.getAttribute('value') || '';
  } catch (e) {
    // Ignore
  }

  const fullContent = `${elementText} ${elementAriaLabel} ${elementValue}`.toLowerCase();

  const denyKeywords = spec.denyKeywords || [];
  for (const keyword of denyKeywords) {
    if (fullContent.includes(keyword.toLowerCase())) {
      result.reason = `Click blocked by safety gate: denyKeyword "${keyword}" found in element`;
      result.findingType = 'blocked_by_safety_gate';
      result.evidence = { selector, keyword, elementText: '***REDACTED***' };
      return result;
    }
  }

  // Click the element
  await element.click();
  await waitForSettle(page, { timeoutMs: 3000, settleMs: 500 });

  result.success = true;
  result.evidence = { selector };
  return result;
}

async function stepExpect(page, step, result) {
  try {
    if (step.kind === 'selector') {
      const element = await page.$(step.selector);
      if (!element) {
        result.reason = `Expected selector not found: ${step.selector}`;
        result.findingType = 'flow_step_failed';
        result.evidence = { selector: step.selector };
        return result;
      }
      result.success = true;
      result.evidence = { selector: step.selector };
      return result;
    }

    if (step.kind === 'url') {
      const url = page.url();
      if (!url.includes(step.prefix)) {
        result.reason = `Expected URL prefix not found. Current: ${url}, Expected prefix: ${step.prefix}`;
        result.findingType = 'flow_step_failed';
        result.evidence = { currentUrl: url, expectedPrefix: step.prefix };
        return result;
      }
      result.success = true;
      result.evidence = { url, expectedPrefix: step.prefix };
      return result;
    }

    if (step.kind === 'route') {
      const url = new URL(page.url());
      if (url.pathname !== step.path) {
        result.reason = `Expected route not matched. Current: ${url.pathname}, Expected: ${step.path}`;
        result.findingType = 'flow_step_failed';
        result.evidence = { currentPath: url.pathname, expectedPath: step.path };
        return result;
      }
      result.success = true;
      result.evidence = { path: url.pathname };
      return result;
    }
  } catch (err) {
    result.reason = err.message;
    result.findingType = 'flow_step_failed';
    result.evidence = { error: err.toString() };
    return result;
  }

  result.reason = `Unknown expect kind: ${step.kind}`;
  result.findingType = 'flow_step_failed';
  return result;
}



