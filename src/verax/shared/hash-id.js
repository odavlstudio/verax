/**
 * Hash ID Generation - Cross-Layer Utility
 * 
 * VERAX CONSTITUTION: No Date.now(), No Math.random() in production runtime.
 * All IDs must be deterministic given identical inputs.
 * 
 * This module re-exports the core hash ID functionality for use across layers
 * without violating layer architecture constraints.
 */

// Re-export from observe layer's implementation
export { stableHashId } from '../observe/stable-id.js';
