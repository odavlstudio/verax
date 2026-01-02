# Phase 3.2: v1.0.0 Release Checklist

**Objective:** Validate release readiness before tagging and publishing v1.0.0

**Status:** Ready for final validation

---

## 1. Versioning Validation ✅

### package.json
- [x] Version is 1.0.0
- [x] Release state is "stable"
- [x] Description accurate ("final decision authority before launch")
- [x] License is MIT
- [x] Repository URL correct (odavlstudio/odavlguardian)
- [x] Bin entry points to bin/guardian.js
- [x] Main entry points to src/guardian/index.js

**Evidence:** Verified in [package.json](../package.json) lines 1-30

### CHANGELOG.md
- [x] v1.0.0 entry exists
- [x] Release date documented (2025-12-30)
- [x] Status: Stable (production-ready)
- [x] Key features listed:
  - Guardian as final decision authority
  - Observable Capabilities (VISIBLE = MUST WORK)
  - Deterministic verdicts (READY/FRICTION/DO_NOT_LAUNCH)
  - CLI, npm package, VS Code extension aligned
  - Read-only transparency (decision.json)
  - No overrides, no force-ready flags

**Evidence:** Verified in [CHANGELOG.md](../CHANGELOG.md) lines 1-50

---

## 2. Release Notes Quality ✅

### RELEASE_NOTES_v1.0.0.md
- [x] Title: v1.0.0 — Deployment Decision Engine
- [x] Sections complete:
  - [x] What Guardian Decides (clear, factual)
  - [x] Who It's For (CI/CD operators, release engineers)
  - [x] How to Try in 10 Minutes (Quickstart link + example workflow)
  - [x] What It Is NOT (7 explicit non-capabilities)
  - [x] Known Limitations (scope, constraints, cannot-observe list)
  - [x] Post-Launch Monitoring (Live mode)
  - [x] Feedback (GitHub issue templates, no telemetry)
  - [x] Changelog summary
  - [x] Installation instructions
  - [x] Documentation links
- [x] Tone: Factual and restrained (no hype, no promises beyond v1.0.0)
- [x] Soft launch aligned (learning mode, GitHub-only feedback)

**Evidence:** Created in [RELEASE_NOTES_v1.0.0.md](../RELEASE_NOTES_v1.0.0.md)

---

## 3. Documentation Link Validation

### README.md Links
- [ ] "Try it in 10 minutes" link → docs/quickstart/CI_GITHUB_ACTION.md works
- [ ] "Understanding Guardian's Output" link → docs/ARTIFACT_ORIENTATION.md works
- [ ] "Clarity issue" template link → .github/ISSUE_TEMPLATE/clarity.yml works
- [ ] "Adoption blocker" template link → .github/ISSUE_TEMPLATE/adoption.yml works
- [ ] Ground-truth links work:
  - [ ] docs/ground-truth/ONE_LINER.md
  - [ ] docs/ground-truth/CORE_PROMISE.md
  - [ ] docs/README.technical.md

**Action Required:** Test each link in a browser before release

### RELEASE_NOTES_v1.0.0.md Links
- [ ] Quickstart link → docs/quickstart/CI_GITHUB_ACTION.md works
- [ ] action.yml link works
- [ ] Issue template links work (clarity.yml, adoption.yml)
- [ ] Documentation links work (5 links to ground-truth and technical docs)
- [ ] CHANGELOG.md link works
- [ ] LICENSE link works

**Action Required:** Test each link in GitHub release preview

---

## 4. Quickstart Workflow Validation

### CI_GITHUB_ACTION.md
- [ ] Copy/paste workflow from Quickstart into fresh repo
- [ ] Workflow runs successfully (no syntax errors)
- [ ] Guardian executes and returns exit code
- [ ] decision.json artifact appears in .odavlguardian/ directory
- [ ] HTML report appears in .odavlguardian/latest/
- [ ] Example URL (staging.example.com) can be replaced with real URL

**Action Required:** Test in isolated repository before release

### Example Workflow (examples/github-action/)
- [ ] README.md instructions accurate
- [ ] workflow.yml syntax valid
- [ ] Comments in workflow.yml helpful
- [ ] Example buildable in isolation

**Action Required:** Validate example workflow

---

## 5. Artifact Schema Validation

### decision.json
- [ ] Schema unchanged from v1.0.0 baseline
- [ ] All fields documented in ARTIFACT_ORIENTATION.md:
  - verdict (READY/FRICTION/DO_NOT_LAUNCH)
  - verdict_code (0/1/2)
  - timestamp
  - url
  - preset
  - evidence (flows, coverage, reasons)
- [ ] Example in samples/decision.json valid

**Action Required:** Generate fresh decision.json and compare to documented schema

### HTML Report
- [ ] Report renders correctly in browser
- [ ] Screenshots visible
- [ ] Verdict clearly displayed
- [ ] Flow results expandable
- [ ] No broken images or CSS

**Action Required:** Generate fresh HTML report and review

---

## 6. Known Limitations Accuracy

### Verify Each Limitation in RELEASE_NOTES_v1.0.0.md
- [ ] Multi-user auth flows: Confirmed limited (only single-user login)
- [ ] JS-heavy SPAs: Confirmed basic support only
- [ ] Mobile flows: Confirmed desktop-only (viewport emulation available)
- [ ] Multi-language: Confirmed single locale per run
- [ ] Complex forms: Confirmed basic support only
- [ ] Node.js 18+ requirement: Confirmed in package.json engines
- [ ] Chromium-only: Confirmed (Playwright default)
- [ ] Single URL per run: Confirmed (no multi-page orchestration)
- [ ] No cloud execution: Confirmed (local/CI only)
- [ ] No telemetry: Verified in codebase (grep search confirmed zero tracking)

**Action Required:** Spot-check limitations against actual behavior

---

## 7. Soft Launch Alignment

### Release Notes Match Soft Launch Principles
- [x] No hype or marketing language
- [x] No promises beyond v1.0.0 scope
- [x] No roadmap claims
- [x] No "coming soon" features
- [x] Honest about limitations
- [x] GitHub-only feedback mechanism
- [x] No external analytics or tracking mentioned
- [x] Factual tone throughout

**Evidence:** Release notes reviewed for soft launch compliance

### Feedback Mechanism Ready
- [x] GitHub issue templates tested (clarity.yml, adoption.yml)
- [x] Templates linked in README and release notes
- [x] "How to Give Feedback" section clear
- [x] No external forms or tools required

**Action Required:** Post test issue to each template before release

---

## 8. Pre-Release Sanity Tests

### Core Functionality
- [ ] `guardian reality --url https://example.com` runs without errors
- [ ] Exit code 0 for working site
- [ ] Exit code 2 for broken site (test with invalid URL)
- [ ] decision.json generated correctly
- [ ] HTML report generated correctly
- [ ] `guardian --version` returns 1.0.0
- [ ] `guardian --help` displays help text

**Action Required:** Run each command and verify behavior

### GitHub Action Integration
- [ ] action.yml syntax valid
- [ ] Inputs documented (url, preset, fail-on)
- [ ] Outputs documented (verdict, exit-code, run-id)
- [ ] Example usage in action.yml matches Quickstart

**Action Required:** Validate action.yml schema

---

## 9. External Dependencies Check

### No External Services Required
- [x] No API keys required
- [x] No cloud accounts required
- [x] No telemetry endpoints
- [x] No analytics services
- [x] No payment gating
- [x] Works fully offline (after npm install)

**Evidence:** Grep search confirmed zero external services in core

---

## 10. Release Day Checklist

### Before Tagging v1.0.0
- [ ] All validation items above completed
- [ ] All tests pass (`npm test` or equivalent)
- [ ] No uncommitted changes in main branch
- [ ] CHANGELOG.md final review
- [ ] RELEASE_NOTES_v1.0.0.md final review

### Tagging and Publishing
- [ ] Create Git tag: `git tag -a v1.0.0 -m "v1.0.0 — Deployment Decision Engine"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Create GitHub Release using RELEASE_NOTES_v1.0.0.md content
- [ ] Attach no binaries (npm package published separately if needed)
- [ ] Mark as "Latest Release"

### Post-Release
- [ ] Verify GitHub Release page renders correctly
- [ ] Test release notes links in GitHub UI
- [ ] Verify version badge in README updates (if using shields.io)
- [ ] Post to HackerNews, IndieHackers, Dev.to (use templates from SOFT_LAUNCH_CHECKLIST.md)

---

## 11. First 24 Hours Monitoring

### GitHub Issues Dashboard
- [ ] Set up GitHub Issues view filtered by labels (clarity, adoption)
- [ ] Monitor for new issues every 4 hours
- [ ] Respond within 24 hours to all issues
- [ ] Categorize issues: clarity, adoption, verdict-accuracy, feature-request

### Healthy Signals (Expected)
- GitHub stars increasing
- Clarification questions on Quickstart
- Environment-specific questions (Node version, CI/CD system)
- Feature requests for future versions

### Concerning Signals (Requires Immediate Action)
- Verdict accuracy complaints ("Guardian said READY but site was broken")
- Exit codes wrong or inconsistent
- decision.json malformed or missing fields
- Quickstart workflow doesn't run

**Action Required:** Prepare response templates for each signal type

---

## Completion Summary

**Phase 3.2 Deliverables:**
- [x] RELEASE_NOTES_v1.0.0.md created (comprehensive, factual, soft-launch aligned)
- [x] docs/phase-3/RELEASE_CHECKLIST.md created (this document)
- [x] Versioning validated (package.json 1.0.0, CHANGELOG.md accurate)

**Ready for Release:** YES (pending validation items)

**Next Action:** Complete validation items (sections 3-8) before tagging v1.0.0

---

*Checklist created for Phase 3.2: v1.0.0 Release preparation*  
*Date: December 31, 2025*
