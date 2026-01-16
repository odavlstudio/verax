# Next.js Realistic Fixture

## What This Simulates
A realistic Next.js application (e.g., blog, e-commerce) with intentional silent failures.

## Capabilities Exercised
- `route-detection-nextjs`
- `route-validation-reachability`
- `dynamic-route-normalization`
- `route-intelligence-correlation`
- `dynamic-route-intelligence`
- `network-detection-useeffect`
- `network-silent-failure`
- `ui-feedback-loading`
- `ui-feedback-missing`

## Intentional Silent Failures

### 1. CONFIRMED: Product Purchase Button (network-silent-failure)
- **Location**: `app/products/[id]/page.js`
- **Issue**: Purchase button promises network request but fails silently
- **Expected**: Should be reported as CONFIRMED finding

### 2. CONFIRMED: Comment Submission (network-silent-failure)
- **Location**: `app/blog/[slug]/page.js`
- **Issue**: Comment form promises POST request but fails silently
- **Expected**: Should be reported as CONFIRMED finding

### 3. FALSE POSITIVE TRAP: Page View Tracking (should NOT be reported)
- **Location**: `app/layout.js`
- **Issue**: Analytics tracking that intentionally does nothing
- **Expected**: Should NOT be reported

### 4. PARTIAL/AMBIGUOUS: Search Results (confidence < 1)
- **Location**: `app/search/page.js`
- **Issue**: Search may or may not return results (depends on query)
- **Expected**: Should be reported with MEDIUM confidence

### 5. CONFIRMED: Missing Loading State (ui-feedback-missing)
- **Location**: `app/products/page.js`
- **Issue**: Product list promises loading indicator but none appears
- **Expected**: Should be reported as missing UI feedback

## Determinism Rules
- All routes use file-based routing
- No external API calls
- No random data
- Deterministic data fetching

