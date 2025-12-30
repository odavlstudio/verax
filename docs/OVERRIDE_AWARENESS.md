# Override Awareness — When Ignoring Guardian Is Right (And When It's Not)

## The Core Question

**Can developers ignore Guardian's verdict?**

Yes. Should they? Sometimes.

**This document explains both.**

---

## Why Guardian Doesn't Enforce Decisions

Guardian tells you what it observed. It doesn't make your deployment decisions.

**Guardian is not:**
- ❌ A gatekeeper you can't get past
- ❌ An authority figure that forces your hand
- ❌ A system that blocks deployments by technical design
- ❌ A requirement that can't be overridden

**Guardian is:**
- ✅ A safety net that catches what you might miss
- ✅ An advisor that gives you information
- ✅ A tool you control
- ✅ A checkpoint you can examine and move past

**Why?** Because developers know their context. Guardian doesn't.

---

## When Ignoring Guardian Is Reasonable

### Scenario 1: Your Change Scope Is Narrower Than Guardian's Test

**Guardian's verdict:** FRICTION  
**Guardian found:** Contact form submissions slow (5+ second delay)  
**Your change:** Updated CSS styling only

**Your override decision:** Deploy anyway

**Why this is reasonable:**
- You changed only CSS
- Guardian tested user flows (which includes form submission)
- Contact form code was untouched
- The delay Guardian found is pre-existing, not caused by your change
- You're not introducing new risk

**Documentation you should add:**
```
Deploy override because:
- Change scope: CSS styling only
- Guardian tested: Full user flows
- Issue Guardian found: Contact form delay (pre-existing)
- Risk assessment: No new risk introduced
- Plan: Monitor form submissions post-deploy
```

---

### Scenario 2: Guardian's Test Scenario Doesn't Match Your Real Usage

**Guardian's verdict:** FRICTION  
**Guardian found:** Checkout flow fails with specific email format  
**Reality:** Your analytics show <1% of users use that email format

**Your override decision:** Deploy with monitoring

**Why this is reasonable:**
- Guardian tested a specific scenario (valid edge case)
- Your data shows it's an edge case affecting <1% of users
- You have a backup checkout flow
- You're monitoring to catch if this edge case causes issues
- You're accepting calculated risk based on data

**Documentation you should add:**
```
Deploy override because:
- Guardian found: Email format edge case
- Impact analysis: <1% of users affected
- Mitigation: Backup checkout available
- Monitoring: Email error logs flagged for alerts
- Timeline: Fix planned for next release (low urgency)
```

---

### Scenario 3: Guardian's Verdict is Below Your Risk Threshold

**Guardian's verdict:** FRICTION  
**Guardian found:** Minor JavaScript warnings in browser console  
**Your assessment:** Warnings don't affect functionality

**Your override decision:** Deploy

**Why this is reasonable:**
- You evaluated the warnings yourself
- You determined they don't impact user experience
- You have automated monitoring for real breaks
- You understand the specific risk
- You're accepting it consciously

**Documentation you should add:**
```
Deploy override because:
- Guardian found: JavaScript warnings
- Assessment: Warnings don't affect user flows
- Monitoring: Browser error tracking in place
- Confidence: High (warnings are known issue)
```

---

### Scenario 4: Guardian Caught Something, But You Know It's Pre-Existing

**Guardian's verdict:** FRICTION  
**Guardian found:** Mobile navigation menu doesn't open  
**Your knowledge:** This issue exists in current production

**Your override decision:** Deploy (not fixing a pre-existing bug)

**Why this is reasonable:**
- Guardian caught a real issue (good)
- But it's not new—it's pre-existing
- Your deploy doesn't make it worse
- You have a separate ticket to fix it
- You're not introducing new regression

**Documentation you should add:**
```
Deploy override because:
- Guardian found: Mobile menu bug
- Status: Pre-existing (exists in current production)
- Not caused by: This deploy
- Ticket: ISSUE-123 (separate fix planned)
- Note: Guardian correctly identified, not a false positive
```

---

## When Ignoring Guardian Is Dangerous

### Scenario 1: Guardian Says DO_NOT_LAUNCH

**Guardian's verdict:** DO_NOT_LAUNCH  
**Guardian found:** Homepage returns 500 error

**Your thought:** "Maybe it's a timing issue. Let me deploy anyway."

**⚠️ DO NOT DO THIS**

**Why it's dangerous:**
- DO_NOT_LAUNCH means "users cannot complete basic task"
- If Guardian found a 500 error, your site is broken
- This isn't about risk tolerance—this is about shipping broken code
- The issue will affect all users, not a small subset
- You will have alerts, support tickets, reputation damage

**What to do instead:**
1. Read Guardian's evidence—what exactly failed?
2. Try the flow yourself manually—can you reproduce?
3. If you can reproduce: Fix it. Don't deploy.
4. If you can't reproduce: Investigate why Guardian saw it. Run Guardian again.
5. Only deploy after verdict changes to READY or FRICTION

---

### Scenario 2: Guardian Says DO_NOT_LAUNCH And You're Rushing

**Guardian's verdict:** DO_NOT_LAUNCH  
**Your pressure:** "We need to ship by end of day"

**Your thought:** "I'll just override and deal with issues on Monday"

**⚠️ DO NOT DO THIS**

**Why it's dangerous:**
- Time pressure is not a valid override reason
- "I'll fix it later" usually means "it will break in production first"
- Monday morning issue = weekend business impact
- Broken deploys destroy team trust

**What to do instead:**
1. Tell the team: "Guardian found a blocker. We're investigating."
2. Spend 30 minutes trying to fix it
3. If not fixed: Don't deploy. Document the issue. Plan for tomorrow.
4. Your reputation is worth more than meeting today's deadline

---

### Scenario 3: You Don't Understand Why Guardian Said DO_NOT_LAUNCH

**Guardian's verdict:** DO_NOT_LAUNCH  
**Guardian's report:** "[Dense technical details you don't understand]"

**Your thought:** "This probably doesn't matter. Deploying anyway."

**⚠️ DO NOT DO THIS**

**Why it's dangerous:**
- You don't know if the issue is real or not
- Guardian gave you a warning you can't understand
- Deploying without understanding is gambling
- If it breaks, you're to blame

**What to do instead:**
1. Ask a teammate: "Can you read Guardian's report and explain what it found?"
2. Open the screenshots in `.odavlguardian/<timestamp>/` and look
3. Manually test the flow Guardian tested
4. Try to reproduce the issue yourself
5. Only override once you understand the issue and decide it's acceptable

---

### Scenario 4: Repeated Overrides Against DO_NOT_LAUNCH

**History:**
- Guardian said DO_NOT_LAUNCH 5 times
- You overrode 5 times
- You're about to override a 6th time

**⚠️ STOP AND THINK**

**Why this is dangerous:**
- Pattern of ignoring safety signals = lost trust in Guardian
- If you override Guardian 5 times and nothing broke, you're surviving on luck
- Eventually, one of those overrides will break production
- Then you'll blame Guardian instead of admitting overrides were risky

**What to do instead:**
1. Stop overriding. Take Guardian's warnings seriously.
2. If you keep disagreeing with Guardian, read [REALITY_SIGNALS.md](REALITY_SIGNALS.md)
3. Give feedback: "Guardian says X, but reality is Y"
4. Let Guardian improve based on your feedback
5. Don't just disable the safety net because it's uncomfortable

---

### Scenario 5: Guardian Says FRICTION And You're Tired Of Investigating

**Guardian's verdict:** FRICTION  
**Guardian found:** Some form fields have validation issues  
**Your reaction:** "I'm done investigating. Just deploying."

**⚠️ RISKY — Depends on Severity**

**Why it might be dangerous:**
- You stopped investigating before understanding the issue
- "Some validation issues" could be minor or critical
- You don't know which users will be affected
- If validation breaks, users lose trust in your forms

**What to do instead:**
1. Read the full report. Understand what Guardian found.
2. Open the screenshots and see exactly what failed
3. Ask: "Will this affect core user flows?" If yes, don't deploy.
4. Ask: "Can I add monitoring to catch this?" If yes, deploy with monitoring.
5. Ask: "Do I have a rollback plan?" If no, don't deploy.
6. Only deploy FRICTION verdicts after you've actually understood them

---

## The Override Decision Framework

### Before you override, answer these questions:

**Question 1: Do I understand what Guardian found?**
- [ ] Yes → Continue
- [ ] No → Investigate until yes

**Question 2: Is this issue pre-existing (not caused by my change)?**
- [ ] Yes → Safe to override (if monitoring is in place)
- [ ] No → Go to Question 3

**Question 3: Will this issue affect users?**
- [ ] No → Safe to override
- [ ] Yes → Go to Question 4

**Question 4: Is this a core flow (signup, checkout, login, primary CTA)?**
- [ ] No → Might be safe to override (depends on risk tolerance)
- [ ] Yes → Do not override

**Question 5: Can I detect and respond to this issue if it breaks production?**
- [ ] Yes → Can deploy with monitoring
- [ ] No → Do not deploy

**Question 6: Am I overriding because I understand the risk, or because I'm tired of investigating?**
- [ ] Understand the risk → Safe to override
- [ ] Tired of investigating → Do not override yet

**Question 7: Can I explain my override decision to the team in writing?**
- [ ] Yes → Safe to override
- [ ] No → Do not override

---

## How Teams Should Document Overrides

### Minimal Documentation (For Safe Overrides)

```
Override Guardian verdict:
- Verdict: [FRICTION/DO_NOT_LAUNCH]
- Issue Guardian found: [Specific issue]
- Why we're overriding: [Clear reason]
- Monitoring: [How we'll catch if we're wrong]
```

**Example:**
```
Override Guardian verdict:
- Verdict: FRICTION
- Issue: "Send email" button slow (5+ second latency)
- Why: Email service is external. Latency is on their side, not ours.
- Monitoring: Email service health dashboard. Response time tracked.
```

---

### Full Documentation (For Riskier Overrides)

```
Override Guardian verdict:

Verdict: [FRICTION/DO_NOT_LAUNCH]

What Guardian found:
[Guardian's specific findings]

Context:
- What changed in this deploy: [...]
- Why Guardian's test might not apply: [...]
- Impact if Guardian is right: [...]

Risk assessment:
- Probability this breaks: [Low/Medium/High]
- Blast radius if it breaks: [All users/Some users/Edge cases]
- Business impact if it breaks: [Revenue loss/Customer support surge/Minor UX issue]

Mitigation:
- Monitoring: [What we're watching]
- Rollback plan: [How we'll recover if wrong]
- Timeline: [How long we're accepting this risk]

Decision: [Why we're deploying despite Guardian's warning]

Owner: [Who made this decision and is accountable]
```

---

## The Override Contract

### What You Promise When You Override Guardian

✅ **You've understood** what Guardian found  
✅ **You've evaluated** the risk  
✅ **You've decided** it's acceptable in context  
✅ **You can explain** your reasoning to the team  
✅ **You'll monitor** to catch if you're wrong  
✅ **You'll take responsibility** if it breaks  

### What Guardian Promises About Overrides

✅ **Guardian won't block** your override (no technical gating)  
✅ **Guardian won't judge** your override (no "are you sure?" popups)  
✅ **Guardian won't penalize** your override (no tracking against you)  
✅ **Guardian will be honest** in its verdict (so you can ignore it confidently if you choose)  

---

## When to Give Guardian Feedback About Your Override

### Do Give Feedback

**You override because Guardian found something that isn't real:**

```
GitHub Issue: "Guardian found 'form submit failed' but the form 
works fine. Issue seems to be a timing problem in Guardian's test, 
not real. I deployed and everything was fine."
```

**Why:** This helps Guardian improve. Guardian's rules might be too strict.

---

### Don't Give Feedback

**You override because you're tired of investigating:**

```
(Don't report this. It's not Guardian's problem. It's you being tired.)
```

---

### Do Give Feedback

**You override multiple times against the same verdict type:**

```
GitHub Issue: "Guardian keeps saying FRICTION on our checkout flow. 
Each time I investigate and deploy anyway. Each time it's fine. 
Might Guardian's checkout detection be too strict?"
```

**Why:** Patterns of disagreement are signals. They help Guardian improve.

---

## Final Principle

**Overriding Guardian is not failure. It's context-aware decision making.**

But overriding without understanding, repeatedly, or under pressure—that's when you lose the safety net.

**Use overrides wisely.**

They exist because developers need judgment. Use your judgment, but use it honestly.
