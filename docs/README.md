# Documentation Index

Welcome to Guardian documentation. Choose a guide based on what you need.

---

## Repository Navigation

- [Repository Structure Guide](REPOSITORY_STRUCTURE.md) — Overview of how the repository is organized

---

## Getting Started

**New to Guardian?** Start here:

- [README.md](../README.md) — Product overview and core concepts
- [REAL_USER_STORY.md](REAL_USER_STORY.md) — Real-world example of using Guardian

---

## Understanding Verdicts

- [VERDICTS.md](VERDICTS.md) — Detailed explanation of READY, FRICTION, and DO_NOT_LAUNCH
- [DECISION_CONFIDENCE.md](DECISION_CONFIDENCE.md) — How Guardian builds confidence in its verdicts

---

## Integration & Usage

- [CI-CD-USAGE.md](CI-CD-USAGE.md) — Integrating Guardian into your deployment pipeline
- [WATCHDOG.md](WATCHDOG.md) — Production monitoring after deployment
- [quickstart/CI_GITHUB_ACTION.md](quickstart/CI_GITHUB_ACTION.md) — Quick start for GitHub Actions
- [ARTIFACT_ORIENTATION.md](ARTIFACT_ORIENTATION.md) — Reading Guardian's output files (decision.json, reports)

---

## Understanding Guardian's Signals

- [NETWORK-SECURITY.md](NETWORK-SECURITY.md) — How Guardian detects network issues
- [README.technical.md](README.technical.md) — Technical reference for advanced usage

---

## For Developers & Integrators

- [README.technical.md](README.technical.md) — Architecture, API reference, programmatic usage

---

## Internal Documentation (Design & Process)

Guardian's internal design docs are in [internal/](internal/) for developer reference only:

- `internal/design/` — Product philosophy, authority model, design decisions
- `internal/contracts/` — Behavior contracts and quality guarantees
- `internal/phases/` — Phase-by-phase development documentation
- `internal/examples/` — Demo code and examples

---

## FAQ

**Q: Can I override Guardian's verdict?**  
A: Guardian is informational—you can ignore it. But DO_NOT_LAUNCH verdicts indicate real failures. We recommend respecting them.

**Q: What if Guardian's verdict is wrong?**  
A: Open an issue on [GitHub](https://github.com/odavlstudio/odavlguardian/issues) with your decision.json and site URL. We learn from disagreements.

**Q: How do I test static sites (landing pages)?**  
A: Run Guardian normally. Static sites will get FRICTION (limited coverage) which is not a blocker. It's safe to deploy.

**Q: Can I run Guardian on production?**  
A: Yes. Guardian is read-only and doesn't modify your site. Use watchdog mode for continuous monitoring.

**Q: How long does Guardian take to run?**  
A: Typically 1-2 minutes. Use `--fast` flag for quicker runs.

