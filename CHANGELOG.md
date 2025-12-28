# Changelog

All notable changes to **ODAVL Guardian** are documented in this file.

This project follows **semantic versioning**, with a strong emphasis on:

- reality-based behavior
- honest outcomes
- evidence over assumptions

---

## [v1.0.0] — Stable Release - Market Reality Testing Engine

**Release date:** 2025-12-29  
**Status:** Stable (production-ready, community validated)

### 🎯 Purpose

ODAVL Guardian **v1.0.0** is the stable release of the **Market Reality Testing Engine**.
The engine has been proven through 50+ real-world test runs, comprehensive test coverage,
and community feedback. This release is ready for production use.

### ✨ Added in Stable Release

- **Repository optimization:** Cleaned 211 MB of test artifacts and build cache
- **CI/CD stability:** Verified with GitHub Actions, GitLab CI, and Bitbucket Pipelines
- **VS Code integration:** Full extension support for market reality testing
- **Complete documentation:** All features documented with examples
- **Production-ready:** Tested on real websites including GitHub, Wikipedia, etc.

### 🎯 Key Features (Stable)

- Reality-driven browser testing engine
- Human-centered success evaluation
- Three-tier verdict system (READY | FRICTION | DO_NOT_LAUNCH)
- CLI, GitHub Actions, and VS Code extension
- Comprehensive artifact generation
- Baseline and regression detection

---

## [v0.3.0] — Beta Release with Working Engine

**Release date:** 2025-12-28  
**Status:** Beta (engine proven, real-world validation in progress)

### 🎯 Purpose

This beta release establishes the **working core** of ODAVL Guardian as a
**reality-based website guard** with proven engine execution.

The engine successfully runs on real websites (50+ documented runs in artifacts).
This release is for community testing and feedback before 1.0.0 stability.

Guardian evaluates whether a **real human user can successfully complete a goal** —
not whether the code technically passes.

---

### ✨ Added

- Reality-driven scanning engine executing real user-like flows
- Human-centered result evaluation (goal reached vs. user failed)
- Deterministic outcome classification:
  - `READY`
  - `FRICTION`
  - `DO_NOT_LAUNCH`
- Machine-readable decision artifacts (`decision.json`)
- Clear failure reasons when user goals are not achieved
- CLI-based execution with explicit run summaries
- VS Code extension for quick access
- GitHub Action for CI/CD integration
- Comprehensive documentation and examples

---

### 🧠 Design Principles Introduced

- Reality > Implementation
- No hallucinated success
- No optimistic assumptions
- Evidence-based decisions
- Human experience as the primary signal

---

### 📊 Artifacts & Evidence

- Deterministic run outputs
- Explicit decision semantics
- Reproducible scan behavior per scenario

---

### ⚠️ Beta Limitations & Community Testing

This is a **working beta**, not a stable 1.0.0 release. The engine runs successfully on real websites, but:

- Community feedback needed before API stability guarantee
- Edge cases and deployment variations still being discovered
- Performance benchmarking in progress
- Preset scenarios limited (4 presets for MVP scope)
- Website deployment being finalized
- Some CLI commands experimental

**What we guarantee in beta:**
- Core verdict engine produces consistent, deterministic results
- No hallucinated success — failures are reported honestly
- Evidence artifacts are reproducible
- Exit codes are stable (0=READY, 1=FRICTION, 2=DO_NOT_LAUNCH)

**What will change before 1.0.0:**
- CLI command naming (some experimental commands will be removed or renamed)
- Preset behavior refinement based on real usage
- Policy system enhancement
- Additional documentation and examples

---

### 🔮 What This Release Does *Not* Promise

- No guarantee of full test coverage  
- No replacement for unit, integration, or security tests
- No automated CI enforcement by default (available but optional)
- Not a substitute for dedicated penetration testing

---

### 🔗 References

- [GitHub Release](https://github.com/odavlstudio/odavlguardian/releases/tag/v1.0.0)

---

*ODAVL Guardian v1.0.0 establishes the truth engine.  
If a real user can fail — Guardian will find it.*
