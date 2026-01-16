# Angular Realistic Fixture

This fixture demonstrates real-world Angular patterns with intentional silent failures for testing VERAX Phase 20 Angular support.

## Intentional Silent Failures

1. **Navigation Silent Failure** (`src/app/components/home-page.component.ts`):
   - Button with `(click)="navigateToAbout()"` that calls `router.navigate(['/about'])`
   - Route exists but navigation fails silently (no URL change, no feedback)
   - **Expected**: CONFIRMED finding with evidence package

2. **Network Silent Failure** (`src/app/components/home-page.component.ts`):
   - Form submission triggers `http.post('/api/contact', {})`
   - Network request fails but no UI feedback (no loading indicator, no error message)
   - **Expected**: CONFIRMED finding with evidence package

3. **State Silent Failure** (`src/app/components/home-page.component.ts`):
   - Button with `(click)="toggleModal()"` that sets `this.isOpen = !this.isOpen`
   - State mutation fails silently (state doesn't change)
   - **Expected**: CONFIRMED finding with evidence package

4. **False Positive Trap** (`src/app/components/home-page.component.ts`):
   - Analytics tracking button that calls analytics API
   - Should NOT be reported as a silent failure (analytics-only)
   - **Expected**: Guardrails should prevent false positive

5. **Ambiguous Case** (`src/app/components/contact-form.component.ts`):
   - Dynamic state mutation with form binding
   - Partial UI change (some state updates but unclear)
   - **Expected**: SUSPECTED finding with medium confidence

6. **Validation Silent Failure** (`src/app/components/contact-form.component.ts`):
   - Form validation errors should show inline feedback
   - Validation fails but no error message displayed
   - **Expected**: CONFIRMED finding if validation feedback missing

## Determinism Rules

- No random data
- No external network calls
- No time-based nondeterminism
- All routes are static or deterministically normalized

## Capabilities Tested

- `angular-navigation-detection`: Angular navigation promise detection (routerLink, Router.navigate)
- `angular-network-detection`: Angular network call detection in component methods (HttpClient, fetch)
- `angular-state-detection`: Angular state mutation detection (component properties used in templates)
- `navigation-silent-failure`: Navigation promise detection
- `network-silent-failure`: Network call detection in Angular handlers
- `state-silent-failure`: Angular state mutation detection
- `ui-feedback-missing`: UI feedback detection

