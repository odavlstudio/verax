# Svelte Realistic Fixture

This fixture demonstrates real-world Svelte.js patterns with intentional silent failures for testing VERAX Phase 20 Svelte support.

## Intentional Silent Failures

1. **Navigation Silent Failure** (`src/components/HomePage.svelte`):
   - Button with `on:click={navigateToAbout}` that calls `goto('/about')`
   - Route exists but navigation fails silently (no URL change, no feedback)
   - **Expected**: CONFIRMED finding with evidence package

2. **Network Silent Failure** (`src/components/HomePage.svelte`):
   - Form submission triggers `fetch('/api/contact', { method: 'POST' })`
   - Network request fails but no UI feedback (no loading indicator, no error message)
   - **Expected**: CONFIRMED finding with evidence package

3. **State Silent Failure** (`src/components/HomePage.svelte`):
   - Button with `on:click={toggleModal}` that sets `isOpen = !isOpen`
   - State mutation fails silently (state doesn't change)
   - **Expected**: CONFIRMED finding with evidence package

4. **False Positive Trap** (`src/components/HomePage.svelte`):
   - Analytics tracking button that calls analytics API
   - Should NOT be reported as a silent failure (analytics-only)
   - **Expected**: Guardrails should prevent false positive

5. **Ambiguous Case** (`src/components/ContactForm.svelte`):
   - Dynamic state mutation with reactive store
   - Partial UI change (some state updates but unclear)
   - **Expected**: SUSPECTED finding with medium confidence

6. **Validation Silent Failure** (`src/components/ContactForm.svelte`):
   - Form validation errors should show inline feedback
   - Validation fails but no error message displayed
   - **Expected**: CONFIRMED finding if validation feedback missing

## Determinism Rules

- No random data
- No external network calls
- No time-based nondeterminism
- All routes are static or deterministically normalized

## Capabilities Tested

- `svelte-navigation-detection`: Svelte navigation promise detection (links, goto)
- `svelte-network-detection`: Svelte network call detection in handlers
- `svelte-state-detection`: Svelte state mutation detection (reactive stores, assignments)
- `navigation-silent-failure`: Navigation promise detection
- `network-silent-failure`: Network call detection in Svelte handlers
- `state-silent-failure`: Svelte state mutation detection
- `ui-feedback-missing`: UI feedback detection

