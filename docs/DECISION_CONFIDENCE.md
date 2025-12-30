# Decision Confidence — Understanding Guardian's Verdicts

## What Guardian Tells You

When Guardian tests your website, it answers one question:

**"Can users complete their goals on this site right now?"**

The answer comes in three forms:

| Verdict | Meaning | Your Action |
|---------|---------|-------------|
| **READY** | Users can complete critical tasks | Deploy with confidence |
| **FRICTION** | Some users may struggle | Review and decide |
| **DO_NOT_LAUNCH** | Users cannot complete critical tasks | Fix before deploying |

---

## READY — What It Means in Real Life

### Short Version
Your website works. Users can do what they came to do.

### What Guardian Tested
- ✅ Critical pages load
- ✅ Navigation works
- ✅ Forms submit
- ✅ Primary actions complete
- ✅ No breaking errors

### What This Tells You
Go ahead and deploy. Guardian tested your site like a real user would, and everything essential works.

### Real-World Example

**Scenario:** E-commerce site before Black Friday launch

**What Guardian Found:**
```
✓ Homepage loads and displays products
✓ Product pages accessible
✓ "Add to Cart" button works
✓ Checkout flow completes
✓ Payment form submits successfully
```

**Verdict:**
```
Verdict: READY
Reason: All core user flows completed successfully. Safe to launch.
Next: Deploy
```

**What the Team Did:**  
Deployed to production at 11 PM. Slept well. Sales started at midnight with zero issues.

**Why READY Was Right:**  
Every critical path worked. Users could browse, add items, and check out. That's the entire business model—and it worked.

---

## FRICTION — When It's Acceptable

### Short Version
Your website mostly works, but some users might have problems.

### What Guardian Found
- ✅ Critical paths work
- ⚠️ Some features have issues
- ⚠️ Edge cases may fail
- ⚠️ Secondary features broken

### What This Tells You
You can launch, but know what's broken. Decide if it's acceptable.

### Real-World Example

**Scenario:** SaaS company launching new dashboard

**What Guardian Found:**
```
✓ Login works
✓ Main dashboard loads
✓ Data displays correctly
✗ "Export to CSV" button throws error
✓ User settings save properly
```

**Verdict:**
```
Verdict: FRICTION
Reason: Some user flows encountered issues. Launch with caution.
Next: Review
```

**What the Team Discussed:**

**Engineer:** "Export is broken."

**Product Manager:** "How many users export data?"

**Engineer:** "Analytics says 5% use it monthly."

**PM:** "Can we fix it tomorrow?"

**Engineer:** "Yes, 2-hour fix."

**PM Decision:** "Launch now. Most users won't hit this. We'll fix export tomorrow and notify the 5% who use it."

**What Happened:**  
- Deployed successfully
- 95% of users had zero issues
- Fixed export the next day
- Sent email to power users: "Export feature back online"

**Why FRICTION Was Acceptable:**  
The core product worked. The broken feature was secondary and affected a small group. The team made an informed risk decision.

---

### When FRICTION Is NOT Acceptable

**Different Scenario:** Banking app before launch

**What Guardian Found:**
```
✓ Login works
✗ "Transfer Money" flow fails at confirmation step
✓ Account balance displays
```

**Verdict:**
```
Verdict: FRICTION
Reason: Some user flows encountered issues. Launch with caution.
Next: Review
```

**What the Team Decided:**

**Engineer:** "Money transfers fail."

**Product Manager:** "That's literally the entire product."

**Decision:** "DO NOT LAUNCH. Fix first."

**Why FRICTION Was Unacceptable:**  
Even though Guardian said FRICTION (not DO_NOT_LAUNCH), the team knew their users. A broken transfer feature *is* launch-blocking for a banking app, even if Guardian only saw it as "some friction."

**Key Lesson:**  
You know your business. Guardian tells you what's broken. You decide if it's acceptable.

---

## DO_NOT_LAUNCH — Why It Must Be Respected

### Short Version
Your website is broken in ways that block users from completing critical tasks.

### What Guardian Found
- ❌ Site unreachable
- ❌ Critical pages fail to load
- ❌ Core user flows completely broken
- ❌ Users cannot complete primary goals

### What This Tells You
Do not deploy. Something fundamental is broken. Fix it first.

### Real-World Example

**Scenario:** Marketing agency deploying client website

**What Guardian Found:**
```
✗ Homepage returns 500 error
✗ Navigation menu not rendering
✗ Contact form page unreachable
```

**Verdict:**
```
Verdict: DO_NOT_LAUNCH
Reason: Critical issues found. Do not launch until resolved.
Next: Fix before launch
```

**What the Team Did:**

**Engineer:** "Wait, what? It worked on my machine."

**Investigation:**  
- Environment variable missing in production config
- Database connection string wrong
- Site literally doesn't load for users

**Action:**  
1. Fix config (10 minutes)
2. Re-run Guardian
3. Get READY verdict
4. Deploy successfully

**What Would Have Happened Without Guardian:**  
- Deployed broken site to client
- Client sees 500 error on launch day
- Emergency all-hands meeting
- Reputation damage
- Lost client trust

**Why DO_NOT_LAUNCH Saved Them:**  
Guardian caught a deployment-blocking issue *before* the client saw it. 10-minute fix prevented a business disaster.

---

### The Test: What Happens When You Ignore DO_NOT_LAUNCH

**Real Story (anonymized):**

A team ignored a DO_NOT_LAUNCH verdict:

> "It's just the staging URL. Production will be fine."

**What happened in production:**
- Same issue appeared
- Site went down for 6 hours
- Support flooded with tickets
- Revenue lost: $15,000
- Developer weekend ruined

**Lesson learned:**  
If Guardian says DO_NOT_LAUNCH on staging, *believe it*. The same issue will hit production.

---

## The Trust Model — Why Guardian's Decisions Are Reliable

### 1. Guardian Uses Real Browsers
Not synthetic checks. Not curl requests. Real Chromium browsers that render HTML, run JavaScript, and interact with your site exactly like users do.

### 2. Guardian Tests Real User Flows
It doesn't just ping endpoints. It follows actual user journeys:
- "Can a user sign up?"
- "Can a user submit a contact form?"
- "Can a user navigate to the pricing page?"

### 3. Guardian Bases Verdicts on Evidence
Every verdict is backed by:
- Screenshots of what the browser saw
- Step-by-step logs of what happened
- Error messages if anything failed

You can always verify Guardian's work.

### 4. Guardian Doesn't Guess
If Guardian says:
- **READY** = It successfully completed the flow
- **FRICTION** = It completed some flows but hit issues
- **DO_NOT_LAUNCH** = It couldn't complete critical flows

No predictions. No estimations. Just facts about what happened when Guardian tried to use your site.

---

## How to Build Confidence in Guardian

### First Time Using Guardian

**Your Thought:** "Can I trust this?"

**Recommended Approach:**

1. **Run Guardian on your live production site**
   ```bash
   guardian reality --url https://your-live-site.com
   ```

2. **Check the verdict**
   - If it says READY: Good! Your site works.
   - If it says FRICTION: Read the report. Does it match reality?
   - If it says DO_NOT_LAUNCH: Something's wrong. Investigate.

3. **Verify Guardian's findings**
   - Open the screenshots: `.odavlguardian/<timestamp>/`
   - Read the summary: `summary.md`
   - Try the failing flow yourself

4. **Compare to reality**
   - Did Guardian catch real issues?
   - Did it miss anything critical?
   - Did it give false positives?

**Expected Result:**  
You'll see that Guardian's verdicts match what actually happens when users visit your site.

---

### Second Time: Test Before Deploying

**Your Thought:** "Okay, it was right last time. Let's use it for real."

**Recommended Approach:**

1. **Deploy changes to staging**

2. **Run Guardian on staging**
   ```bash
   guardian reality --url https://staging.your-site.com
   ```

3. **Act on the verdict**
   - READY? Deploy to production
   - FRICTION? Check if issues are acceptable
   - DO_NOT_LAUNCH? Fix, then re-test

4. **Deploy to production**

5. **Verify production works**
   - Run Guardian on production URL
   - Should get same verdict (or better)

**Expected Result:**  
Guardian catches issues on staging that would have broken production.

---

### Third Time: Full Trust

**Your Thought:** "Guardian is now my pre-deploy checklist."

**Recommended Approach:**

```yaml
# Add to CI/CD pipeline
- name: Guardian Reality Check
  run: guardian reality --url ${{ env.STAGING_URL }}
  
- name: Block Deployment if Broken
  if: failure()
  run: exit 1
```

**Expected Result:**  
No surprise production issues. Ever. You always know what you're deploying.

---

## Common Questions

### "What if Guardian says READY but my site is broken?"

**Short Answer:**  
Guardian tests what you told it to test. If it missed something, that flow wasn't in the test plan.

**Solution:**  
Add custom flows to test specific features:

```bash
guardian reality --url https://your-site.com --flows flows/checkout.json
```

Guardian will then test your checkout flow specifically.

---

### "What if I disagree with the verdict?"

**Short Answer:**  
You're the human. You make the final call. Guardian provides information; you make decisions.

**Example:**  
- Guardian: "FRICTION - Export button broken"
- You: "Only 5% of users use that. Deploying anyway."
- Result: You launch with known issues. That's fine—you're informed.

---

### "Can I trust Guardian with my production site?"

**Short Answer:**  
Yes. Guardian only reads your site. It doesn't modify data, submit real forms, or make purchases.

**What Guardian Does:**
- Opens pages (GET requests)
- Clicks buttons (UI interactions)
- Fills forms with test data (clearly marked as test)
- Takes screenshots for evidence

**What Guardian Doesn't Do:**
- Submit real transactions
- Modify your database
- Send real emails
- Make real purchases

**Safety Note:**  
If you have destructive actions (delete account, cancel subscription), don't include them in Guardian tests. Test those manually.

---

## The Bottom Line

### READY
"Your site works. Deploy."

### FRICTION  
"Your site mostly works. You decide if issues are acceptable."

### DO_NOT_LAUNCH  
"Your site is broken. Fix before deploying."

---

## Three Rules for Using Verdicts

### Rule 1: Trust READY
If Guardian says READY, your site works. Deploy with confidence.

### Rule 2: Evaluate FRICTION
If Guardian says FRICTION, read the report. Decide if the issues block launch or not.

### Rule 3: Respect DO_NOT_LAUNCH
If Guardian says DO_NOT_LAUNCH, something critical is broken. Fix it. Don't deploy.

---

## Final Thought

Guardian doesn't replace your judgment. It gives you facts so you can make informed decisions.

- **Before Guardian:** Hope your site works, deploy, pray
- **After Guardian:** Know what works, decide, deploy confidently

**The difference:** Information replaces hope.

---

**Ready to try it?**

```bash
npm install -g @odavl/guardian
guardian reality --url https://your-site.com
```

See what Guardian finds. Then decide if you trust it.

Most teams trust Guardian after one test. Because it tells the truth.
