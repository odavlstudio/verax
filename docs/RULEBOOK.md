# VERAX Observable Outcome Rulebook

**Purpose**: Define exact, measurable thresholds for what constitutes an "acknowledgment" during runtime observation.

**Version**: 1.0  
**Last Updated**: 2026-01-26

---

## 1. Navigation Acknowledgment

A navigation is considered **acknowledged** if ANY of the following occur within 3000ms:

### Hard Navigation (Definitive)
- **URL changed** (including hash changes)
- **Page reload detected** (document.readyState changes)
- **Cross-origin navigation** detected

### Soft Navigation (SPA-style)
- **Significant DOM change** (score > 0.1):
  - Viewport element count changed by ±5 elements OR
  - Viewport text content changed OR
  - Target container element count changed OR
  - Target container text content changed
- **Route signal detected** (framework-specific):
  - React Router: `window.history.pushState` called
  - Next.js: `__NEXT_DATA__` updated
  - Angular: `NavigationEnd` event
  - Vue Router: `$route` changed

### Threshold Values
```javascript
NAVIGATION_TIMEOUT = 3000ms         // Max wait for navigation acknowledgment
DOM_CHANGE_SCORE_THRESHOLD = 0.1   // Minimum score for "significant" change
VIEWPORT_ELEMENT_DELTA = 5          // Min element count change to count
```

---

## 2. Form Submission Acknowledgment

A form submission is considered **acknowledged** if ANY of the following occur within 3000ms:

### Success Indicators
- **Navigation occurred** (see Navigation rules above)
- **UI feedback displayed** (see UI Feedback rules below)
- **Network request completed** (status 2xx or 3xx)
- **Success message appeared** (text matching: /success|submitted|thank you|confirmed/i)

### Failure Indicators
- **Error message appeared** (text matching: /error|invalid|required|failed/i)
- **Field validation triggered** (aria-invalid, error class, red border)
- **Network request failed** (status 4xx or 5xx)

### Threshold Values
```javascript
SUBMISSION_TIMEOUT = 3000ms         // Max wait for submission acknowledgment
```

---

## 3. UI Feedback Acknowledgment

UI feedback is considered **present** if ANY of the following occur:

### Visual Changes (within 500ms of interaction)
- **DOM change score > 0.1**:
  - Element count delta: ±2 elements in viewport OR ±1 element in target container
  - Text content changed in viewport or target
  - Attributes changed (class, style, aria-*)
- **Scroll occurred**: 
  - Vertical: >100px OR
  - Horizontal: >50px
- **Loading indicator appeared** (spinner, skeleton, progress bar)
- **Modal/dialog opened** (z-index change, overlay detected)
- **Toast/notification shown** (position:fixed element appeared)

### State Changes
- **Focus moved** (document.activeElement changed)
- **Selection changed** (window.getSelection() differs)
- **Attribute mutations** (data-*, aria-*, class changes)

### Threshold Values
```javascript
UI_FEEDBACK_TIMEOUT = 500ms         // Max wait for UI feedback
DOM_CHANGE_SCORE_THRESHOLD = 0.1   // Minimum score for feedback
SCROLL_THRESHOLD_VERTICAL = 100px   // Min vertical scroll distance
SCROLL_THRESHOLD_HORIZONTAL = 50px  // Min horizontal scroll distance
TARGET_ELEMENT_DELTA = 1            // Min element change in target
VIEWPORT_ELEMENT_DELTA = 2          // Min element change in viewport
```

---

## 4. DOM Change Calculation

**DOM Change Score** is calculated as follows:

```
targetScore = 0.0
if (target element count changed):
    targetScore += 0.5
if (target text content changed):
    targetScore += 0.3

viewportScore = 0.0
if (viewport element count changed by ≥5):
    viewportScore += 0.3
if (viewport text content changed):
    viewportScore += 0.2

finalScore = targetChanged ? min(targetScore + viewportScore * 0.3, 1.0) : viewportScore
acknowledged = finalScore > 0.1
```

---

## 5. Observable vs. Unobservable Changes

### Observable (Counts as Acknowledgment)
- Visible text changes in viewport
- Element additions/removals in DOM
- Attribute mutations (class, style, aria-*)
- Focus changes
- Scroll position changes >threshold
- URL/hash changes
- Modal/dialog appearances
- Loading indicators

### Unobservable (Does NOT Count)
- Internal state changes (Redux, Vuex, etc.)
- Console logs
- Network requests without UI feedback
- LocalStorage/SessionStorage mutations
- Timer/interval registrations
- Event listener additions
- CSS pseudo-class changes (:hover, :focus) without DOM mutation
- Offscreen element changes (display:none, outside viewport)

---

## 6. Timing Windows

All acknowledgment checks use these timeout windows:

```
NAVIGATION_TIMEOUT = 3000ms
SUBMISSION_TIMEOUT = 3000ms  
UI_FEEDBACK_TIMEOUT = 500ms
DOM_STALL_TIMEOUT = 3000ms   // Journey stall detection
```

**Rationale**: 
- 3000ms allows for slow networks and API calls
- 500ms is perceptually instant for UI feedback
- Timeouts are conservative (favor false negatives over false positives)

---

## 7. Implementation Contract

All detection logic in `src/verax/observe/` MUST:

1. Use the exact thresholds defined above
2. Document any deviation with rationale in code comments
3. Emit structured evidence with measurements (px, ms, element counts)
4. Be deterministic (same input → same output)
5. Favor false negatives (miss real issues) over false positives (cry wolf)

---

## 8. Test Requirements

Any PR modifying detection thresholds MUST include:

1. Unit tests verifying threshold boundaries (just above/below)
2. Integration tests with real browser observation
3. Regression tests ensuring determinism unchanged
4. Documentation update in this RULEBOOK.md

---

**End of Rulebook**
