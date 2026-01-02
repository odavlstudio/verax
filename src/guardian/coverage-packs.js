const COVERAGE_PACKS = {
  ecommerce: [
    'checkout',
    'signup',
    'login',
    'primary_ctas',
    'site_smoke',
    'language_switch'
  ],
  saas: [
    'signup',
    'login',
    'primary_ctas',
    'site_smoke',
    'contact_form',
    'newsletter_signup',
    'language_switch'
  ],
  content: [
    'site_smoke',
    'primary_ctas',
    'newsletter_signup',
    'contact_form',
    'language_switch'
  ],
  landing: [
    'site_smoke',
    'primary_ctas',
    'contact_form',
    'contact_discovery_v2',
    'newsletter_signup',
    'language_switch'
  ]
};

function mergeCoveragePack(requestedAttempts, siteProfile, { disabledByPreset = new Set() } = {}) {
  const current = Array.isArray(requestedAttempts) ? requestedAttempts.slice() : [];
  const pack = COVERAGE_PACKS[siteProfile];
  if (!pack) {
    return { attempts: current, added: [] };
  }

  const added = [];
  for (const attemptId of pack) {
    if (disabledByPreset.has(attemptId)) continue;
    if (!current.includes(attemptId)) {
      current.push(attemptId);
      added.push(attemptId);
    }
  }

  return { attempts: current, added };
}

module.exports = {
  COVERAGE_PACKS,
  mergeCoveragePack
};
