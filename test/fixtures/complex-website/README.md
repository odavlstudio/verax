# Complex Website - VERAX Stress Test

A deliberately complex React website with intentional silent failures designed to stress-test **VERAX** (Silent Failure Detection Engine).

## Overview

This project demonstrates realistic, hard-to-detect bugs that don't crash or throw errors but fail silently. The bugs are technically "working" from a code perspective but don't deliver expected functionality.

## Features

### Intentional Silent Failures

#### 1. **Navigation Silent Failure** (Dashboard)
- **What Happens**: Click "Dashboard" → URL changes to `/dashboard` ✓
- **The Bug**: Dashboard content never renders
- **Why It's Silent**: No 404, no error message, no console error. Route works, component fails.

#### 2. **Form Silent Failure** (Settings)
- **What Happens**: Fill form → Click "Save Settings" → Button shows loading state
- **The Bug**: API succeeds but no success message, no redirect, no visual feedback
- **Why It's Silent**: Request completes successfully in the background. The bug is that the UI never acknowledges it.

#### 3. **Conditional UI Bug** (Profile)
- **What Happens**: Click "Login" → State updates to `isLoggedIn = true`
- **The Bug**: Login button doesn't disappear even though condition should hide it
- **Why It's Silent**: State changed, but UI doesn't reflect it. No error, just stale UI.

#### 4. **Async Race Condition** (Profile)
- **What Happens**: Load user data from two concurrent requests
- **The Bug**: Slow request (3s) overwrites fast request (500ms)
- **Why It's Silent**: Both succeed, no error. Just data silently replaced with outdated information.

#### 5. **Feature Flag Bug** (Settings)
- **What Happens**: "Advanced Settings" button is visible but feature flag is `false`
- **The Bug**: Button appears functional but does nothing when clicked
- **Why It's Silent**: No error, no disabled state, no message. Appears to work but doesn't.

## Tech Stack

- **React 18** - UI Framework
- **Vite** - Build tool
- **React Router DOM 6** - Client-side routing
- **useContext** - Global state management
- **Mock API** - setTimeout + Promise for simulated requests

## Installation

```bash
npm install
```

## Running

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
src/
├── App.jsx              # Main app with routing
├── index.css            # Global styles
├── main.jsx             # Entry point
├── api/
│   └── mockApi.js       # Mock API calls with intentional bugs
├── context/
│   ├── AuthContext.jsx  # Authentication state
│   └── FeatureFlagContext.jsx  # Feature flags (disabled by default)
└── pages/
    ├── Home.jsx         # Home page with navigation links
    ├── Dashboard.jsx    # NAVIGATION SILENT FAILURE
    ├── Settings.jsx     # FORM SILENT FAILURE + FEATURE FLAG BUG
    └── Profile.jsx      # CONDITIONAL UI BUG + RACE CONDITION
```

## Key Code Patterns

### Navigation Silent Failure (Dashboard.jsx)
```javascript
if (loading) {
  return null;  // Never sets loading to false
}
// Code below never executes
```

### Form Silent Failure (Settings.jsx)
```javascript
const handleSaveSettings = async () => {
  setSaving(true);
  const result = await submitSettings(settings);
  // Bug: Never calls setSaving(false) - button stays disabled
  // API succeeded, but UI doesn't know
};
```

### Conditional UI Bug (Profile.jsx)
```javascript
{!isLoggedIn && <button onClick={login}>Login</button>}
// After login, state updates but component doesn't re-render
// Button should disappear but doesn't
```

### Race Condition (Profile.jsx)
```javascript
fastPromise.then(data => setRaceData(data));  // Renders fast data
slowPromise.then(data => setRaceData(data));  // Overwrites with slow data
// Slow request completes after fast, replacing current data silently
```

### Feature Flag Bug (Settings.jsx)
```javascript
<button onClick={handleAdvancedSettingClick}>
  Advanced Settings
</button>
// Button shows but flags.advancedSettings === false
// Clicking does nothing, no visual indication
```

## VERAX Testing

This site is designed to test VERAX's ability to detect:
- ✅ Silent navigation failures
- ✅ Silent form submission failures
- ✅ Stale UI bugs
- ✅ Race condition data replacement
- ✅ Feature flag mismatches
- ✅ Unhandled promise completion
- ✅ State updates that don't render

## No Console Errors

All bugs are **completely silent**. Open DevTools → Console: no warnings, no errors, no messages.

## Debug Mode

Look for comments in source code marked with `// INTENTIONAL SILENT FAILURE` to understand each bug.

## Building

```bash
npm run build
```

## License

MIT
