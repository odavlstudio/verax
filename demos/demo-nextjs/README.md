# VERAX Demo: Next.js Application

This is a minimal Next.js application with an **intentional silent failure** designed to demonstrate VERAX's silent failure detection capability.

## The Silent Failure

This Next.js app contains a form submission bug:

- **What you see**: Button text changes to "⏳ Submitting..." when clicked
- **What should happen**: Server processes the form and shows success/error message
- **What actually happens**: The form data is sent but the response is never processed

The fetch request is initiated but the response handler is incomplete. The user sees a loading state that never ends, with no indication of success or failure. The application silently fails to complete the transaction.

## Installation

### Prerequisites

- Node.js >= 18.0.0
- @veraxhq/verax installed globally:

```bash
npm install -g @veraxhq/verax
```

### Setup

1. Install Next.js dependencies:

```bash
cd demos/demo-nextjs
npm install
```

2. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Running VERAX

In the repository root, run:

```bash
verax run --url http://localhost:3000 --src ./demos/demo-nextjs --out ./demos/demo-nextjs/.verax
```

This will:

1. Start headless browser automation
2. Navigate to your Next.js app
3. Interact with the form (fill email and submit)
4. Analyze the flow for silent failures
5. Generate evidence files

## Expected Results

VERAX should detect:

- **Silent Failure**: The form submission that initiates but never completes
- **Response Handler Missing**: The fetch response is never processed
- **No User Feedback**: Loading state persists indefinitely with no resolution

Evidence will be in `./demos/demo-nextjs/.verax/`:

- `learn.json` - Initial expectations learned from the app
- `observe.json` - Behavior observed during the scan
- `findings.json` - Potential issues (silent failures, incomplete handlers)
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
- [Other Demos](../) - Static HTML and React examples

## Questions?

If VERAX doesn't detect the silent failure, check:

1. Is the Next.js development server running? (`npm run dev`)
2. Does it show "ready - started server on 0.0.0.0:3000"?
3. Is the URL correct in your VERAX command?
4. Does `verax doctor --json` show all systems ready?

Run `verax doctor --json` to verify your environment is ready for scanning.
