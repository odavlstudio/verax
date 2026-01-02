/**
 * Detection Priority Layers
 * 
 * Implements deterministic, layered detection with strict priority order:
 * LAYER 0: profile overrides (highest)
 * LAYER 1: data-guardian attributes
 * LAYER 2: semantic href matching
 * LAYER 3: semantic visible text matching
 * LAYER 4: structural heuristics (nav/footer proximity)
 * 
 * Each detection includes metadata: target, source layer, confidence, evidence.
 */

const { findByGuardianAttribute, matchesGuardianTarget, buildGuardianSelector } = require('./data-guardian-detector');
const { detectContactCandidates, DETECTION_SOURCE, CONFIDENCE } = require('./semantic-contact-detection');
const { resolveProfileForUrl } = require('./profile-loader');

/**
 * Detection layer names (for reporting)
 */
const LAYER = {
  PROFILE: 'profile',
  DATA_GUARDIAN: 'data-guardian',
  HREF: 'href',
  TEXT: 'text',
  STRUCTURE: 'structure'
};

/**
 * Detect element by layer, respecting strict priority
 * 
 * @param {Page} page - Playwright page object
 * @param {string} target - Target to detect (contact, about, form, submit)
 * @param {string} baseUrl - Base URL for relative links
 * @returns {Promise<Object>} Detection result with layer, confidence, evidence
 */
async function detectByLayers(page, target, baseUrl = '') {
  const result = {
    target: target,
    found: false,
    layer: null,
    confidence: null,
    evidence: null,
    candidates: [],
    primaryCandidate: null,
    reason: ''
  };

  try {
    const profile = resolveProfileForUrl(baseUrl || page.url());
    if (profile) {
      console.log(`🔧 Loaded profile for ${profile.site}`);
      const profileSelector = (profile.selectors || {})[target];
      if (profileSelector) {
        let nodes = [];
        try {
          nodes = await page.$$(profileSelector);
        } catch (err) {
          console.log(`   ❌ Profile selector error for ${target}: ${err.message}`);
          return {
            ...result,
            layer: LAYER.PROFILE,
            reason: `Profile selector error for ${target}: ${err.message}`,
            profileSite: profile.site,
            hardFailure: true
          };
        }

        if (!nodes || nodes.length === 0) {
          console.log(`   ❌ Profile selector for ${target} not found on page (${profile.site})`);
          return {
            ...result,
            layer: LAYER.PROFILE,
            reason: `Profile selector for ${target} not found (${profileSelector})`,
            profileSite: profile.site,
            hardFailure: true
          };
        }

        console.log(`   🎯 Using profile selector for ${target}: ${profileSelector}`);
        const candidates = [{
          selector: profileSelector,
          matchedText: null,
          matchedToken: target,
          source: 'profile',
          confidence: CONFIDENCE.HIGH,
          href: null,
          ariaLabel: null,
          tagName: nodes[0] ? await nodes[0].evaluate(el => el.tagName.toLowerCase()).catch(() => undefined) : undefined
        }];
        return {
          ...result,
          found: true,
          layer: LAYER.PROFILE,
          confidence: CONFIDENCE.HIGH,
          candidates,
          primaryCandidate: candidates[0],
          evidence: `Profile selector ${profileSelector}`,
          reason: `Detected via profile override (site: ${profile.site})`,
          profileSite: profile.site
        };
      } else {
        console.log(`   🔧 Profile loaded for ${profile.site} (no selector for ${target}, falling back)`);
      }
    }

    // LAYER 1: data-guardian attributes (HIGHEST priority)
    const guardianResults = await detectLayer1DataGuardian(page, target);
    if (guardianResults.length > 0) {
      result.found = true;
      result.layer = LAYER.DATA_GUARDIAN;
      result.confidence = CONFIDENCE.HIGH;
      result.candidates = guardianResults;
      result.primaryCandidate = guardianResults[0];
      result.evidence = `Exact data-guardian="${target}" attribute match`;
      result.reason = 'Highest priority layer matched: data-guardian attribute provides guaranteed stability.';
      return result;
    }

    // LAYER 2: semantic href matching
    const hrefResults = await detectLayer2Href(page, target, baseUrl);
    if (hrefResults.length > 0) {
      result.found = true;
      result.layer = LAYER.HREF;
      result.confidence = CONFIDENCE.HIGH;
      result.candidates = hrefResults;
      result.primaryCandidate = hrefResults[0];
      result.evidence = hrefResults[0].matchedToken;
      result.reason = 'Matched via href attribute using semantic tokens (e.g., "/kontakt" matches German token "kontakt").';
      return result;
    }

    // LAYER 3: semantic visible text matching
    const textResults = await detectLayer3Text(page, target, baseUrl);
    if (textResults.length > 0) {
      result.found = true;
      result.layer = LAYER.TEXT;
      result.confidence = textResults[0].confidence; // medium or high if in nav/footer
      result.candidates = textResults;
      result.primaryCandidate = textResults[0];
      result.evidence = `Text "${textResults[0].matchedText}" matched token "${textResults[0].matchedToken}"`;
      result.reason = `Matched via visible text using semantic tokens. ${
        result.confidence === CONFIDENCE.HIGH ? 
        'Located in navigation/footer (high confidence).' :
        'Consider adding data-guardian="' + target + '" for guaranteed stability.'
      }`;
      return result;
    }

    // LAYER 4: structural heuristics (LOWEST priority)
    const structureResults = await detectLayer4Structure(page, target, baseUrl);
    if (structureResults.length > 0) {
      result.found = true;
      result.layer = LAYER.STRUCTURE;
      result.confidence = CONFIDENCE.LOW;
      result.candidates = structureResults;
      result.primaryCandidate = structureResults[0];
      result.evidence = `Located in ${structureResults[0].source} based on page structure`;
      result.reason = `Heuristic detection only (low confidence). Add data-guardian="${target}" attribute for guaranteed stability.`;
      return result;
    }

    // Nothing found
    result.reason = `No ${target} element detected. Consider:
1. Adding data-guardian="${target}" attribute
2. Using semantic-friendly text (e.g., "Contact", "Kontakt", "Contacto")
3. Using semantic-friendly href (e.g., "/contact", "/kontakt")`;

    return result;
  } catch (error) {
    console.warn(`Detection by layers failed: ${error.message}`);
    result.reason = `Detection error: ${error.message}`;
    return result;
  }
}

/**
 * LAYER 1: data-guardian attribute detection (HIGHEST priority)
 */
async function detectLayer1DataGuardian(page, target) {
  try {
    const elements = await findByGuardianAttribute(page, target);
    return elements.map(el => ({
      selector: buildGuardianSelector(target),
      matchedText: el.text || el.dataGuardian,
      matchedToken: target,
      source: DETECTION_SOURCE.DATA_GUARDIAN,
      confidence: CONFIDENCE.HIGH,
      href: el.href,
      ariaLabel: el.ariaLabel,
      tagName: el.tagName
    }));
  } catch (_error) {
    // Guardian target not supported or error occurred
    return [];
  }
}

/**
 * LAYER 2: semantic href matching (semantic + deterministic)
 */
async function detectLayer2Href(page, target, baseUrl) {
  try {
    // Use Wave 1.1 semantic detection but filter by target and href-only
    const allCandidates = await detectContactCandidates(page, baseUrl);
    
    // Filter: only href-based matches for the requested target
    const hrefMatches = allCandidates.filter(c => 
      c.source === DETECTION_SOURCE.HREF &&
      isTargetMatch(target, c.matchedToken)
    );

    return hrefMatches;
  } catch (error) {
    console.warn(`Layer 2 href detection failed: ${error.message}`);
    return [];
  }
}

/**
 * LAYER 3: semantic visible text matching
 */
async function detectLayer3Text(page, target, baseUrl) {
  try {
    // Use Wave 1.1 semantic detection but filter by target and text source
    const allCandidates = await detectContactCandidates(page, baseUrl);
    
    // Filter: text-based or nav/footer matches for the requested target
    const textMatches = allCandidates.filter(c => 
      (c.source === DETECTION_SOURCE.TEXT || c.source === DETECTION_SOURCE.NAV_FOOTER) &&
      isTargetMatch(target, c.matchedToken)
    );

    return textMatches;
  } catch (error) {
    console.warn(`Layer 3 text detection failed: ${error.message}`);
    return [];
  }
}

/**
 * LAYER 4: structural heuristics (LOWEST priority, fallback only)
 */
async function detectLayer4Structure(page, target, baseUrl) {
  // Structural heuristics would look for elements in footer, nav, etc.
  // by position alone (no semantic matching)
  // Currently a placeholder — can be enhanced in future waves
  return [];
}

/**
 * Check if a matched token corresponds to the requested target
 * (e.g., "kontakt" token matches "contact" target in German)
 */
function isTargetMatch(target, matchedToken) {
  // For Wave 1.2, we simplify: contact tokens match contact target, etc.
  // This can be expanded to support token-to-target mappings if needed
  if (target.toLowerCase() === 'contact') {
    // Wave 1.1 already groups all contact tokens under 'contact'
    return matchedToken && matchedToken.toLowerCase() !== 'about';
  }
  // Extend as needed for other targets
  return false;
}

module.exports = {
  detectByLayers,
  LAYER,
  DETECTION_SOURCE,
  CONFIDENCE
};
