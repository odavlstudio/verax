import { resolve } from 'path';
import { captureScreenshot } from './evidence-capture.js';
import { isExternalUrl } from './domain-boundary.js';
import { captureDomSignature } from './dom-signature.js';

const INTERACTION_TIMEOUT_MS = 10000;
const NAVIGATION_TIMEOUT_MS = 15000;
const STABILIZATION_SAMPLE_MID_MS = 500;
const STABILIZATION_SAMPLE_END_MS = 1500;

function markTimeoutPolicy(trace, phase) {
  trace.policy = {
    ...(trace.policy || {}),
    timeout: true,
    reason: 'interaction_timeout',
    phase
  };
}

function computeDomChangedDuringSettle(samples) {
  if (!samples || samples.length < 3) {
    return false;
  }
  return samples[0] !== samples[1] || samples[1] !== samples[2];
}

async function captureSettledDom(page) {
  const samples = [];

  const sampleDom = async () => {
    const hash = await captureDomSignature(page);
    samples.push(hash);
  };

  await sampleDom();
  await page.waitForTimeout(STABILIZATION_SAMPLE_MID_MS);
  await sampleDom();
  await page.waitForTimeout(STABILIZATION_SAMPLE_END_MS - STABILIZATION_SAMPLE_MID_MS);
  await sampleDom();

  const domChangedDuringSettle = computeDomChangedDuringSettle(samples);

  return {
    samples,
    domChangedDuringSettle,
    afterHash: samples[samples.length - 1]
  };
}

export async function runInteraction(page, interaction, timestamp, i, screenshotsDir, baseOrigin, startTime, maxDurationMs) {
  const trace = {
    interaction: {
      type: interaction.type,
      selector: interaction.selector,
      label: interaction.label
    },
    before: {
      url: '',
      screenshot: ''
    },
    after: {
      url: '',
      screenshot: ''
    }
  };
  
  try {
    if (Date.now() - startTime > maxDurationMs) {
      trace.policy = { timeout: true, reason: 'max_scan_duration_exceeded' };
      return trace;
    }
    
    const beforeUrl = page.url();
    const beforeScreenshot = resolve(screenshotsDir, `before-${timestamp}-${i}.png`);
    await captureScreenshot(page, beforeScreenshot);
    const beforeDomHash = await captureDomSignature(page);
    
    trace.before.url = beforeUrl;
    trace.before.screenshot = `screenshots/before-${timestamp}-${i}.png`;
    if (beforeDomHash) {
      trace.dom = { beforeHash: beforeDomHash };
    }
    
    if (interaction.isExternal && interaction.type === 'link') {
      const href = await interaction.element.getAttribute('href');
      const resolvedUrl = href.startsWith('http') ? href : new URL(href, beforeUrl).href;
      
      trace.policy = {
        externalNavigationBlocked: true,
        blockedUrl: resolvedUrl
      };
      
      const { settleResult, afterUrl } = await captureAfterState(page, screenshotsDir, timestamp, i, trace);
      trace.after.url = afterUrl;
      trace.after.screenshot = `screenshots/after-${timestamp}-${i}.png`;
      if (!trace.dom) {
        trace.dom = {};
      }
      if (settleResult.afterHash) {
        trace.dom.afterHash = settleResult.afterHash;
      }
      trace.dom.settle = {
        samples: settleResult.samples,
        domChangedDuringSettle: settleResult.domChangedDuringSettle
      };
      
      return trace;
    }

    const clickPromise = interaction.element.click({ timeout: INTERACTION_TIMEOUT_MS });
    const shouldWaitForNavigation = interaction.type === 'link' || interaction.type === 'form';
    const navigationPromise = shouldWaitForNavigation
      ? page.waitForNavigation({ timeout: NAVIGATION_TIMEOUT_MS, waitUntil: 'domcontentloaded' })
          .catch((error) => {
            if (error && error.name === 'TimeoutError') {
              markTimeoutPolicy(trace, 'navigation');
            }
            return null;
          })
      : null;

    try {
      await Promise.race([
        clickPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')),
          INTERACTION_TIMEOUT_MS))
      ]);
    } catch (error) {
      if (error.message === 'timeout' || error.name === 'TimeoutError') {
        markTimeoutPolicy(trace, 'click');
        await captureAfterOnly(page, screenshotsDir, timestamp, i, trace);
        return trace;
      }
      throw error;
    }

    const navigationResult = navigationPromise ? await navigationPromise : null;

    if (navigationResult) {
      const afterUrl = page.url();
      if (isExternalUrl(afterUrl, baseOrigin)) {
        await page.goBack({ timeout: NAVIGATION_TIMEOUT_MS }).catch(() => {});
        trace.policy = {
          ...(trace.policy || {}),
          externalNavigationBlocked: true,
          blockedUrl: afterUrl
        };
      }
    }

    const { settleResult, afterUrl } = await captureAfterState(page, screenshotsDir, timestamp, i, trace);
    trace.after.url = afterUrl;
    trace.after.screenshot = `screenshots/after-${timestamp}-${i}.png`;
    if (!trace.dom) {
      trace.dom = {};
    }
    if (settleResult.afterHash) {
      trace.dom.afterHash = settleResult.afterHash;
    }
    trace.dom.settle = {
      samples: settleResult.samples,
      domChangedDuringSettle: settleResult.domChangedDuringSettle
    };

    return trace;
  } catch (error) {
    if (error.message === 'timeout' || error.name === 'TimeoutError') {
      markTimeoutPolicy(trace, 'click');
      await captureAfterOnly(page, screenshotsDir, timestamp, i, trace);
      return trace;
    }

    return null;
  }
}

async function captureAfterState(page, screenshotsDir, timestamp, interactionIndex, trace) {
  let settleResult = {
    samples: [],
    domChangedDuringSettle: false,
    afterHash: null
  };

  try {
    settleResult = await captureSettledDom(page);
  } catch (error) {
    if (error.message === 'timeout' || error.name === 'TimeoutError') {
      markTimeoutPolicy(trace, 'settle');
    }
  }

  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  await captureScreenshot(page, afterScreenshot);

  return { settleResult, afterUrl };
}

async function captureAfterOnly(page, screenshotsDir, timestamp, interactionIndex, trace) {
  const afterUrl = page.url();
  const afterScreenshot = resolve(screenshotsDir, `after-${timestamp}-${interactionIndex}.png`);
  try {
    await captureScreenshot(page, afterScreenshot);
    const afterDomHash = await captureDomSignature(page);
    trace.after.url = afterUrl;
    trace.after.screenshot = `screenshots/after-${timestamp}-${interactionIndex}.png`;
    if (afterDomHash) {
      if (!trace.dom) {
        trace.dom = {};
      }
      trace.dom.afterHash = afterDomHash;
    }
  } catch (e) {
    // Ignore screenshot errors on timeout
  }
}

