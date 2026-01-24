/**
 * ACTION CLASSIFIER
 * 
 * Classifies user interactions by safety level for misuse resistance.
 * NO JUDGMENT SEMANTICS - only risk classification for protection.
 * 
 * Classifications:
 * - SAFE_READONLY: Navigation, focus, hover, non-submitting clicks
 * - RISKY: Destructive actions (delete/remove/clear data), logout, admin
 * - WRITE_INTENT: State-changing actions (submit, file upload, checkout/pay)
 * 
 * Phase 4: Default safe mode blocks RISKY and WRITE_INTENT unless explicitly allowed.
 */

/**
 * Classify an interaction's safety level
 * @param {Object} interaction - Interaction object with type, text, label, selector
 * @returns {Object} { classification: string, reason: string }
 */
export function classifyAction(interaction) {
  const type = (interaction.type || '').toLowerCase();
  const text = (interaction.text || '').toLowerCase().trim();
  const label = (interaction.label || '').toLowerCase().trim();
  const ariaLabel = (interaction.ariaLabel || '').toLowerCase().trim();
  const selector = (interaction.selector || '').toLowerCase();
  const combined = `${text} ${label} ${ariaLabel}`.trim();

  // RISKY patterns - destructive/dangerous actions
  const riskyKeywords = /\b(delete|remove|erase|wipe|destroy|drop|clear\s+(data|all|history|cache|account|database|storage)|reset\s+(account|data|database)|deactivate|terminate|uninstall|unsubscribe)\b/i;
  const adminKeywords = /\b(admin|administrator|sudo|root|settings|config|preferences)\b/i;
  
  if (riskyKeywords.test(combined)) {
    return { classification: 'RISKY', reason: 'destructive_keyword' };
  }

  // Logout/signout treated as risky (state loss)
  if (/\b(logout|sign\s*out|log\s*out)\b/i.test(combined)) {
    return { classification: 'RISKY', reason: 'auth_logout' };
  }

  // Admin/config actions risky
  if (adminKeywords.test(combined) && !/view|read|show/.test(combined)) {
    return { classification: 'RISKY', reason: 'admin_action' };
  }

  // WRITE_INTENT patterns - state-changing actions
  const writeKeywords = /\b(submit|send|post|save|update|create|add|checkout|purchase|pay|buy|order|upload|attach|edit|modify)\b/i;
  
  if (writeKeywords.test(combined)) {
    return { classification: 'WRITE_INTENT', reason: 'write_keyword' };
  }

  // Form submissions are write intent
  if (type === 'submit' || selector.includes('type="submit"') || selector.includes('[type=submit]')) {
    return { classification: 'WRITE_INTENT', reason: 'form_submit' };
  }

  // File inputs are write intent
  if (type === 'file' || selector.includes('type="file"') || selector.includes('input[type=file]')) {
    return { classification: 'WRITE_INTENT', reason: 'file_input' };
  }

  // Default: safe readonly (navigation, clicks, focus, hover)
  return { classification: 'SAFE_READONLY', reason: 'default_safe' };
}

/**
 * Check if action should be blocked based on safety mode and flags
 * @param {Object} interaction - Interaction to check
 * @param {Object} flags - Safety flags { allowRiskyActions: boolean }
 * @returns {Object} { shouldBlock: boolean, classification: string, reason: string }
 */
export function shouldBlockAction(interaction, flags = {}) {
  const { allowRiskyActions = false } = flags;
  const { classification, reason } = classifyAction(interaction);

  if (classification === 'RISKY' && !allowRiskyActions) {
    return { shouldBlock: true, classification, reason };
  }

  // CONSTITUTIONAL: Always block write intents (read-only mode enforced)
  if (classification === 'WRITE_INTENT') {
    return { shouldBlock: true, classification, reason };
  }

  return { shouldBlock: false, classification, reason };
}



