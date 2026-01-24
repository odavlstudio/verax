/**
 * PHASE: Pipeline Stage Tracker
 * 
 * Enforces explicit, single execution path with stage-by-stage tracking.
 * Every stage must be recorded in run.meta.json with timestamp.
 * No stage may execute without being recorded.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getTimeProvider } from '../../cli/util/support/time-provider.js';

import { dirname } from 'path';
import { getArtifactPath } from './run-id.js';
import { computeRunFingerprint } from './determinism/run-fingerprint.js';
import { ARTIFACT_REGISTRY } from './artifacts/registry.js';

const PIPELINE_STAGES = {
  LEARN: 'LEARN',
  OBSERVE: 'OBSERVE',
  DETECT: 'DETECT',
  WRITE: 'WRITE',
  VERIFY: 'VERIFY',
  VERDICT: 'VERDICT'
};

const STAGE_ORDER = [
  PIPELINE_STAGES.LEARN,
  PIPELINE_STAGES.OBSERVE,
  PIPELINE_STAGES.DETECT,
  PIPELINE_STAGES.WRITE,
  PIPELINE_STAGES.VERIFY,
  PIPELINE_STAGES.VERDICT
];

/**
 * Pipeline Stage Tracker
 * 
 * Enforces single, explicit execution path with mandatory stage recording.
 */
export class PipelineTracker {
  constructor(projectDir, runId, runFingerprintParams = null) {
    this.projectDir = projectDir;
    this.runId = runId;
    this.stages = {};
    this.currentStage = null;
    this.completedStages = [];
    this.metaPath = getArtifactPath(projectDir, runId, 'run.meta.json');
    this.runFingerprintParams = runFingerprintParams;
  }

  /**
   * Start a pipeline stage
   * 
   * @param {string} stageName - Stage name (must be from PIPELINE_STAGES)
   * @throws {Error} If stage is invalid or out of order
   */
  startStage(stageName) {
    if (!Object.values(PIPELINE_STAGES).includes(stageName)) {
      throw new Error(`Invalid pipeline stage: ${stageName}`);
    }

    const stageIndex = STAGE_ORDER.indexOf(stageName);
    if (stageIndex === -1) {
      throw new Error(`Unknown pipeline stage: ${stageName}`);
    }

    if (this.currentStage !== null) {
      throw new Error(`Cannot start ${stageName}: ${this.currentStage} is still active`);
    }

    const expectedIndex = this.completedStages.length;
    if (stageIndex !== expectedIndex) {
      throw new Error(`Pipeline stage out of order: expected ${STAGE_ORDER[expectedIndex]}, got ${stageName}`);
    }

    this.currentStage = stageName;
    this.stages[stageName] = {
      name: stageName,
      startedAt: getTimeProvider().iso(),
      completedAt: null,
      durationMs: null,
      status: 'RUNNING'
    };

    this._writeMeta();
  }

  /**
   * Complete a pipeline stage
   * 
   * @param {string} stageName - Stage name (must match current stage)
   * @param {Object} metadata - Optional stage metadata
   * @throws {Error} If stage name doesn't match current stage
   */
  completeStage(stageName, metadata = {}) {
    if (this.currentStage !== stageName) {
      throw new Error(`Cannot complete ${stageName}: current stage is ${this.currentStage}`);
    }

    const completedAt = getTimeProvider().iso();
    const startedAt = Date.parse(this.stages[stageName].startedAt);
    const durationMs = Date.parse(completedAt) - startedAt;

    this.stages[stageName] = {
      ...this.stages[stageName],
      completedAt,
      durationMs,
      status: 'COMPLETE',
      ...metadata
    };

    this.completedStages.push(stageName);
    this.currentStage = null;

    this._writeMeta();
  }

  /**
   * Fail a pipeline stage
   * 
   * @param {string} stageName - Stage name (must match current stage)
   * @param {Error|string} error - Error object or message
   * @throws {Error} If stage name doesn't match current stage
   */
  failStage(stageName, error) {
    if (this.currentStage !== stageName) {
      throw new Error(`Cannot fail ${stageName}: current stage is ${this.currentStage}`);
    }

    const completedAt = getTimeProvider().iso();
    const startedAt = Date.parse(this.stages[stageName].startedAt);
    const durationMs = Date.parse(completedAt) - startedAt;

    this.stages[stageName] = {
      ...this.stages[stageName],
      completedAt,
      durationMs,
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null
    };

    this.completedStages.push(stageName);
    this.currentStage = null;

    this._writeMeta();
  }

  /**
   * Get current stage
   * 
   * @returns {string|null} Current stage name or null
   */
  getCurrentStage() {
    return this.currentStage;
  }

  /**
   * Get stage execution data
   * 
   * @param {string} stageName - Stage name
   * @returns {Object|null} Stage data or null if not executed
   */
  getStage(stageName) {
    return this.stages[stageName] || null;
  }

  /**
   * Get all stages
   * 
   * @returns {Object} Map of stage names to stage data
   */
  getAllStages() {
    return { ...this.stages };
  }

  /**
   * Check if a stage has completed
   * 
   * @param {string} stageName - Stage name
   * @returns {boolean} True if stage completed
   */
  hasCompleted(stageName) {
    return this.completedStages.includes(stageName);
  }

  /**
   * Check if verification has completed (required before verdict)
   * 
   * @returns {boolean} True if verification completed
   */
  hasVerificationCompleted() {
    return this.hasCompleted(PIPELINE_STAGES.VERIFY);
  }

  /**
   * Write run.meta.json with stage execution data
   */
  _writeMeta() {
    // Ensure directory exists
    try {
      mkdirSync(dirname(this.metaPath), { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }
    
    let existingMeta = {};
    try {
      const content = readFileSync(this.metaPath, 'utf-8');
  // @ts-expect-error - readFileSync with encoding returns string
      existingMeta = JSON.parse(content);
    } catch {
      existingMeta = {};
    }

    // PHASE 25: Compute run fingerprint if params provided
    let runFingerprint = existingMeta.runFingerprint || null;
    if (this.runFingerprintParams && !runFingerprint) {
      runFingerprint = computeRunFingerprint({
        ...this.runFingerprintParams,
        projectDir: this.projectDir
      });
    }
    
    const updatedMeta = {
      ...existingMeta,
      contractVersion: ARTIFACT_REGISTRY.runMeta.contractVersion,
      runId: this.runId,
      runFingerprint,
      pipeline: {
        stages: this.stages,
        completedStages: this.completedStages,
        currentStage: this.currentStage,
        lastUpdated: getTimeProvider().iso()
      }
    };

    writeFileSync(this.metaPath, JSON.stringify(updatedMeta, null, 2) + '\n', 'utf-8');
  }
}

export { PIPELINE_STAGES, STAGE_ORDER };




