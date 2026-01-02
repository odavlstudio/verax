/**
 * Human Journey Context
 * Stateful model of a human user's journey across attempts.
 * Deterministic (seeded) evolution of frustration, confidence, and adaptation choices.
 */

const { SeededRandom } = require('./human-interaction-model');

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function hashString(str) {
  const s = String(str || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

class HumanJourneyContext {
  constructor({ baseUrl, primaryGoal = 'EXPLORE', secondaryGoals = [], intentConfidence = 0.5 } = {}) {
    this.baseUrl = baseUrl || 'unknown';
    this.primaryGoal = primaryGoal;
    this.secondaryGoals = secondaryGoals;
    this.intentConfidence = clamp(intentConfidence, 0, 1);
    this.seed = (hashString(baseUrl || 'unknown') % 0x7fffffff) || 7;
    this.startTime = Date.now();

    this.stage = 'entry';
    this.frustration = 10; // start calm
    this.confidence = Math.round(this.intentConfidence * 100) || 30;
    this.frustrationThreshold = 75 + this._rngFor('threshold').nextInt(-5, 10); // 70-85 deterministic window
    this.maxJourneyMs = 90_000; // hard cap per run

    this.visitedPages = new Set();
    this.failures = [];
    this.attemptPath = [];
    this.lastDecision = null;
    this.completedGoal = false;
  }

  _rngFor(key) {
    const seed = (this.seed + hashString(key)) % 0x7fffffff;
    return new SeededRandom(seed);
  }

  _recordVisitedFromSteps(steps) {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      if (step && step.type === 'navigate' && step.target) {
        this.visitedPages.add(step.target);
      }
    }
  }

  beforeAttempt(attemptId) {
    this.stage = this.stage === 'entry' ? 'exploration' : this.stage;
    this.currentAttempt = attemptId;
  }

  afterAttempt(result, attemptDef = {}) {
    const outcome = String(result?.outcome || 'UNKNOWN').toUpperCase();
    const attemptId = result?.attemptId || this.currentAttempt || 'unknown';
    const rng = this._rngFor(`${attemptId}:${outcome}`);

    this._recordVisitedFromSteps(result?.steps || []);
    const durationMs = result?.totalDurationMs || result?.attemptResult?.totalDurationMs || 0;
    const errorMessage = result?.error || result?.skipReason || null;

    this.attemptPath.push({
      attemptId,
      outcome,
      durationMs,
      reason: errorMessage,
      goal: attemptDef.goal || null
    });

    const baseDelta = {
      SUCCESS: -10,
      FRICTION: 12,
      FAILURE: 18,
      NOT_APPLICABLE: 6,
      DISCOVERY_FAILED: 15,
      SKIPPED: 4,
      UNKNOWN: 8
    }[outcome] ?? 8;

    const jitter = rng.nextInt(-3, 5);
    this.frustration = clamp(this.frustration + baseDelta + jitter, 0, 100);

    // Confidence moves inversely to frustration, slightly weighted by success/failure
    const confidenceDelta = {
      SUCCESS: 8,
      FRICTION: -6,
      FAILURE: -10,
      NOT_APPLICABLE: -3,
      DISCOVERY_FAILED: -8,
      SKIPPED: -2,
      UNKNOWN: -5
    }[outcome] ?? -4;
    this.confidence = clamp(this.confidence + confidenceDelta, 5, 100);

    if (outcome === 'SUCCESS') {
      this.stage = 'success';
      this.completedGoal = true;
    } else if (outcome === 'FAILURE' || outcome === 'FRICTION' || outcome === 'DISCOVERY_FAILED') {
      this.stage = 'adaptation';
      this.failures.push({ attemptId, outcome, reason: errorMessage });
    } else if (outcome === 'NOT_APPLICABLE' || outcome === 'SKIPPED') {
      this.stage = 'exploration';
    }

    this.lastDecision = outcome;
  }

  shouldAbandonJourney() {
    const timeSpentMs = Date.now() - this.startTime;
    const timeLimitReached = timeSpentMs > this.maxJourneyMs;
    return this.frustration >= this.frustrationThreshold || timeLimitReached;
  }

  reachedGoal() {
    return Boolean(this.completedGoal);
  }

  suggestNextAttempts({ attemptId, attemptResult }) {
    const outcome = String(attemptResult?.outcome || '').toUpperCase();
    if (this.shouldAbandonJourney() || outcome === 'SUCCESS') return [];

    const fallbackMap = {
      checkout: ['contact_discovery_v2', 'contact_form'],
      signup: ['primary_ctas', 'contact_discovery_v2', 'contact_form'],
      login: ['primary_ctas', 'contact_discovery_v2', 'contact_form'],
      newsletter_signup: ['contact_discovery_v2', 'contact_form'],
      primary_ctas: ['contact_discovery_v2'],
      site_smoke: ['primary_ctas']
    };

    const defaults = ['site_smoke', 'primary_ctas'];
    const candidateList = fallbackMap[attemptId] || [];

    // If primary goal is BUY and checkout failed, ensure contact path
    if (this.primaryGoal === 'BUY' && !candidateList.includes('checkout')) {
      candidateList.push('checkout');
    }

    // If we have no candidates and still not successful, explore defaults
    if (candidateList.length === 0) {
      candidateList.push(...defaults);
    }

    // Deterministic ordering: remove duplicates while preserving order
    const seen = new Set();
    const ordered = [];
    for (const cand of candidateList) {
      if (cand && !seen.has(cand)) {
        seen.add(cand);
        ordered.push(cand);
      }
    }
    return ordered;
  }

  summarize() {
    return {
      stage: this.stage,
      frustration: this.frustration,
      frustrationThreshold: this.frustrationThreshold,
      confidence: this.confidence,
      primaryGoal: this.primaryGoal,
      secondaryGoals: this.secondaryGoals,
      completedGoal: this.completedGoal,
      visitedPages: Array.from(this.visitedPages),
      failures: this.failures,
      attemptPath: this.attemptPath,
      timeSpentMs: Date.now() - this.startTime,
      abandoned: this.shouldAbandonJourney()
    };
  }
}

module.exports = { HumanJourneyContext };
