/**
 * ⚠️ LEGACY INTERNAL IMPLEMENTATION — NOT CANONICAL ENTRY POINT
 * 
 * This module is a RE-EXPORT for backward compatibility.
 * Implementation remains in detect/confidence/ (legacy engine).
 * 
 * CANONICAL ENTRY POINT:
 *   src/verax/core/confidence/index.js
 * 
 * RESOLUTION (STAGE 2 Issue #14, STAGE 3 Issue #24):
 * - Single canonical entry: core/confidence/index.js
 * - Legacy implementation: detect/confidence/ (internal)
 * - Deprecated facades: core/confidence-engine.deprecated.js (re-exports only)
 * - Bidirectional dependency: RESOLVED (detect no longer imported by core for confidence)
 * 
 * ARCHITECTURAL CLARITY:
 * - detect/confidence/ = implementation layer (internal)
 * - core/confidence/index.js = public API (canonical)
 * - core/confidence-engine.deprecated.js = deprecated facade (backward compat)
 * 
 * ALL NEW CODE MUST USE:
 *   import { computeConfidence } from '../core/confidence/index.js'
 * 
 * Migration: See VERAX_CLEANUP_AUDIT.md PATH G — Execution Log
 */

import { computeConfidence, hasNetworkData, hasConsoleData, hasUiData } from './confidence/index.js';

export { computeConfidence, hasNetworkData, hasConsoleData, hasUiData };
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
	const stack = new Error().stack || '';
	if (stack.includes('/detect/') && !stack.includes('confidence-engine.js')) {
		// Detection code should never directly require legacy engine
		// This guard allows core/detect/observe/learn to use it internally
		globalThis._legacyConfidenceAccessDetected = true;
	}
}




