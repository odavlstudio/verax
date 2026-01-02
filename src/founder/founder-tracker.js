/**
 * Phase 10: Founder Tracker
 * Detects and tracks first 100 users (Founding Users)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const FOUNDER_DIR = path.join(os.homedir(), '.odavl-guardian', 'founder');
const FOUNDER_FILE = path.join(FOUNDER_DIR, 'status.json');
const GLOBAL_COUNTER_FILE = path.join(FOUNDER_DIR, 'global-counter.json');
const FOUNDER_LIMIT = 100;

/**
 * Ensure founder directory exists
 */
function ensureFounderDir() {
  if (!fs.existsSync(FOUNDER_DIR)) {
    fs.mkdirSync(FOUNDER_DIR, { recursive: true });
  }
}

/**
 * Generate unique machine ID (stable across runs)
 */
function getMachineId() {
  const machineFile = path.join(FOUNDER_DIR, 'machine-id.txt');
  ensureFounderDir();
  
  if (fs.existsSync(machineFile)) {
    return fs.readFileSync(machineFile, 'utf-8').trim();
  }
  
  // Generate new machine ID
  const id = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(machineFile, id, 'utf-8');
  return id;
}

/**
 * Get global founder counter
 */
function getGlobalCounter() {
  ensureFounderDir();
  
  if (!fs.existsSync(GLOBAL_COUNTER_FILE)) {
    return { count: 0, users: [] };
  }
  
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_COUNTER_FILE, 'utf-8'));
  } catch (_error) {
    return { count: 0, users: [] };
  }
}

/**
 * Save global founder counter
 */
function saveGlobalCounter(counter) {
  ensureFounderDir();
  fs.writeFileSync(GLOBAL_COUNTER_FILE, JSON.stringify(counter, null, 2), 'utf-8');
}

/**
 * Get founder status for current user
 */
function getFounderStatus() {
  ensureFounderDir();
  
  if (!fs.existsSync(FOUNDER_FILE)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(FOUNDER_FILE, 'utf-8'));
  } catch (_error) {
    return null;
  }
}

/**
 * Save founder status for current user
 */
function saveFounderStatus(status) {
  ensureFounderDir();
  fs.writeFileSync(FOUNDER_FILE, JSON.stringify(status, null, 2), 'utf-8');
}

/**
 * Check if user is a founding user
 */
function isFoundingUser() {
  const status = getFounderStatus();
  return status && status.isFounder === true;
}

/**
 * Register current user (call on first scan)
 */
function registerUser() {
  // Check if already registered
  const existingStatus = getFounderStatus();
  if (existingStatus) {
    return existingStatus;
  }
  
  const machineId = getMachineId();
  const counter = getGlobalCounter();
  
  // Check if machine ID already registered
  const alreadyRegistered = counter.users.includes(machineId);
  
  if (alreadyRegistered) {
    // Find their position
    const position = counter.users.indexOf(machineId) + 1;
    const status = {
      isFounder: position <= FOUNDER_LIMIT,
      registeredAt: new Date().toISOString(),
      founderNumber: position <= FOUNDER_LIMIT ? position : null,
      machineId,
    };
    saveFounderStatus(status);
    return status;
  }
  
  // New user - add to global counter
  counter.count += 1;
  counter.users.push(machineId);
  saveGlobalCounter(counter);
  
  const isFounder = counter.count <= FOUNDER_LIMIT;
  const status = {
    isFounder,
    registeredAt: new Date().toISOString(),
    founderNumber: isFounder ? counter.count : null,
    machineId,
  };
  
  saveFounderStatus(status);
  return status;
}

/**
 * Get founder message for display
 */
function getFounderMessage() {
  const status = getFounderStatus();
  
  if (!status) {
    return null;
  }
  
  if (status.isFounder) {
    return `🌟 You're Founding User #${status.founderNumber} — thank you for helping shape Guardian.`;
  }
  
  return null;
}

/**
 * Get founder badge for reports (HTML)
 */
function getFounderBadgeHTML() {
  const status = getFounderStatus();
  
  if (!status || !status.isFounder) {
    return '';
  }
  
  return `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 8px; margin: 16px 0; text-align: center; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
      🌟 Founding User #${status.founderNumber}
      <div style="font-size: 0.85em; opacity: 0.9; margin-top: 4px;">Thank you for being an early supporter</div>
    </div>
  `;
}

/**
 * Get total registered users count
 */
function getTotalUsers() {
  const counter = getGlobalCounter();
  return counter.count;
}

/**
 * Reset founder data (for testing only)
 */
function resetFounderData() {
  if (fs.existsSync(FOUNDER_FILE)) {
    fs.unlinkSync(FOUNDER_FILE);
  }
  if (fs.existsSync(GLOBAL_COUNTER_FILE)) {
    fs.unlinkSync(GLOBAL_COUNTER_FILE);
  }
  const machineFile = path.join(FOUNDER_DIR, 'machine-id.txt');
  if (fs.existsSync(machineFile)) {
    fs.unlinkSync(machineFile);
  }
}

module.exports = {
  registerUser,
  isFoundingUser,
  getFounderStatus,
  getFounderMessage,
  getFounderBadgeHTML,
  getTotalUsers,
  resetFounderData,
};
