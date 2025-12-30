# Observation Mode — Guardian's Quiet Public Validation

## What This Means

Guardian is now available to the public, but **in a quiet, honest way**.

We're not launching with fanfare. We're not making promises we can't keep. We're not building a SaaS or enterprise tier or future roadmap.

**We're just letting people try it and see if it works.**

---

## Guardian's Current State

### What Guardian Does

✅ Tests your website with real browsers  
✅ Tells you if critical flows work  
✅ Returns clear verdicts (READY | FRICTION | DO_NOT_LAUNCH)  
✅ Produces evidence (decision.json, summary.md)  

### What Guardian Doesn't Promise

❌ No SLA (uptime, response time)  
❌ No guarantees (we're still learning)  
❌ No enterprise support  
❌ No future roadmap promises  
❌ No "production-grade" claims  

**What we do promise:**  
Honesty. Evidence. Transparency.

---

## Why Observation Mode?

**We want to know:**
1. Can people understand Guardian from the docs?
2. Do verdicts make sense to real users?
3. Does Guardian catch real issues?
4. Should we change anything?

**We don't want:**
- Growth metrics
- Customer acquisition
- Market positioning
- Enterprise lock-in

**We just want reality feedback.**

---

## Before You Use Guardian

### Best Practices

#### 1. Test on Staging First

Don't test on your live production site yet. Use:
- Staging environment
- Development server
- Test account
- Non-critical page

**Why:** Guardian is learning, and you're learning too. Start small.

#### 2. Understand the Verdict First

Before trusting Guardian's verdict:
1. Read the full report (`.odavlguardian/<timestamp>/summary.md`)
2. Review the evidence (screenshots, logs)
3. Try the flow yourself
4. Compare Guardian's result to your experience

**Why:** You know your site better than Guardian does. Verify accuracy.

#### 3. Don't Rely on Guardian Alone

Use Guardian as ONE input to your decision, not THE decision:
- Unit tests still matter
- Manual testing still matters
- Code review still matters
- Guardian is another safety check

**Why:** Guardian tests user flows. It doesn't test code, performance, or security.

---

## If Something Seems Wrong

### Scenario 1: Guardian Says READY, But You See Issues

**Possible reasons:**
1. The flow Guardian tested wasn't the one you care about
2. Guardian missed an edge case
3. The issue requires specific timing/conditions Guardian didn't test

**What to do:**
1. Review Guardian's report — what exactly did it test?
2. Try the failing flow yourself — does it fail reproducibly?
3. [Share feedback](#Share-Feedback) with details

### Scenario 2: Guardian Says FRICTION, But Everything Looks Fine

**Possible reasons:**
1. Guardian detected friction you haven't noticed (browser warnings, timing issues)
2. The friction doesn't affect your users (e.g., deprecated API)
3. Guardian is being overly cautious

**What to do:**
1. Read the report — what's the specific issue?
2. Decide if it's something you care about
3. [Share feedback](#Share-Feedback) with your context

### Scenario 3: Guardian Says DO_NOT_LAUNCH, And You Disagree

**This is rare, but possible.**

**Possible reasons:**
1. Guardian found a real issue you overlooked
2. Guardian's test doesn't match your actual user flow
3. There's a bug in Guardian

**What to do:**
1. **Don't deploy.** Take DO_NOT_LAUNCH seriously.
2. Read the report carefully — what failed?
3. Try the flow manually — see if you can reproduce it
4. If you disagree with the verdict, [share detailed feedback](#Share-Feedback)

**Important:** Guardian errs on the side of caution. If we're wrong, we want to know.

---

## Share Feedback

### How to Report Issues or Observations

Use the [Guardian Feedback form](https://github.com/odavlstudio/odavlguardian/issues/new?template=guardian-feedback.yml):

**Include:**
1. **URL tested** — What site did you test?
2. **Verdict Guardian gave** — READY | FRICTION | DO_NOT_LAUNCH
3. **Was the verdict fair?** — Did it match reality?
4. **What Guardian found** — What does the report say?
5. **What you observed** — What did you see when you tried the flow?

**Example:**
```
URL: https://example.com
Verdict: FRICTION
Fair?: Not quite — the issue Guardian found is real, but minor
What Guardian found: Contact form submit button slow to respond
What I observed: Yes, button takes 2-3 seconds, but still works
Feedback: Maybe this should be a warning, not FRICTION?
```

---

## What Happens With Your Feedback

### We Read Every Response

- ✅ You'll get a response (might be slow, but we read it)
- ✅ We'll explain our thinking
- ✅ We'll ask clarifying questions if needed
- ✅ We'll use it to improve Guardian

### We Don't Collect Data

- ❌ We don't track your URLs
- ❌ We don't analyze your feedback for metrics
- ❌ We don't sell or share your feedback
- ❌ We don't use it for growth hacking

**We just want to know if Guardian works.**

---

## Honesty Principles for Observation Mode

### 1. No Overpromising

**Don't say:** "Guardian will prevent all production issues"  
**Do say:** "Guardian catches user flow failures we might miss"

### 2. No Hiding Limitations

**Don't hide:** Guardian is early-stage  
**Do explain:** Here's exactly what Guardian tests and what it doesn't

### 3. No Fake Authority

**Don't claim:** "Based on AI analysis" or "machine learning insights"  
**Do explain:** Real browser, real steps, simple rules

### 4. No Vanishing Act

**Don't:** Build up hype then disappear  
**Do:** Stay reachable, keep improving, respond to feedback

### 5. No Fast Promises

**Don't:** Promise features we're not building  
**Do:** Share what we're learning, not what we're selling

---

## What Success Looks Like (For Us)

✅ **Users understand Guardian** without reading documentation  
✅ **Verdicts make sense** when users verify them  
✅ **Guardian catches real issues** developers would have missed  
✅ **Users feel confident** relying on Guardian for pre-deploy checks  
✅ **Feedback helps us improve** — not marketing metrics  

**NOT success:**
- ❌ Viral adoption
- ❌ Enterprise customers
- ❌ 10x growth
- ❌ Venture funding

---

## Three Versions of Guardian's Maturity

### Version 1: Learning (← You are here)

**Status:** Public, but quiet  
**Mindset:** "Does this make sense to real users?"  
**Feedback:** Critical. We need to hear what's wrong.  
**Usage:** Best on staging and non-critical sites  

### Version 2: Proven (Future)

**Status:** Confident in verdicts  
**Mindset:** "Users rely on this for pre-deploy checks"  
**Feedback:** Valuable for improvement  
**Usage:** Safe on staging, selective on production  

### Version 3: Standard (Way future)

**Status:** Industry standard  
**Mindset:** "Guardian is boring and reliable"  
**Feedback:** Edge case improvements  
**Usage:** Routine pre-deploy check  

**We don't have timelines for these. They depend on real feedback.**

---

## FAQ — Observation Mode

### Q: Is Guardian safe to use on production?

**A:** Guardian only **reads** your site — it doesn't modify data. So technically yes.

But **strategically no:** Test on staging first. Make sure verdicts make sense to you. Then decide about production.

---

### Q: What if Guardian breaks my deployment process?

**A:** Use the `--quiet` flag to suppress output, or don't add it to CI/CD yet. Use it manually on staging until you trust it.

---

### Q: Will Guardian change in breaking ways?

**A:** Probably. We're learning. If we find major issues with the verdict logic, we'll fix them. That might change what READY/FRICTION/DO_NOT_LAUNCH mean.

**See:** [CHANGELOG.md](../CHANGELOG.md) before updating.

---

### Q: Will Guardian be free forever?

**A:** We have no plans for paid versions. Guardian is:
- Free
- Open source (MIT)
- Run anywhere (your machine, your CI/CD)

**Our philosophy:** Users deserve to own their deployment safety.

---

### Q: Can I use Guardian at work?

**A:** Yes. MIT license. MIT means you can use it, modify it, and distribute it freely. Check with your legal team if you need to.

---

### Q: What if I find a bug?

**A:** [Report it.](https://github.com/odavlstudio/odavlguardian/issues/new?template=guardian-feedback.yml) Include:
1. URL tested
2. Exact command you ran
3. What happened
4. What you expected

---

## The Observation Mode Contract

**We promise:**
- Honesty about what Guardian does and doesn't do
- Responsiveness to feedback
- No selling, no hype, no lock-in
- Continuous improvement based on real usage

**We ask:**
- Try Guardian on non-critical sites first
- Give us feedback when something seems off
- Don't blame Guardian for issues it didn't cause
- Help us understand your workflows

---

## Ready to Try?

```bash
# Don't install. Just run.
npx @odavl/guardian reality --url https://your-site.com

# Read the verdict
# Review the evidence
# Tell us what you think
```

**That's it. No signup. No terms to accept. No data collection.**

Just honesty.

---

## Questions?

- **How do I use Guardian?** → [README.md](../README.md)
- **What do the verdicts mean?** → [DECISION_CONFIDENCE.md](DECISION_CONFIDENCE.md)
- **See a real user story** → [REAL_USER_STORY.md](REAL_USER_STORY.md)
- **Want to give feedback?** → [GitHub feedback form](https://github.com/odavlstudio/odavlguardian/issues/new?template=guardian-feedback.yml)

---

**Guardian is in your hands now.**

Use it. Test it. Challenge it. Tell us what you find.

That's how we all learn if it actually works.
