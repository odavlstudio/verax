// Canonical baseline for Guardian regression guard (verdict/confidence/recommendedAction per scenario)
// This file is auto-generated and must be updated only when results are intentionally changed.
// DO NOT EDIT BY HAND UNLESS UPDATING THE FROZEN BASELINE.

module.exports = [
  {
    scenarioId: "saas-login-blocked",
    verdict: "READY",
    confidence: "HIGH",
    recommendedAction: "Proceed"
  },
  {
    scenarioId: "ecommerce-checkout-failure",
    verdict: "FRICTION",
    confidence: "MEDIUM",
    recommendedAction: "Proceed with Caution"
  },
  {
    scenarioId: "marketing-landing-broken-cta",
    verdict: "DO_NOT_LAUNCH",
    confidence: "LOW",
    recommendedAction: "Block"
  },
  {
    scenarioId: "content-docs-navigation-dead",
    verdict: "READY",
    confidence: "HIGH",
    recommendedAction: "Proceed"
  },
  {
    scenarioId: "dashboard-auth-expired",
    verdict: "FRICTION",
    confidence: "MEDIUM",
    recommendedAction: "Proceed with Caution"
  },
  {
    scenarioId: "edge-partial-success-misleading",
    verdict: "DO_NOT_LAUNCH",
    confidence: "LOW",
    recommendedAction: "Block"
  }
];
