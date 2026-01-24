/**
 * interaction-runner-sensors.js
 * 
 * Sensor initialization and lifecycle management for interaction observation.
 * Extracted from interaction-runner.js to reduce file complexity.
 * 
 * CONSTITUTIONAL GUARANTEE:
 * - All functions preserve exact behavior from original implementation
 * - No changes to timing, ordering, or sensor configuration
 * - Deterministic sensor initialization maintained
 */

import { NetworkSensor } from './network-sensor.js';
import { ConsoleSensor } from './console-sensor.js';
import { UISignalSensor } from './ui-signal-sensor.js';
import { StateSensor } from './state-sensor.js';
import { NavigationSensor } from './navigation-sensor.js';
import { LoadingSensor } from './loading-sensor.js';
import { FocusSensor } from './focus-sensor.js';
import { AriaSensor } from './aria-sensor.js';
import { TimingSensor } from './timing-sensor.js';
import { HumanBehaviorDriver } from './interaction-driver.js';
import { resolve } from 'path';
import { captureScreenshot } from './evidence-capture.js';
import { captureDomSignature } from './dom-signature.js';
import { captureSuccess, captureFailure } from './capture-outcome.js';

/**
 * PHASE 1: Initialize all sensors for evidence collection
 * EVIDENCE: Creates sensor instances with deterministic configuration
 * @returns {Object} Initialized sensor instances
 */
export function initializeSensors(scanBudget) {
  // EVIDENCE: All sensors initialized with explicit configuration
  return {
    networkSensor: new NetworkSensor(),
    consoleSensor: new ConsoleSensor(),
    uiSignalSensor: new UISignalSensor(),
    stateSensor: new StateSensor(),
    navigationSensor: new NavigationSensor(),
    loadingSensor: new LoadingSensor({ loadingTimeout: 5000 }),
    focusSensor: new FocusSensor(),
    ariaSensor: new AriaSensor(),
    timingSensor: new TimingSensor({
      feedbackGapThresholdMs: 1500,
      freezeLikeThresholdMs: 3000
    }),
    humanDriver: new HumanBehaviorDriver({}, scanBudget)
  };
}

/**
 * PHASE 2: Capture initial page state before interaction
 * EVIDENCE: URL, screenshot, DOM signature, page title, UI snapshot
 * @returns {Promise<Object>} Before-state evidence
 */
export async function captureBeforeState(page, screenshotsDir, timestamp, i, sensors) {
  // EVIDENCE: captured because we need baseline for comparison
  const beforeUrl = page.url();
  const beforeScreenshot = resolve(screenshotsDir, `before-${timestamp}-${i}.png`);
  const captureOutcomes = [];
  await captureScreenshot(page, beforeScreenshot);
  captureOutcomes.push(captureSuccess('screenshot', `screenshots/before-${timestamp}-${i}.png`, 'BEFORE_SCREENSHOT'));
  const beforeDomHash = await captureDomSignature(page);
  if (beforeDomHash) {
    captureOutcomes.push(captureSuccess('dom', beforeDomHash, 'DOM_SIGNATURE'));
  } else {
    captureOutcomes.push(captureFailure('dom', 'DOM signature capture returned null', 'DOM_SIGNATURE'));
  }
  const beforeTitle = typeof page.title === 'function' ? await page.title().catch(() => null) : (page.title || null);
  const uiBefore = await sensors.uiSignalSensor.snapshot(page).catch(() => ({}));
  captureOutcomes.push(captureSuccess('uiSignals', uiBefore, 'UISIGNALS'));
  
  return {
    beforeUrl,
    beforeScreenshot: `screenshots/before-${timestamp}-${i}.png`,
    beforeDomHash,
    beforeTitle,
    uiBefore,
    captureOutcomes
  };
}

/**
 * PHASE 3: Start all active sensors for evidence collection
 * EVIDENCE: Activates listeners for network, console, state, navigation, loading, focus, ARIA
 * MUTATES: sensor instances (activates listeners)
 * @returns {Promise<Object>} Sensor window IDs and activation state
 */
export async function startSensorCollection(page, sensors) {
  // A11Y INTELLIGENCE: Capture focus and ARIA state before interaction
  await sensors.focusSensor.captureBefore(page);
  await sensors.ariaSensor.captureBefore(page);
  
  // PERFORMANCE INTELLIGENCE: Start timing sensor
  sensors.timingSensor.startTiming();
  
  // NAVIGATION INTELLIGENCE v2: Inject tracking script and start navigation sensor
  await sensors.navigationSensor.injectTrackingScript(page);
  const navigationWindowId = sensors.navigationSensor.startWindow(page);
  
  // STATE INTELLIGENCE: Detect and activate state sensor if supported stores found
  const stateDetection = await sensors.stateSensor.detect(page);
  const stateSensorActive = stateDetection.detected;
  if (stateSensorActive) {
    await sensors.stateSensor.captureBefore(page);
  }
  
  const networkWindowId = sensors.networkSensor.startWindow(page);
  const consoleWindowId = sensors.consoleSensor.startWindow(page);
  
  // ASYNC INTELLIGENCE: Start loading sensor for async detection
  const loadingWindowData = sensors.loadingSensor.startWindow(page);
  
  return {
    networkWindowId,
    consoleWindowId,
    navigationWindowId,
    stateSensorActive,
    loadingWindowData
  };
}
