# VERAX Demo: React Application

This is a minimal React application with an **intentional silent failure** designed to demonstrate VERAX's silent failure detection capability.

## The Silent Failure

This React app contains a "Save" button with a critical bug:

- **What you see**: Button text changes to "Saving..." when clicked
- **What should happen**: After completion, the button resets and shows "Saved!"
- **What actually happens**: The button stays frozen on "Saving..." forever

The save operation triggers a network request but the response handling is missing, so the user gets no success or error feedback. The application silently fails to complete its core transaction.

## Installation

### Prerequisites

- Node.js >= 18.0.0
- @veraxhq/verax installed globally:

```bash
npm install -g @veraxhq/verax
```

### Setup

1. Install React dependencies:

```bash
cd demos/demo-react
npm install
```

2. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or similar Vite port).

## Running VERAX

In the repository root, run:

```bash
verax run --url http://localhost:5173 --src ./demos/demo-react --out ./demos/demo-react/.verax
```

This will:

1. Start headless browser automation
2. Navigate to your React app
3. Interact with the UI (click the Save button)
4. Analyze the flow for silent failures
5. Generate evidence files

## Expected Results

VERAX should detect:

- **Silent Failure**: The Save button click that initiates but never completes
- **Flow Break**: The promise that's never resolved
- **Coverage Gap**: No error handling for the incomplete operation

Evidence will be in `./demos/demo-react/.verax/`:

- `learn.json` - Initial expectations learned from the app
- `observe.json` - Behavior observed during the scan
- `findings.json` - Potential issues (silent failures, missing handlers)
- `summary.json` - High-level metrics and findings count

## Privacy & Security

VERAX **never** captures sensitive data:

- ✅ Network headers are redacted (Authorization, Cookie, etc.)
- ✅ Bearer tokens in URLs are redacted
- ✅ Console output is scanned and redacted
- ✅ All evidence is written locally only

You can safely run VERAX on internal applications or ones with authentication—all credentials stay confidential.

## Learning More

- [VERAX README](../../README.md) - Project overview
- [CHANGELOG](../../CHANGELOG.md) - Feature history
- [Other Demos](../) - Static HTML and Next.js examples

## Questions?

If VERAX doesn't detect the silent failure, check:

1. Is the React development server running? (`npm run dev`)
2. Is the URL correct? (Check your terminal for the actual port)
3. Does `verax doctor --json` show all systems ready?
4. Are there any console errors in the React dev server?

Run `verax doctor --json` to verify your environment is ready for scanning.
