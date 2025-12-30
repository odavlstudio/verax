# Real User Story — Can I Launch Safely?

## Meet Alex

Alex is a developer at a small startup. They just finished updating the company website—new pricing page, updated contact form, and a few design tweaks. The changes look good on their laptop, but Alex has been burned before. Last time they deployed on Friday, the contact form broke on mobile, and support tickets piled up over the weekend.

**Alex's Question:** "Can I launch safely?"

---

## What Alex Did

### Step 1: Install Guardian

```bash
npm install -g @odavl/guardian
```

**Time:** 30 seconds

### Step 2: Run One Command

```bash
guardian reality --url https://staging.example.com
```

**What Happened:**  
Guardian opened a real browser, tested the site like a user would, and checked if critical features worked—homepage loads, forms submit, navigation works.

**Time:** 2 minutes

### Step 3: Read the Verdict

```
CANONICAL SUMMARY
Verdict: FRICTION
Reason: Some user flows encountered issues. Launch with caution.
Next: Review

```

**What Alex Thought:**  
"Okay, something's not perfect. Let me see what Guardian found."

### Step 4: Check the Details

Guardian saved a full report at:  
`.odavlguardian/2025-12-30T15-22-10Z/summary.md`

**What the Report Said:**
```
Contact Form Test:
✗ FAILED: Submit button not responding on mobile viewport

Primary Navigation:
✓ SUCCESS: All menu links accessible

Pricing Page:
✓ SUCCESS: Page loads, content visible
```

**What Alex Saw:**  
The contact form—the same one that broke last time—has issues again. But at least this time, Alex found out *before* deploying.

---

## What Alex Did Next

### Option 1: Fix and Re-test

```bash
# Fix the mobile contact form issue
# (add touch event handlers)

# Test again
guardian reality --url https://staging.example.com
```

**New Verdict:**
```
Verdict: READY
Reason: All core user flows completed successfully. Safe to launch.
Next: Deploy
```

**What Alex Did:**  
Deployed to production with confidence. No weekend support tickets.

---

### Option 2: Launch Anyway (Accept the Risk)

Alex looked at the failed test and thought:

> "The contact form is broken, but we have a backup phone number on every page. Users can still reach us. I'll fix the form tomorrow, but I need to launch the pricing update today."

**What Alex Did:**  
Deployed anyway, knowing exactly what was broken and having a backup plan.

**Why This Was Okay:**  
- Alex made an informed decision
- The risk was acceptable for the business
- Alex knew what to monitor

**What Guardian Did:**  
Gave Alex the information needed to make a smart choice. No surprises.

---

## The Key Moment

**Before Guardian:**  
Alex deployed hoping everything worked, then waited nervously for support tickets.

**After Guardian:**  
Alex knew *exactly* what worked and what didn't before deploying. No surprises. No weekend panic.

---

## What Alex Learned

### 1. Guardian Tests Like a Real User
It doesn't just check if the server responds. It opens a browser, clicks buttons, fills forms, navigates pages—the way users actually use the site.

### 2. Guardian Gives You a Clear Answer
Not "97% uptime" or "0 errors." Just: Can users do what they need to do?

- **READY** = Yes, users can complete their goals
- **FRICTION** = Some users might struggle
- **DO_NOT_LAUNCH** = Users cannot complete critical tasks

### 3. Guardian Doesn't Make Decisions for You
Alex still chose to launch with the broken contact form because the business context made it acceptable. Guardian just made sure Alex knew what was broken.

---

## Three Months Later

Alex now runs Guardian on every deployment:

```yaml
# .github/workflows/deploy.yml
- name: Reality Check
  run: guardian reality --url ${{ env.STAGING_URL }}

- name: Deploy to Production
  if: success()  # Only deploy if Guardian says READY
  run: npm run deploy
```

**Result:**  
- Zero surprise production issues in 3 months
- Deployments feel safe instead of scary
- Team ships faster because they trust their process

**What Changed:**  
Guardian became the "sanity check" before every deployment. Not a gatekeeper—a safety net.

---

## Why This Works

### Guardian Doesn't Lie
If it says READY, users can complete their goals. If it says DO_NOT_LAUNCH, something critical is broken. No false alarms, no fake confidence.

### Guardian Explains Itself
Every verdict comes with a full report showing:
- What was tested
- What worked
- What didn't work
- Why the verdict was given

Alex can always answer: "Why did Guardian say that?"

### Guardian Respects Your Judgment
It tells you what's broken, but you decide if it's launch-blocking. Sometimes FRICTION is acceptable. Sometimes it's not. Guardian gives you the facts; you make the call.

---

## The Bottom Line

**Alex's original question:** "Can I launch safely?"

**Guardian's answer:**  
"Here's what works, here's what doesn't. You decide."

**Alex's conclusion:**  
"I know what I'm shipping. That's all I needed."

---

## Try It Yourself

```bash
# Install
npm install -g @odavl/guardian

# Test your site
guardian reality --url https://your-site.com

# Read the verdict
# Make your decision
```

**Time investment:** 3 minutes  
**Value:** Never deploy a broken website by accident  

---

**This story is based on real usage patterns, but Alex is a composite persona representing multiple Guardian users.**
