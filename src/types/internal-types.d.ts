/**
 * Internal type definitions for VERAX
 * Focused surface needed for TypeScript tooling used by observation pipeline
 * 
 * @typedef {Object} ObserveContext
 * @property {string} url
 * @property {string} projectDir
 * @property {string} runId
 * @property {SilenceTracker} silenceTracker
 * @property {*} decisionRecorder
 * @property {*} scanBudget
 * 
 * @typedef {Object} RunState
 * @property {number} totalInteractions
 * @property {number} totalPages
 * @property {number} startTime
 * 
 * @typedef {Object} SilenceTracker
 * @property {function(*): void} record
 * @property {function(): *} getSilenceReport
 * 
 * @typedef {Object} PageFrontier
 * @property {function(string, *=): void} addPage
 * @property {function(): *} getNextPage
 * @property {function(): boolean} hasPages
 * 
 * @typedef {Object} Observation
 * @property {string} type
 * @property {*} data
 * @property {number=} timestamp
 */

// Export as module
export {};

