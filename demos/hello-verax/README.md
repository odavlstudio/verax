# Hello VERAX Demo

This is a minimal demo site for VERAX with an **intentional silent failure** in the signup form.

## What's broken

The signup form (`/signup.html`) accepts input but does nothing when you click Submit. There's no UI feedback, no navigation, no confirmation. This is exactly the kind of silent failure VERAX is designed to detect.

## Running the demo

```bash
# Terminal 1: Start the fixture server
npm run demo

# Terminal 2: Run VERAX against the fixture
npm run verax:demo
```

## Expected output

VERAX should report:
- **Verdict:** FINDINGS
- **Top finding:** signup-submit-no-feedback (or similar)
- **Evidence:** Screenshot showing form state, console logs, network activity

## Files

- `index.html` — Landing page with working "ping" button
- `signup.html` — Form with intentional silent failure
- `faq.html` — Static FAQ page
