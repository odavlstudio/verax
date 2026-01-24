/**
 * Detector Registry
 * 
 * Centralized registry for all framework detectors with deterministic registration order.
 * Used by detection engine and test suite for comprehensive detector inventory.
 * 
 * DESIGN:
 * - No external initialization dependencies
 * - Deterministic registration order for stable output
 * - Preserves legacy function API while introducing BaseDetector classes
 * - Zero behavior change: same outputs as before
 */

import { AngularStateDetector } from './angular-state-detector.js';
import { AngularNetworkDetector } from './angular-network-detector.js';
import { AngularNavigationDetector } from './angular-navigation-detector.js';
import { SvelteStateDetector } from './svelte-state-detector.js';
import { SvelteNetworkDetector } from './svelte-network-detector.js';
import { SvelteNavigationDetector } from './svelte-navigation-detector.js';
import { VueStateDetector } from './vue-state-detector.js';
import { VueNavigationDetector } from './vue-navigation-detector.js';
import { ReactObservableDetector } from './react-observable-detector.js';
import { NextJsObservableDetector } from './nextjs-observable-detector.js';
import { VueObservableDetector } from './vue-observable-detector.js';

/**
 * Detector registry: deterministic, ordered list of all detectors
 * Order: Angular, Svelte, Vue, React, Next.js
 * Type: State, Network, Navigation, Observable
 */
export const DETECTOR_REGISTRY = [
  // Angular detectors
  { detector: new AngularStateDetector(), name: 'angular-state', framework: 'angular', type: 'state' },
  { detector: new AngularNetworkDetector(), name: 'angular-network', framework: 'angular', type: 'network' },
  { detector: new AngularNavigationDetector(), name: 'angular-navigation', framework: 'angular', type: 'navigation' },
  
  // Svelte detectors
  { detector: new SvelteStateDetector(), name: 'svelte-state', framework: 'svelte', type: 'state' },
  { detector: new SvelteNetworkDetector(), name: 'svelte-network', framework: 'svelte', type: 'network' },
  { detector: new SvelteNavigationDetector(), name: 'svelte-navigation', framework: 'svelte', type: 'navigation' },
  
  // Vue detectors
  { detector: new VueStateDetector(), name: 'vue-state', framework: 'vue', type: 'state' },
  { detector: new VueNavigationDetector(), name: 'vue-navigation', framework: 'vue', type: 'navigation' },
  
  // React observable detectors
  { detector: new ReactObservableDetector(), name: 'react-observable', framework: 'react', type: 'observable' },

  // Next.js observable detectors
  { detector: new NextJsObservableDetector(), name: 'nextjs-observable', framework: 'nextjs', type: 'observable' },

  // Vue observable detectors
  { detector: new VueObservableDetector(), name: 'vue-observable', framework: 'vue', type: 'observable' },
];

/**
 * Get all detectors in deterministic order
 * @returns {Array} Array of detector objects with metadata
 */
export function getAllDetectors() {
  return [...DETECTOR_REGISTRY];
}

/**
 * Get detectors by framework
 * @param {string} framework - Framework name (angular, vue, svelte, react, nextjs)
 * @returns {Array} Detectors for this framework in registration order
 */
export function getDetectorsByFramework(framework) {
  return DETECTOR_REGISTRY.filter(item => item.framework === framework);
}

/**
 * Get detectors by type
 * @param {string} type - Detector type (state, network, navigation, observable)
 * @returns {Array} Detectors of this type in registration order
 */
export function getDetectorsByType(type) {
  return DETECTOR_REGISTRY.filter(item => item.type === type);
}

/**
 * Get detector by name
 * @param {string} name - Detector name
 * @returns {Object|null} Detector object or null if not found
 */
export function getDetectorByName(name) {
  return DETECTOR_REGISTRY.find(item => item.name === name) || null;
}

export default DETECTOR_REGISTRY;








