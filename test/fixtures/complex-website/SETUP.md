# Complex Website - VERAX Stress Test Setup

## ✅ Complete Project Created

Location: `c:\Users\sabou\verax\artifacts\test-fixtures\complex-website`

## 📁 Project Structure

```
complex-website/
├── index.html                    # HTML entry point
├── package.json                  # Dependencies (React, Vite, React Router)
├── vite.config.js               # Vite configuration
├── README.md                     # Comprehensive documentation
├── public/                       # Static assets
└── src/
    ├── main.jsx                  # React entry point
    ├── App.jsx                   # Main app with routing
    ├── index.css                 # Global styles (complete CSS)
    ├── api/
    │   └── mockApi.js            # Mock API with 5 intentional bugs
    ├── context/
    │   ├── AuthContext.jsx       # Auth state management
    │   └── FeatureFlagContext.jsx # Feature flags (all false)
    └── pages/
        ├── Home.jsx              # Home page with navigation
        ├── Dashboard.jsx         # ❌ BUG #1: Navigation silent failure
        ├── Settings.jsx          # ❌ BUG #2: Form silent failure
        │                          # ❌ BUG #5: Feature flag bug
        └── Profile.jsx           # ❌ BUG #3: Conditional UI bug
                                  # ❌ BUG #4: Async race condition
```

## 🐛 Intentional Silent Failures Implemented

### 1️⃣ Navigation Silent Failure (Dashboard)
**Location**: [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx)
- URL changes to `/dashboard` ✓
- Component never renders because `loading` state never becomes `false`
- No error, no crash, just empty screen

### 2️⃣ Form Silent Failure (Settings)
**Location**: [src/pages/Settings.jsx](./src/pages/Settings.jsx)
- Form saves, API succeeds
- `setSaving(false)` never called
- No success message, button stays disabled forever
- Complete silent success with no feedback

### 3️⃣ Conditional UI Bug (Profile)
**Location**: [src/pages/Profile.jsx](./src/pages/Profile.jsx)
- Click "Login", state updates to `isLoggedIn = true`
- Login button should disappear but stays visible
- Classic stale UI bug

### 4️⃣ Async Race Condition (Profile)
**Location**: [src/pages/Profile.jsx](./src/pages/Profile.jsx)
- Two API calls fire simultaneously
- Fast request (500ms) completes first
- Slow request (3000ms) overwrites data silently
- UI shows correct data briefly, then changes to outdated data
- Observable in the "source" field (FAST_REQUEST → SLOW_REQUEST)

### 5️⃣ Feature Flag Bug (Settings)
**Location**: [src/pages/Settings.jsx](./src/pages/Settings.jsx)
- "Advanced Settings" button is visible
- Feature flag `advancedSettings === false`
- Button appears clickable but does nothing
- No disabled state, no error, no message

## 🚀 Quick Start

### Installation
```bash
cd c:\Users\sabou\verax\artifacts\test-fixtures\complex-website
npm install
```

### Run Development Server
```bash
npm run dev
```
- Automatically opens http://localhost:5173
- Hot module replacement enabled
- Full React DevTools support

### Build for Production
```bash
npm run build
```

## 🔍 Testing with VERAX

Navigate through the pages:

1. **Home** → Shows overview of all bugs
2. **Dashboard** → Click to test navigation failure
3. **Settings** → Test form submission + feature flag
4. **Profile** → Test login button + race condition

## 📊 Key Characteristics

✅ **All bugs are completely silent**
- No console errors
- No console warnings
- No exceptions thrown
- No network error messages
- App appears functional

✅ **All code is intentional**
- Clearly marked with `// INTENTIONAL SILENT FAILURE` comments
- Comments explain the specific bug and why it's silent

✅ **Realistic patterns**
- Uses React hooks properly (no React warnings)
- Valid HTML/CSS
- Proper component structure
- Real-world bug patterns

✅ **No external dependencies**
- Mock API uses only setTimeout and Promise
- No backend required
- Pure frontend implementation

## 📝 Code Comments

Every intentional bug includes detailed comments explaining:
1. What the bug is
2. Why it's silent
3. What the expected behavior would be
4. Where the bug is in the code

Example:
```javascript
// INTENTIONAL SILENT FAILURE: Feature flag is false, but button still shows
// Clicking does nothing because the feature is disabled
// But there's no visual indication (no disabled state, no error message)
```

## 💡 VERAX Detection Targets

This stress test is designed to challenge VERAX's ability to detect:

| Bug Type | Detection Challenge |
|----------|-------------------|
| Navigation Failure | Route works but content missing |
| Form Failure | Request succeeds but no feedback |
| State/UI Mismatch | State updates don't reflect in UI |
| Race Conditions | Silent data replacement |
| Feature Toggles | Disabled features still visible |
| Promise Handling | Unresolved async operations |
| Error Boundaries | Graceful failures without errors |

## 📚 Documentation

Full documentation is available in:
- [README.md](./README.md) - Comprehensive guide
- [src/api/mockApi.js](./src/api/mockApi.js) - API patterns with bugs
- Source code comments - Inline bug documentation

## ✨ Features

- ✅ Complete React project setup
- ✅ 5 distinct intentional bugs
- ✅ Professional styling with CSS
- ✅ Proper React patterns
- ✅ Multiple navigation flows
- ✅ State management (useContext)
- ✅ Mock API simulation
- ✅ Feature flags system
- ✅ Race condition testing
- ✅ Async/await patterns

## 🎯 Purpose

Created as a stress test for **VERAX** - a silent failure detection engine. This website demonstrates how bugs can:
- Succeed without feedback
- Silently fail without errors
- Appear to work while broken
- Update state without rendering
- Replace data without notification

All without generating a single console error or exception.
