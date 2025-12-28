# 🚀 ODAVL Guardian v1.0.0 Release Notes

## Status: PRODUCTION READY ✅

**Release Date:** December 29, 2025  
**Version:** 1.0.0 (Stable)  
**Previous:** v0.3.0 (Beta)

---

## What's New in v1.0.0

### 🎯 Graduation to Stable

- **50+ real-world validations** across production websites
- **100% test coverage** for core stability scoring
- **Production-tested** on GitHub, Wikipedia, and commercial sites
- **Enterprise-ready** with full CI/CD integration

### 🧹 Repository Cleanup

- **Removed 211 MB** of test artifacts and build cache
- Optimized distribution for npm publishing
- Cleaned build outputs and temporary files
- Organized project structure for maintainability

### ✨ Features Ready for Production

- **Market Reality Testing Engine** - Browser-based reality verification
- **Three-tier Verdict System** - READY | FRICTION | DO_NOT_LAUNCH
- **Human-Centered Evaluation** - Tests actual user success, not code quality
- **Multiple Integrations** - CLI, GitHub Actions, GitLab CI, Bitbucket Pipelines, VS Code
- **Comprehensive Artifacts** - decision.json, summary.md, visual reports
- **Baseline Management** - Regression detection and tracking

---

## How to Use v1.0.0

### Install

```bash
npm install -g @odavl/guardian
# or
npm install @odavl/guardian
```

### Quick Start

```bash
guardian reality --url https://your-site.com
```

### In CI/CD

**GitHub Actions:**
```yaml
- uses: odavlstudio/guardian@v1.0.0
  with:
    url: https://your-site.com
    preset: startup
```

**GitLab CI:**
```yaml
npx @odavl/guardian reality --url $GUARDIAN_URL
```

---

## Breaking Changes

None. This is a stable release from beta with full backward compatibility.

---

## Known Limitations

- Requires Node.js 18+
- Playwright installation (~800MB) required
- Browser-based testing is inherently slower than unit tests
- Some dynamic/JavaScript-heavy sites may require preset tuning

---

## What's Next (Roadmap)

- **v1.1.0** - Advanced visual regression detection
- **v1.2.0** - AI-powered test generation
- **v2.0.0** - Multi-browser support (Firefox, Safari)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `guardian reality --url <url>` | Full reality check |
| `guardian smoke --url <url>` | Quick sanity check |
| `guardian baseline save <url>` | Create baseline |
| `guardian baseline check <url>` | Check regression |
| `guardian list` | Show all reports |
| `guardian cleanup` | Remove old reports |

---

## Support & Issues

- GitHub: https://github.com/odavlstudio/odavlguardian
- Docs: See README.md
- Issues: GitHub Issues
- Contact: See SUPPORT.md

---

## Credits

ODAVL Guardian is built with:
- Playwright for browser automation
- Node.js for runtime
- Express for server components

---

**Thank you for using ODAVL Guardian v1.0.0!**
