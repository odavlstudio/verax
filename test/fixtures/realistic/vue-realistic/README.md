# Vue Realistic Fixture

This fixture demonstrates real-world Vue.js patterns with intentional silent failures for testing VERAX Phase 20 Vue support.

## Intentional Silent Failures

1. **Navigation Silent Failure** (`src/components/HomePage.vue`):
   - Button with `@click="navigateToAbout"` that calls `router.push('/about')`
   - Route exists but navigation fails silently (no URL change, no feedback)
   - **Expected**: CONFIRMED finding with evidence package

2. **Network Silent Failure** (`src/components/ContactForm.vue`):
   - Form submission triggers `fetch('/api/contact', { method: 'POST' })`
   - Network request succeeds but no UI feedback (no loading indicator, no success message)
   - **Expected**: CONFIRMED finding with evidence package

3. **False Positive Trap** (`src/components/Analytics.vue`):
   - Analytics tracking button that calls analytics API
   - Should NOT be reported as a silent failure (analytics-only)
   - **Expected**: Guardrails should prevent false positive

4. **Ambiguous Case** (`src/components/UserProfile.vue`):
   - Dynamic route navigation: `router.push({ name: 'user', params: { id: userId }})`
   - Partial UI change (some state updates but route unclear)
   - **Expected**: SUSPECTED finding with medium confidence

5. **Validation Silent Failure** (`src/components/LoginForm.vue`):
   - Form validation errors should show inline feedback
   - Validation fails but no error message displayed
   - **Expected**: CONFIRMED finding if validation feedback missing

## Determinism Rules

- No random data
- No external network calls
- No time-based nondeterminism
- All routes are static or deterministically normalized

## Capabilities Tested

- `route-detection-vue-router`: Vue Router route extraction
- `route-validation-reachability`: Route HTTP reachability validation
- `dynamic-route-normalization`: Dynamic route pattern normalization
- `route-intelligence-correlation`: Navigation promise to route correlation
- `dynamic-route-intelligence`: Dynamic route verifiability classification
- `vue-navigation-detection`: Vue navigation promise detection (<router-link>, router.push/replace)
- `vue-network-detection`: Vue network call detection in handlers/hooks
- `vue-state-detection`: Vue state mutation detection (ref/reactive used in templates)
- `navigation-silent-failure`: Navigation promise detection
- `network-silent-failure`: Network call detection in Vue handlers
- `state-silent-failure`: Vue state mutation detection (ref/reactive)
- `ui-feedback-missing`: UI feedback detection

