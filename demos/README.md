# VERAX Demos

**Purpose**: User-facing example applications demonstrating VERAX integration and capabilities.

## Current Demos

- `demo-nextjs/` — Next.js demo app (app router) for showcasing VERAX
- `demo-react/` — React SPA demo for onboarding
- `demo-static/` — Static HTML demo for simplest flow

## Purpose & Governance

### What Demos Are

Demos are **illustrative examples** intended to:
- Demonstrate VERAX integration patterns
- Serve as onboarding resources for new users
- Showcase best practices for VERAX usage
- Provide copy-paste starting points for common frameworks

### What Demos Are NOT

Demos are **not**:
- Test fixtures (those belong in `test/fixtures/`)
- Production-ready code (they are simplified examples)
- Exhaustive feature showcases (they demonstrate core patterns only)
- CI validation targets (they are not run in automated tests)

## Maintenance Expectations

Demos should be:
- **Kept in sync** with major VERAX API changes
- **Minimally complex** (avoid unnecessary dependencies or features)
- **Self-contained** (each demo should work independently)
- **Documented** (README per demo explaining what it demonstrates)

When VERAX introduces breaking changes, demos must be updated before the next release.

## Adding New Demos

To add a new demo:
1. Ensure it demonstrates a pattern not covered by existing demos
2. Keep dependencies minimal
3. Include a demo-specific README explaining what it demonstrates
4. Verify it works with the current VERAX version
5. Use naming convention: `demo-<framework-or-pattern>/`

## CI Relationship

Demos are **not** automatically tested in CI. They are maintained manually as documentation/examples.

If a demo needs automated validation, it should be converted to a proper integration test in `/test/`.

---

**Note**: Test fixtures (used by integration tests) live under `test/fixtures/` to keep demos clean and focused on user-facing examples.
