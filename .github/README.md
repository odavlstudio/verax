# GitHub Infrastructure

This directory contains GitHub-specific configuration and automation:

- **`actions/`** — Custom GitHub Actions
- **`workflows/`** — CI/CD workflow definitions
- **`scripts/`** — CI-specific scripts (e.g., `verax-ci-summary.js`)

## Copilot & Development Governance

GitHub Copilot instructions and tool-specific guidelines have been moved to:

- `/docs/governance/copilot-instructions.md` — Binding execution rules for GitHub Copilot
- `/docs/governance/tools-instructions.md` — Tool-specific development guidelines

These were moved from `.github/` to `/docs/governance/` during STAGE 1 cleanup (January 2026) because they are **project governance documents**, not CI-specific infrastructure.

---

**For general project documentation, see `/docs/`.**
