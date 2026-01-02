# Phase 3: Make It Visible — Soft Launch Checklist

**Objective:** Prepare odavlguardian for a credible, quiet public soft launch focused on learning.

**Soft Launch Principles:**
- Share, don't promote
- Learn from real usage, don't launch with promises
- Feedback-driven development, not roadmap-driven
- GitHub only (no external tracking or telemetry)

---

## Pre-Launch Validation ✅

Before sharing publicly, verify:

### Code Quality
- [x] All tests pass (verdict-clarity: 22/22 ✅)
- [x] No console errors or warnings on example workflow
- [x] Exit codes (0/1/2) work as documented
- [x] decision.json output is valid and parseable

### Documentation Completeness
- [x] README answers: What? For whom? Try in 10 minutes?
- [x] Quickstart is copy/paste runnable
- [x] Example workflow is fully commented
- [x] Artifact orientation guide covers both JSON and HTML
- [x] All internal links work (no broken references)

### Trust Signals
- [x] LICENSE visible (MIT)
- [x] CHANGELOG exists with v1.0.0 entry
- [x] Status section in README (Stable, v1.0.0)
- [x] Version in package.json matches README
- [x] No external dependencies (no telemetry, tracking, analytics)

### Feedback Mechanism
- [x] GitHub issue templates created (clarity.yml, adoption.yml)
- [x] "How to Give Feedback" section in README
- [x] Both templates clearly labeled for learning, not criticism

---

## Launch Day

### Where to Post

**Primary channel: GitHub only**

1. **GitHub Release** — Draft a v1.0.0 release with:
   ```markdown
   # Guardian v1.0.0 — Soft Launch
   
   **Status:** Stable decision engine, early feedback stage
   
   Guardian observes your website as real users experience it 
   and issues a binding verdict on whether it's safe to launch.
   
   **Try it:** [Quickstart: Guardian in GitHub Actions](https://github.com/odavlstudio/odavlguardian/blob/main/docs/quickstart/CI_GITHUB_ACTION.md)
   
   This is a quiet soft launch. We're learning from real usage.
   Please share feedback via GitHub Issues.
   ```

2. **Post on:**
   - HackerNews (Show HN format, focus on decision authority model)
   - IndieHackers (product launch context)
   - Dev.to (CI/CD focus, DevOps audience)

### What to Say (Template)

**One paragraph, focus on decision authority:**

> Guardian is a decision authority for CI/CD pipelines. It observes your website as real users experience it (using Playwright browser automation) and issues a binding verdict on whether it's safe to launch: READY, FRICTION, or DO_NOT_LAUNCH. The verdict can't be overridden. If you gate deployments in GitHub Actions (or any CI/CD system), you can try Guardian in about 10 minutes. This is a soft launch—we're learning how release engineers use it. Feedback welcome at [GitHub Issues](https://github.com/odavlstudio/odavlguardian).

**Why this framing:**
- Leads with decision authority (not automation, not testing)
- Explains the mechanism briefly (real user observation)
- Specifies primary user (CI/CD pipelines)
- Gives concrete time estimate (10 minutes)
- Signals learning mode, not promises
- Points to GitHub for feedback only

### What NOT to Say

❌ "Guardian replaces QA"  
❌ "Guardian prevents all bugs"  
❌ "Guardian makes deployments faster"  
❌ "Enterprise support available"  
❌ "Try our pricing page"  
❌ "Join our Slack community"  
❌ "Roadmap: [future features]"  
❌ "Used by [company names]"  

**Why:** These make promises beyond what Guardian is. Soft launch is about learning, not converting.

---

## First 7 Days: Watch These Signals

### Healthy Signals ✅

- **Issue templates being used** — Clarity and adoption issues mean people are trying
- **Questions about exit codes** — Sign they're integrating with pipelines
- **Screenshots of workflow runs** — Evidence it's working in real pipelines
- **Preset questions** — Sign they're matching Guardian to their site type
- **False positive reports** — Verdict was wrong; needs investigation
- **GitHub reactions on release** — Interest without commitment

### Concerning Signals ⚠️

- **No issues for 3 days** — Maybe not being tried
- **All issues are "missing feature X"** — Wrong audience, or scoping problem
- **Issues say "doesn't work"** — Product blockers, not clarity
- **High Issue volume + one theme** — Systematic problem (e.g., "URL never works")
- **No stars, high visitors** — People looking but not committing

### Action If Concerning Signals Appear

1. **Immediately review GitHub issues** — Categorize by root cause
2. **Post a comment in Release** — Acknowledge issues, ask for details
3. **Prioritize clarity updates** — Fix docs if that's the blocker
4. **Do NOT change product behavior** — Wait for pattern confirmation
5. **Report back publicly** — "We heard X, we're investigating"

---

## First 30 Days: Learning

### Key Metrics to Track

| Metric | Why It Matters | Healthy Target |
|--------|---|---|
| Issues filed | Engagement | >0 per day |
| Stars | Credibility | >10 per day |
| Preset questions | Adoption friction | Identify common choices |
| False positives | Verdict accuracy | <5% of reports |
| Exit code questions | Integration confusion | <10% of adoption issues |
| Setup blockers | Friction in quickstart | <20% of issues |

### What to Do

- **Week 1:** Answer every issue same day. Respond with questions (learning).
- **Week 2:** Identify 2-3 most common issue themes. Plan clarity updates.
- **Week 3:** Deploy 1-2 clarity improvements based on feedback.
- **Week 4:** Summarize first month learnings. Post public update.

### Example First Month Update

```markdown
# Month 1 Learnings

**Stats:**
- 47 issues filed (26 clarity, 21 adoption)
- 152 stars
- 89 GitHub workflows created using Guardian

**Top learning:**
- Preset selection needed more guidance (fixed in v1.0.1)
- Playwright installation sometimes fails (documented workaround)
- "What is FRICTION?" was asked 8 times (added FAQ)

**What's next:**
- Continue learning (no promises on feature roadmap)
- Respond to all feedback
- Improve clarity based on real usage

**How to help:**
- Try Guardian in your pipeline
- Report what confused you or blocked you
- Tell us if the verdict was right or wrong
```

---

## Do NOT Do

- ❌ Track users or usage
- ❌ Add Google Analytics or mixpanel
- ❌ Claim users or companies ("Used by 500+ companies")
- ❌ Promise features ("Roadmap: AI-powered verdict")
- ❌ Change product behavior to chase stars
- ❌ Respond to criticism with defensiveness
- ❌ Sell anything

---

## Success Looks Like

After 30 days, success is:

1. **Real users trying it** — >50 GitHub stars, >20 issues filed
2. **Feedback patterns clear** — Can identify 3-5 key learning themes
3. **Product is working** — Exit codes, verdicts, artifacts all functioning
4. **Community tone healthy** — Issues are respectful, questions are genuine
5. **CI/CD operators understand it** — Issues ask clarifying questions, not "why exists?"

If we get 1-2 of these in first month, soft launch succeeded.

---

## Post-Launch (Day 2 onwards)

### Daily
- Check GitHub issues first thing
- Reply to all questions within 24 hours
- Answer honestly (don't oversell)

### Weekly
- Review issues for patterns
- Categorize: clarity, adoption, verdict-accuracy, feature-request
- Plan 1-2 clarity improvements for next release

### Monthly
- Publish learnings (what we heard, what we're doing)
- Decide on next phase (stay soft? move to beta? features?)
- Respond to criticism publicly and thoughtfully

---

## This Soft Launch Succeeds If...

- ✅ We learn how release engineers actually use Guardian
- ✅ We hear what's confusing or doesn't work
- ✅ Real verdicts are tested against real sites
- ✅ Exit code behavior is validated in real pipelines
- ✅ We find 3-5 use cases that work extremely well
- ✅ We identify 2-3 systematic problems to fix

**We do NOT succeed if we:**
- ❌ Chase vanity metrics (stars, featured sites)
- ❌ Overpromise capabilities beyond decision authority
- ❌ Stop responding to feedback
- ❌ Add features without learning first

---

## Checklist for Launch

- [ ] README polished (What? For whom? Try in 10 minutes?)
- [ ] Quickstart verified runnable (copy/paste works)
- [ ] Example workflow tested in fresh repo
- [ ] Issue templates created and tested (post a test issue)
- [ ] All links in README work
- [ ] LICENSE visible
- [ ] CHANGELOG has v1.0.0 entry
- [ ] No external tracking/telemetry code present
- [ ] README has "How to Give Feedback" section
- [ ] GitHub release draft prepared with one-paragraph launch message
- [ ] All team members have reviewed messaging
- [ ] All team members know: soft launch = learning mode

---

## Launch Command

When everything is checked, run:

```bash
git tag -a v1.0.0 -m "Guardian v1.0.0 - Soft Launch"
git push origin v1.0.0
# Create GitHub Release from tag
# Post one paragraph to HackerNews, IndieHackers, Dev.to
# Share links in relevant Slack communities
# Monitor GitHub issues
```

---

## Remember

This is a **soft launch to learn**, not a hard launch to acquire users. Success is understanding how Guardian actually gets used, what breaks, and what delights. Everything else is secondary.
