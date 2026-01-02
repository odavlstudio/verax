/**
 * Phase 10: Usage Signals Tracker
 * Minimal local tracking of key milestones
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SIGNALS_DIR = path.join(os.homedir(), '.odavl-guardian');
const SIGNALS_FILE = path.join(SIGNALS_DIR, 'signals.json');

/**
 * Ensure signals directory exists
 */
function ensureSignalsDir() {
  if (!fs.existsSync(SIGNALS_DIR)) {
    fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  }
}

/**
 * Get current signals
 */
function getSignals() {
  ensureSignalsDir();
  
  if (!fs.existsSync(SIGNALS_FILE)) {
    return {
      firstScanAt: null,
      firstLiveAt: null,
      firstUpgradeAt: null,
      totalScans: 0,
      totalLiveSessions: 0,
    };
  }
  
  try {
    return JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf-8'));
  } catch (_error) {
    return {
      firstScanAt: null,
      firstLiveAt: null,
      firstUpgradeAt: null,
      totalScans: 0,
      totalLiveSessions: 0,
    };
  }
}

/**
 * Save signals
 */
function saveSignals(signals) {
  ensureSignalsDir();
  fs.writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 2), 'utf-8');
}

/**
 * Record first scan
 */
function recordFirstScan() {
  const signals = getSignals();
  
  if (!signals.firstScanAt) {
    signals.firstScanAt = new Date().toISOString();
  }
  
  signals.totalScans += 1;
  saveSignals(signals);
  
  return signals;
}

/**
 * Record first live guardian session
 */
function recordFirstLive() {
  const signals = getSignals();
  
  if (!signals.firstLiveAt) {
    signals.firstLiveAt = new Date().toISOString();
  }
  
  signals.totalLiveSessions += 1;
  saveSignals(signals);
  
  return signals;
}

/**
 * Record first upgrade
 */
function recordFirstUpgrade(planId) {
  const signals = getSignals();
  
  if (!signals.firstUpgradeAt) {
    signals.firstUpgradeAt = new Date().toISOString();
    signals.firstUpgradePlan = planId;
  }
  
  saveSignals(signals);
  
  return signals;
}

/**
 * Get usage summary
 */
function getUsageSummary() {
  const signals = getSignals();
  
  return {
    hasScanned: signals.firstScanAt !== null,
    hasUsedLive: signals.firstLiveAt !== null,
    hasUpgraded: signals.firstUpgradeAt !== null,
    totalScans: signals.totalScans,
    totalLiveSessions: signals.totalLiveSessions,
    daysSinceFirstScan: signals.firstScanAt 
      ? Math.floor((Date.now() - new Date(signals.firstScanAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  };
}

/**
 * Reset signals (for testing)
 */
function resetSignals() {
  if (fs.existsSync(SIGNALS_FILE)) {
    fs.unlinkSync(SIGNALS_FILE);
  }
}

module.exports = {
  recordFirstScan,
  recordFirstLive,
  recordFirstUpgrade,
  getSignals,
  getUsageSummary,
  resetSignals,
};
