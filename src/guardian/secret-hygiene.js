const missingSecrets = new Map();

function recordMissing(key, reason) {
  missingSecrets.set(key, reason || 'missing');
}

function getSecret(key, fallback, options = {}) {
  const envVal = process.env[key];
  if (envVal && String(envVal).trim()) {
    return String(envVal).trim();
  }
  if (options.required !== false) {
    recordMissing(key, options.reason || 'missing');
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return '';
}

function getTestIdentities() {
  return {
    signupEmail: getSecret('GUARDIAN_TEST_SIGNUP_EMAIL', 'newuser@example.com', { reason: 'signup_email' }),
    signupPassword: getSecret('GUARDIAN_TEST_SIGNUP_PASSWORD', 'P@ssword123', { reason: 'signup_password' }),
    loginEmail: getSecret('GUARDIAN_TEST_LOGIN_EMAIL', 'user@example.com', { reason: 'login_email' }),
    loginPassword: getSecret('GUARDIAN_TEST_LOGIN_PASSWORD', 'password123', { reason: 'login_password' }),
    newsletterEmail: getSecret('GUARDIAN_TEST_NEWSLETTER_EMAIL', 'subscriber@example.com', { reason: 'newsletter_email' })
  };
}

function getMissingSecrets() {
  return Array.from(missingSecrets.entries()).map(([key, reason]) => ({ key, reason }));
}

function resetSecretTracker() {
  missingSecrets.clear();
}

module.exports = {
  getSecret,
  getTestIdentities,
  getMissingSecrets,
  resetSecretTracker
};
