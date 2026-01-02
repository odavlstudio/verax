// Canonical snapshot of all real-world scenarios for Guardian scenario integrity freeze.
// This file is auto-generated and must be updated only when scenarios are intentionally changed.
// DO NOT EDIT BY HAND UNLESS UPDATING THE FROZEN SCENARIOS.

module.exports = [
  {
    "scenarioId": "saas-login-blocked",
    "siteType": "saas",
    "realWorldContext": "A SaaS platform where login and signup are critical for user onboarding and retention. Outages or broken auth flows cause immediate business impact.",
    "criticalUserGoal": "User must be able to sign up and log in to access their workspace.",
    "expectedFailureModes": [
      "Login form submits but never authenticates",
      "Signup flow fails due to missing email verification",
      "Password reset emails not delivered",
      "OAuth provider misconfiguration blocks access"
    ],
    "guardianExpectation": "Guardian should detect if login/signup is broken, slow, or blocked, and distinguish between auth errors and UI issues.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  },
  {
    "scenarioId": "ecommerce-checkout-failure",
    "siteType": "ecommerce",
    "realWorldContext": "An online store where users can browse and add items, but checkout is often fragile due to payment, shipping, or inventory issues.",
    "criticalUserGoal": "User must be able to complete a purchase from cart to payment confirmation.",
    "expectedFailureModes": [
      "Checkout button unresponsive or missing",
      "Payment gateway errors or timeouts",
      "Cart contents lost during checkout",
      "Shipping options not loading or incorrect fees"
    ],
    "guardianExpectation": "Guardian should catch any blockers in the checkout flow, including payment failures and broken cart state.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  },
  {
    "scenarioId": "marketing-landing-broken-cta",
    "siteType": "marketing",
    "realWorldContext": "A marketing or landing site where the main call-to-action (CTA) is the only path to conversion. Broken CTAs mean lost leads.",
    "criticalUserGoal": "User must be able to click the main CTA (e.g., \"Get Started\", \"Contact Us\") and reach the intended destination.",
    "expectedFailureModes": [
      "CTA button does nothing or is hidden",
      "Form submission errors with no feedback",
      "Broken links or 404s after CTA click",
      "Tracking scripts block CTA interaction"
    ],
    "guardianExpectation": "Guardian should flag if the main CTA is non-functional, misleading, or leads to a dead end.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  },
  {
    "scenarioId": "content-docs-navigation-dead",
    "siteType": "content",
    "realWorldContext": "A documentation or content site where users rely on navigation to find information. Broken nav or search means users are lost.",
    "criticalUserGoal": "User must be able to navigate between docs pages and use search to find topics.",
    "expectedFailureModes": [
      "Sidebar or top nav links do not work",
      "Search returns no results or errors",
      "Content pages load blank or with errors",
      "Breadcrumbs or back buttons broken"
    ],
    "guardianExpectation": "Guardian should detect navigation or search failures that prevent users from finding content.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  },
  {
    "scenarioId": "dashboard-auth-expired",
    "siteType": "dashboard",
    "realWorldContext": "An authenticated dashboard (e.g., admin, analytics) where session expiry or auth bugs can silently block access for real users.",
    "criticalUserGoal": "User must be able to access the dashboard after login and perform basic actions without being logged out unexpectedly.",
    "expectedFailureModes": [
      "Session expires immediately after login",
      "API calls fail with 401/403 errors",
      "Dashboard loads but shows no data",
      "User is redirected to login repeatedly"
    ],
    "guardianExpectation": "Guardian should catch silent auth/session failures and distinguish between UI and backend/API issues.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  },
  {
    "scenarioId": "edge-partial-success-misleading",
    "siteType": "edge",
    "realWorldContext": "A site where the homepage and some flows work, but a critical feature is broken, leading to a misleading sense of success.",
    "criticalUserGoal": "User must be able to complete a key flow (e.g., submit a support ticket, download a file) after initial success.",
    "expectedFailureModes": [
      "Key feature hidden behind feature flag or AB test",
      "Partial page loads but action fails silently",
      "Success message shown but no backend action",
      "Critical flow skipped due to misconfiguration"
    ],
    "guardianExpectation": "Guardian should avoid false positives by detecting partial/illusory success and flagging missing or skipped critical flows.",
    "possibleVerdicts": ["READY", "FRICTION", "DO_NOT_LAUNCH"]
  }
];
