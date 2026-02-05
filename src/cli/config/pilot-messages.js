/**
 * Pilot Message Set (v0.4.9)
 *
 * Canonical, user-facing wording used across CLI help, console output,
 * README, and human artifacts.
 *
 * Rules:
 * - Honest scope boundaries (public flows by default)
 * - Evidence-first (artifacts are the product)
 * - Read-only by design
 * - INCOMPLETE is unsafe
 */

export const PRODUCT_ONE_LINER =
  'Evidence-backed detection of silent user-facing failures in covered public flows.';

export const DEFAULT_SCOPE_LINE =
  'Default scope: public, pre-login flows only (read-only).';

export const POST_AUTH_DISCLAIMER_LINE =
  'Post-login scanning is experimental and out of scope for this pilot; it requires --force-post-auth.';

export const NOT_THIS_TOOL_LINES = [
  'Not a test runner. Not monitoring. Not analytics.',
  'Not a business-logic correctness checker. Not a security scanner.',
];

export const RESULTS_INTERPRETATION = Object.freeze({
  SUCCESS: 'No findings were observed in the covered scope.',
  FINDINGS: 'Evidence-backed failures were detected.',
  INCOMPLETE: 'Coverage was partial or the run was interrupted. THIS RESULT MUST NOT BE TREATED AS SAFE.',
});

export const INCOMPLETE_SAFETY_LINE = 'THIS RESULT MUST NOT BE TREATED AS SAFE.';

export const ARTIFACTS_LINE = 'Artifacts are written under .verax/runs/ (or --out).';

