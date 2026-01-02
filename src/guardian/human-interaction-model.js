/**
 * Human Interaction Fidelity Model
 * 
 * Simulates realistic human behavior patterns for web interactions.
 * All functions are deterministic given a seed - same site produces same behavior.
 * 
 * Core principles:
 * - Humans are slower than bots
 * - Humans pause before important actions
 * - Humans make small timing variations
 * - Humans give up after failures
 * - Humans don't have perfect precision
 */

/**
 * Seeded pseudo-random number generator (deterministic)
 * Uses a simple LCG algorithm
 */
class SeededRandom {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Create a seeded random generator from a string
 */
function createSeededRandom(baseUrl, contextSuffix = '') {
  const seedString = `${baseUrl}_${contextSuffix}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return new SeededRandom(Math.abs(hash) || 1);
}

/**
 * Human click delay - slight pause before clicking
 * Real humans take 100-400ms to process and click
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} elementType - button, link, etc (affects delay)
 * @returns {number} Delay in milliseconds
 */
function humanClickDelay(baseUrl, elementType = 'button') {
  const rng = createSeededRandom(baseUrl, `click_${elementType}`);
  
  // Button clicks are faster (more obvious targets)
  // Links require reading, slower
  const baseDelays = {
    'button': { min: 150, max: 350 },
    'link': { min: 200, max: 450 },
    'checkbox': { min: 120, max: 280 },
    'radio': { min: 120, max: 280 },
    'default': { min: 180, max: 400 }
  };
  
  const delays = baseDelays[elementType] || baseDelays.default;
  return rng.nextInt(delays.min, delays.max);
}

/**
 * Human typing pattern - realistic character-by-character timing
 * Generates an array of per-character delays
 * 
 * @param {string} text - Text to type
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} fieldType - email, password, text (affects speed)
 * @returns {number[]} Array of delays (one per character)
 */
function humanTypingPattern(text, baseUrl, fieldType = 'text') {
  const rng = createSeededRandom(baseUrl, `type_${fieldType}_${text.length}`);
  
  // Average typing speeds (ms per character)
  const typingSpeeds = {
    'email': { min: 80, max: 150 },      // Faster (familiar)
    'password': { min: 100, max: 200 },   // Slower (careful)
    'text': { min: 70, max: 140 },       // Normal speed
    'textarea': { min: 60, max: 130 }    // Slightly faster (more content)
  };
  
  const speed = typingSpeeds[fieldType] || typingSpeeds.text;
  const delays = [];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Punctuation and special chars are slower
    const isPunctuation = /[.,!?;:]/.test(char);
    const isSpecial = /[@#$%^&*()]/.test(char);
    const isSpace = char === ' ';
    
    let charDelay;
    if (isSpecial) {
      charDelay = rng.nextInt(speed.min + 40, speed.max + 80);
    } else if (isPunctuation) {
      charDelay = rng.nextInt(speed.min + 20, speed.max + 40);
    } else if (isSpace) {
      charDelay = rng.nextInt(speed.min - 10, speed.max - 20);
    } else {
      charDelay = rng.nextInt(speed.min, speed.max);
    }
    
    delays.push(charDelay);
  }
  
  return delays;
}

/**
 * Human decision pause - thinking time before critical actions
 * Humans pause before submitting forms, confirming purchases, etc.
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} actionType - submit, checkout, delete, etc
 * @param {number} intentConfidence - 0-1, how confident we are about intent
 * @returns {number} Pause duration in milliseconds
 */
function humanDecisionPause(baseUrl, actionType = 'submit', intentConfidence = 1.0) {
  const rng = createSeededRandom(baseUrl, `decision_${actionType}`);
  
  // Critical actions require more thinking
  const basePauses = {
    'submit': { min: 400, max: 900 },
    'checkout': { min: 800, max: 1500 },
    'purchase': { min: 1000, max: 2000 },
    'delete': { min: 600, max: 1200 },
    'confirm': { min: 500, max: 1000 },
    'cancel': { min: 300, max: 600 },
    'default': { min: 300, max: 700 }
  };
  
  const pause = basePauses[actionType] || basePauses.default;
  let basePause = rng.nextInt(pause.min, pause.max);
  
  // Lower confidence = more hesitation
  if (intentConfidence < 0.7) {
    basePause = Math.floor(basePause * 1.5); // 50% longer pause
  }
  
  return basePause;
}

/**
 * Human abort probability - decides if human would abandon action
 * Real humans give up if things feel broken or confusing
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {Object} context - Situational factors
 * @returns {boolean} true if human would abort
 */
function humanAbortProbability(baseUrl, context = {}) {
  const {
    actionType = 'click',
    failureCount = 0,
    intentConfidence = 1.0,
    pageLoadTime = 0,
    elementsNotFound = 0
  } = context;
  
  const rng = createSeededRandom(baseUrl, `abort_${actionType}_${failureCount}`);
  
  // Base abort thresholds
  let abortThreshold = 0;
  
  // Multiple failures increase abort chance
  if (failureCount === 1) abortThreshold = 0.15;  // 15% chance after 1 failure
  else if (failureCount === 2) abortThreshold = 0.40;  // 40% chance after 2 failures
  else if (failureCount >= 3) abortThreshold = 0.80;  // 80% chance after 3+ failures
  
  // Low intent confidence increases abort chance
  if (intentConfidence < 0.5) {
    abortThreshold += 0.20;
  } else if (intentConfidence < 0.7) {
    abortThreshold += 0.10;
  }
  
  // Slow pages frustrate users
  if (pageLoadTime > 5000) {
    abortThreshold += 0.15;
  } else if (pageLoadTime > 3000) {
    abortThreshold += 0.08;
  }
  
  // Missing elements signal broken site
  if (elementsNotFound > 0) {
    abortThreshold += (elementsNotFound * 0.10);
  }
  
  // Cap at 95% (humans almost never retry after that point)
  abortThreshold = Math.min(abortThreshold, 0.95);
  
  // Deterministic decision
  const roll = rng.next();
  return roll < abortThreshold;
}

/**
 * Human retry behavior - how many times to retry before giving up
 * Real humans retry 0-2 times depending on context
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} actionType - What action failed
 * @param {number} intentConfidence - How confident we are about intent
 * @returns {number} Max retries (0-2)
 */
function humanMaxRetries(baseUrl, actionType = 'click', intentConfidence = 1.0) {
  const rng = createSeededRandom(baseUrl, `retries_${actionType}`);
  
  // High confidence actions get more retries
  if (intentConfidence >= 0.8) {
    return rng.nextInt(1, 2); // 1-2 retries
  } else if (intentConfidence >= 0.5) {
    return rng.nextInt(0, 1); // 0-1 retries
  } else {
    return 0; // No retries for uncertain actions
  }
}

/**
 * Human navigation patience - how long to wait for page loads
 * Real humans wait 3-8 seconds, then give up
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} pageType - landing, form, checkout, etc
 * @returns {number} Patience timeout in milliseconds
 */
function humanNavigationPatience(baseUrl, pageType = 'normal') {
  const rng = createSeededRandom(baseUrl, `patience_${pageType}`);
  
  const patienceLevels = {
    'landing': { min: 4000, max: 7000 },    // Less patient on entry
    'form': { min: 5000, max: 9000 },       // More patient filling forms
    'checkout': { min: 6000, max: 10000 },  // Very patient near purchase
    'confirmation': { min: 7000, max: 12000 }, // Most patient for confirmation
    'normal': { min: 4500, max: 8000 }
  };
  
  const patience = patienceLevels[pageType] || patienceLevels.normal;
  return rng.nextInt(patience.min, patience.max);
}

/**
 * Human mouse movement delay - time to move cursor to element
 * Real humans need 100-300ms to move mouse to target
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {number} distance - Approximate distance in pixels (affects time)
 * @returns {number} Movement time in milliseconds
 */
function humanMouseMovement(baseUrl, distance = 500) {
  const rng = createSeededRandom(baseUrl, `mouse_${Math.floor(distance / 100)}`);
  
  // Fitts's Law approximation: longer distance = longer time
  const baseTime = 100;
  const distanceFactor = Math.log2(distance / 50 + 1) * 30;
  const totalTime = baseTime + distanceFactor;
  
  // Add some variance
  const variance = rng.nextInt(-30, 50);
  return Math.max(80, Math.floor(totalTime + variance));
}

/**
 * Human form fill hesitation - pauses between fields
 * Real humans pause to read labels, think about answers
 * 
 * @param {string} baseUrl - Site URL for deterministic seed
 * @param {string} previousField - Type of previous field
 * @param {string} nextField - Type of next field
 * @returns {number} Pause duration in milliseconds
 */
function humanFormFieldPause(baseUrl, previousField = '', nextField = '') {
  const rng = createSeededRandom(baseUrl, `form_${previousField}_${nextField}`);
  
  // Transition between field types affects pause
  const isPreviousSensitive = ['password', 'credit_card', 'ssn'].includes(previousField);
  const isNextSensitive = ['password', 'credit_card', 'ssn'].includes(nextField);
  
  let minPause = 200;
  let maxPause = 600;
  
  // Sensitive fields require more thinking
  if (isPreviousSensitive || isNextSensitive) {
    minPause += 300;
    maxPause += 500;
  }
  
  return rng.nextInt(minPause, maxPause);
}

/**
 * Calculate aggregate typing time for a field
 * 
 * @param {string} text - Text to type
 * @param {string} baseUrl - Site URL
 * @param {string} fieldType - Field type
 * @returns {number} Total time in milliseconds
 */
function calculateTypingTime(text, baseUrl, fieldType = 'text') {
  const delays = humanTypingPattern(text, baseUrl, fieldType);
  return delays.reduce((sum, delay) => sum + delay, 0);
}

/**
 * Get human-readable explanation for interaction timing
 * 
 * @param {string} actionType - Type of action
 * @param {number} delay - Delay applied
 * @returns {string} Explanation
 */
function explainTiming(actionType, delay) {
  if (actionType === 'click') {
    return `Human reaction time: ${delay}ms`;
  } else if (actionType === 'type') {
    return `Human typing speed: ${delay}ms total`;
  } else if (actionType === 'decision' || actionType === 'pause') {
    return `Human thinking pause: ${delay}ms`;
  } else if (actionType === 'mouse_move') {
    return `Mouse movement time: ${delay}ms`;
  } else {
    return `Human delay: ${delay}ms`;
  }
}

module.exports = {
  humanClickDelay,
  humanTypingPattern,
  humanDecisionPause,
  humanAbortProbability,
  humanMaxRetries,
  humanNavigationPatience,
  humanMouseMovement,
  humanFormFieldPause,
  calculateTypingTime,
  explainTiming,
  SeededRandom,
  createSeededRandom
};
