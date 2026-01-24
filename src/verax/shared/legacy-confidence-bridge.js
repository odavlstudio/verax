/**
 * Legacy Confidence Engine Bridge - Cross-Layer Compatibility
 * 
 * This module provides backward compatibility access to the legacy confidence
 * engine implementation for use across layers.
 * 
 * NOTE: The canonical entry point is core/confidence/index.js
 * This bridge is provided only for backward compatibility with existing code.
 */

// Re-export legacy confidence implementation for cross-layer use
export { computeConfidence } from '../detect/confidence-engine.legacy.js';
