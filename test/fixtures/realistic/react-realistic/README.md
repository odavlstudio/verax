# React Realistic Fixture

## What This Simulates
A realistic React single-page application (e.g., dashboard, admin panel) with intentional silent failures.

## Capabilities Exercised
- `route-detection-react-router`
- `route-validation-reachability`
- `dynamic-route-normalization`
- `route-intelligence-correlation`
- `dynamic-route-intelligence`
- `network-detection-top-level`
- `network-detection-handler`
- `network-detection-useeffect`
- `network-request-observation`
- `state-detection-usestate`
- `state-detection-redux`
- `state-detection-zustand`
- `state-mutation-observation`
- `state-silent-failure`
- `network-silent-failure`
- `ui-feedback-loading`
- `ui-feedback-disabled`
- `ui-feedback-toast`
- `ui-feedback-dom-change`
- `ui-feedback-intelligence`
- `ui-feedback-missing`
- `confidence-unified-system`
- `evidence-law-enforcement`
- `evidence-substantive-check`
- `evidence-downgrade-suspected`

## Intentional Silent Failures

### 1. CONFIRMED: Save Button Network Failure (network-silent-failure)
- **Location**: `src/components/UserProfile.jsx`
- **Issue**: Save button promises network request but fails silently (no error, no feedback)
- **Expected**: Should be reported as CONFIRMED finding with network evidence

### 2. CONFIRMED: State Update Failure (state-silent-failure)
- **Location**: `src/components/TogglePanel.jsx`
- **Issue**: Button promises state update (modal opens) but state doesn't change
- **Expected**: Should be reported as CONFIRMED finding with state evidence

### 3. FALSE POSITIVE TRAP: Analytics Event (should NOT be reported)
- **Location**: `src/components/UserProfile.jsx`
- **Issue**: Analytics tracking call that intentionally does nothing
- **Expected**: Should NOT be reported (not a user-facing promise)

### 4. PARTIAL/AMBIGUOUS: Delete Confirmation (confidence < 1)
- **Location**: `src/components/ItemList.jsx`
- **Issue**: Delete button may or may not work (depends on item state)
- **Expected**: Should be reported with MEDIUM confidence

### 5. CONFIRMED: Missing Loading Feedback (ui-feedback-missing)
- **Location**: `src/components/DataLoader.jsx`
- **Issue**: Data fetch promises loading indicator but none appears
- **Expected**: Should be reported as missing UI feedback

## Determinism Rules
- All network calls use mock endpoints
- No external dependencies
- No random data
- State changes are deterministic

