import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { createBrowser, navigateToUrl, closeBrowser } from './browser.js';
import { discoverInteractions } from './interaction-discovery.js';
import { captureScreenshot } from './evidence-capture.js';
import { runInteraction } from './interaction-runner.js';
import { writeTraces } from './traces-writer.js';
import { getBaseOrigin } from './domain-boundary.js';

const MAX_SCAN_DURATION_MS = 60000;

export async function observe(url, manifestPath = null) {
  const { browser, page } = await createBrowser();
  const startTime = Date.now();
  const baseOrigin = getBaseOrigin(url);
  
  try {
    await navigateToUrl(page, url);
    
    const projectDir = manifestPath ? dirname(dirname(dirname(manifestPath))) : process.cwd();
    const observeDir = resolve(projectDir, '.veraxverax', 'observe');
    const screenshotsDir = resolve(observeDir, 'screenshots');
    mkdirSync(screenshotsDir, { recursive: true });
    
    const timestamp = Date.now();
    const initialScreenshot = resolve(screenshotsDir, `initial-${timestamp}.png`);
    await captureScreenshot(page, initialScreenshot);
    
    const { interactions, coverage } = await discoverInteractions(page, baseOrigin);
    const traces = [];
    const observeWarnings = [];
    if (coverage && coverage.capped) {
      observeWarnings.push({
        code: 'INTERACTIONS_CAPPED',
        message: 'Interaction discovery reached the cap (30). Scan coverage is incomplete.'
      });
    }
    
    for (let i = 0; i < interactions.length; i++) {
      if (Date.now() - startTime > MAX_SCAN_DURATION_MS) {
        break;
      }
      
      const trace = await runInteraction(page, interactions[i], timestamp, i, screenshotsDir, baseOrigin, startTime, MAX_SCAN_DURATION_MS);
      if (trace) {
        traces.push(trace);
      }
    }
    
    const observation = writeTraces(projectDir, url, traces, coverage, observeWarnings);
    
    await closeBrowser(browser);
    
    return {
      ...observation,
      screenshotsDir: screenshotsDir
    };
  } catch (error) {
    await closeBrowser(browser);
    throw error;
  }
}
