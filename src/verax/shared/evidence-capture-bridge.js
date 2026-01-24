/**
 * Evidence Capture Service - Cross-Layer Utilities
 * 
 * This module provides cross-layer evidence capture functions for use across
 * layers without violating layer architecture constraints.
 * 
 * Core functionality is implemented in observe layer; this module serves as
 * a stable interface for other layers.
 */

// Re-export screenshot capture for cross-layer use
export { captureScreenshot } from '../observe/evidence-capture.js';

// Re-export DOM signature capture for cross-layer use  
export { captureDomSignature } from '../observe/dom-signature.js';
