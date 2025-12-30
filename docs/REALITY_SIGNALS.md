# Reality Signals — How Guardian Learns From Users

## What Is a Reality Signal?

A Reality Signal is a piece of evidence that tells us whether Guardian works the way real developers expect.

Not metrics. Not numbers. Not growth.

**Evidence:**
- A user says "Guardian caught an issue I missed"
- A user says "Guardian's verdict confused me"
- A user ignores Guardian's verdict and everything breaks
- A user trusts Guardian enough to add it to CI/CD
- A user disagrees with a verdict and explains why

**Not signals:**
- ❌ How many people downloaded Guardian
- ❌ GitHub stars or trending status
- ❌ Press mentions or influencer reviews
- ❌ Social media shares

Signals are about **product-reality alignment**, not popularity.

---

## Signal Categories

### 1. Trust Signals

**What they mean:**  
Users believe Guardian's verdicts and act on them.

#### Green Trust Signals ✅

**Example 1: Staged Adoption**
```
User feedback: "I tested Guardian on staging first. It caught a real 
issue I missed. Now I run it on every pre-deploy check."
```
**What this tells us:** Guardian's verdicts match reality. User verified, then trusted.

**Example 2: CI/CD Integration**
```
User feedback: "I added 'fail-on: DO_NOT_LAUNCH' to our deploy 
workflow. Haven't had a surprise production issue in 3 weeks."
```
**What this tells us:** Guardian is reliable enough to gate deployments. That's a big deal.

**Example 3: Team Adoption**
```
User feedback: "Other teams saw us using Guardian and asked how. 
Three teams now run it before deploy."
```
**What this tells us:** Users spread what works. Guardian is spreading organically.

#### Caution Trust Signals ⚠️

**Example 1: Blind Trust**
```
User feedback: "Guardian said READY, so we deployed. Site was fine."
```
**What this tells us:** User didn't verify. Might have gotten lucky. Verdicts need to be robust for this.

**Example 2: Wishful Trust**
```
User feedback: "Guardian said READY and we needed it to be READY, 
so we deployed despite having doubts."
```
**What this tells us:** User might have trusted wishfully, not because Guardian is reliable.

---

### 2. Confusion Signals

**What they mean:**  
Users didn't understand something, or Guardian communicated poorly.

#### Confusion Signal Types

**Type A: Verdict Confusion**
```
User feedback: "Guardian said FRICTION. Does that mean the site 
is broken or just slow? The explanation wasn't clear."
```
**What this tells us:** 
- FRICTION verdict needs clearer definition
- Examples in DECISION_CONFIDENCE.md might need more real-world context
- Communication could be more explicit

**Type B: Scope Confusion**
```
User feedback: "Guardian said FRICTION because 'Export to CSV button 
unresponsive.' But that's not even on the critical path."
```
**What this tells us:**
- Guardian tested things the user didn't care about
- Either Guardian's test plan is wrong, or user expectations don't match Guardian's scope
- Documentation about "what Guardian tests" needs clarity

**Type C: Process Confusion**
```
User feedback: "Does Guardian replace unit tests? Do I still need 
to run my test suite?"
```
**What this tells us:**
- README's positioning section might be unclear
- "What Guardian is NOT" section needs reinforcement
- Users are confused about where Guardian fits in their workflow

**Type D: Evidence Confusion**
```
User feedback: "Guardian said a flow failed, but when I tried it 
myself, it worked fine."
```
**What this tells us:**
- Guardian might be too strict
- Or Guardian and user are testing different scenarios
- Or timing/state issues making Guardian's evidence hard to reproduce

---

### 3. Override Signals

**What they mean:**  
Users ignored Guardian's verdict. This is normal and often right. But the pattern matters.

#### Safe Override Signals ✅

**Pattern 1: Informed Disagreement**
```
User feedback: "Guardian said FRICTION (broken CSV export). We read 
the full report. Export is used by 2% of users. Deployed anyway with 
plan to fix tomorrow."
```
**What this tells us:**
- User understood Guardian's verdict
- User made an informed business decision
- User accepted the risk consciously
- This is healthy override behavior

**Pattern 2: Scope Override**
```
User feedback: "Guardian tested the signup flow, but our deployment 
was only CSS changes. Guardian's verdict wasn't relevant."
```
**What this tells us:**
- User recognized Guardian tested something different than what changed
- User made a context-aware decision
- Guardian might need better scope documentation

#### Dangerous Override Signals 🚨

**Pattern 1: Blind Override**
```
User feedback: "Guardian said DO_NOT_LAUNCH but we deployed anyway. 
Site went down. Three hours later we fixed it."
```
**What this tells us:**
- User ignored critical safety signal
- Either: Guardian was wrong, OR user took unjustified risk
- Need feedback on WHY user overrode

**Pattern 2: Repeated Override**
```
User feedback: "Guardian always says FRICTION about performance. 
We ignore it. Hasn't been an issue yet."
```
**What this tells us:**
- Guardian might be detecting real issues users don't care about
- Or Guardian is being too strict about performance
- Pattern of override suggests Guardian's threshold is misaligned with reality

**Pattern 3: Resentful Override**
```
User feedback: "Guardian's verdict feels arbitrary. I don't trust 
it, so I test manually and deploy on my own judgment."
```
**What this tells us:**
- User doesn't trust Guardian's logic
- User has lost confidence in verdicts
- This is a critical trust failure

---

### 4. Alignment Signals

**What they mean:**  
Guardian's verdicts match developers' expectations about reality.

#### Strong Alignment Signals ✅

**Example 1: Verdict Accuracy**
```
User feedback: "Guardian said READY. Everything I tested worked. 
Verdict was 100% accurate."
```
**What this tells us:** Guardian's rules are well-tuned.

**Example 2: Hidden Issue Discovery**
```
User feedback: "Guardian found a timing bug on mobile that I wouldn't 
have caught in manual testing. I would have deployed a broken site."
```
**What this tells us:** Guardian catches issues humans miss. High value.

**Example 3: Confidence Building**
```
User feedback: "Before Guardian, deploying felt risky. Now I know 
what I'm shipping. Confidence is the biggest benefit."
```
**What this tells us:** Guardian's value isn't stopping bad deployments—it's reducing uncertainty.

#### Misalignment Signals ⚠️

**Example 1: False Positives**
```
User feedback: "Guardian said DO_NOT_LAUNCH (contact form broken), 
but the form works fine. I tested it manually and deployed. 
No issues."
```
**What this tells us:**
- Guardian's detection logic has false positives
- Rules need refinement
- Users will lose trust if this happens repeatedly

**Example 2: False Negatives**
```
User feedback: "Guardian said READY. Deployed. Users complained about 
slowness. Guardian didn't catch it."
```
**What this tells us:**
- Guardian missed a real issue
- Rules are missing something important
- Users might expect more than Guardian can provide

**Example 3: Expectation Mismatch**
```
User feedback: "Guardian says FRICTION, but that's not what I'd call 
friction. It's just a warning."
```
**What this tells us:**
- Verdict meanings don't align with developer understanding
- Documentation or verdict thresholds need adjustment

---

## What NOT to Infer From Signals

### Anti-Pattern 1: One Signal = Actionable Insight

**Wrong:** "One user said Guardian found a bug. Therefore, we should change Guardian."  
**Right:** "One user said Guardian found a bug. Let's watch for this pattern with other users."

**Principle:** Single signals are data points. Patterns are insights.

---

### Anti-Pattern 2: Silence = Satisfaction

**Wrong:** "Few users are reporting issues. Guardian must be working."  
**Right:** "Few reports could mean: users are happy, users aren't using Guardian, users don't know how to report, users are hiding frustrations."

**Principle:** Silence is ambiguous. Seek active feedback.

---

### Anti-Pattern 3: Negative Feedback = Product Failure

**Wrong:** "A user disagreed with Guardian's verdict. Guardian is broken."  
**Right:** "A user disagreed with Guardian's verdict because their context was different. Guardian was correct, but needs better scope explanation."

**Principle:** Disagreement doesn't mean Guardian is wrong. It might mean communication is unclear.

---

### Anti-Pattern 4: Feedback = All Equal Weight

**Wrong:** "User A likes Guardian, User B doesn't. Net neutral."  
**Right:** "User A adopted Guardian and integrated it into CI/CD (high-value signal). User B tried once, didn't understand it, moved on (confusion signal)."

**Principle:** Signal weight depends on user investment and context.

---

### Anti-Pattern 5: Metrics = Signals

**Wrong:** "10 users tried Guardian. Growth is 10x month-over-month!"  
**Right:** "10 users tried Guardian. Of those, 2 are using it regularly. 3 are confused. 5 tried once. Need to understand why 7 aren't persisting."

**Principle:** Signals are about behavior and belief, not vanity metrics.

---

## How to Interpret Reality Signals

### Step 1: Categorize

When you see feedback, ask: "Is this a Trust signal? Confusion signal? Override signal? Alignment signal?"

---

### Step 2: Contextualize

Ask the user (if possible):
- What was your site type? (e-commerce, landing page, SaaS, etc.)
- What were you trying to test?
- Had you used Guardian before?
- Did you read the docs?
- Was the verdict clear?

**Context is everything.** The same verdict can be correct or wrong depending on context.

---

### Step 3: Pattern Match

Watch for patterns across multiple users:
- Are all SaaS users having the same confusion?
- Are all users who integrate to CI/CD seeing the same trust benefit?
- Are false positives concentrated in certain site types?

**Patterns reveal systematic issues.** Single outliers are just outliers.

---

### Step 4: Distinguish User Error from Product Error

**Example:**

User says: "Guardian said FRICTION. But the issue Guardian found isn't real."

**Possible explanations:**
1. Guardian's rules are wrong (product error)
2. User didn't understand what Guardian tests (communication error)
3. User's test environment differs from Guardian's (context error)
4. Guardian caught a real issue but user doesn't recognize it (confidence gap)

**How to tell:** Ask follow-up questions. Look at the report. Try to reproduce. Pattern match with other feedback.

---

## Reality Signal Decision Tree

```
User gives feedback
    ↓
Is it about a verdict?
    ├─ YES → Is it positive or negative?
    │   ├─ Positive → Trust or Alignment signal?
    │   └─ Negative → Confusion or Misalignment signal?
    └─ NO → Is it about override behavior?
        ├─ YES → Is it safe or dangerous override pattern?
        └─ NO → Is it about documentation or scope?

Each category → Look for patterns → Patterns → Insights → Decisions
```

---

## Signal Confidence Levels

### Tier 1: Single Report (Low Confidence)
One user reports an issue.
- **Action:** Note it. Watch for similar reports.
- **Don't act on:** Single Tier 1 signals shouldn't drive changes.

### Tier 2: 3+ Similar Reports (Medium Confidence)
Multiple users report the same issue, same pattern.
- **Action:** Investigate. Ask follow-up questions.
- **Consider acting on:** Multiple Tier 2 signals suggest real pattern.

### Tier 3: Systematic Behavior (High Confidence)
Multiple users exhibit the same behavior consistently.
- **Example:** All e-commerce users report false positives on "checkout complete" detection
- **Action:** This is actionable. This should drive changes.
- **Act on:** Clear, reproducible patterns across users = changes

---

## Reality Signals in Context

### Why We Look For Signals (Not Metrics)

**Metrics:** "1,000 people downloaded Guardian"  
**Signals:** "10 people use Guardian regularly in production"

Metrics tell us about *reach*. Signals tell us about *value*.

We care about value. Whether 10 people or 10,000 people use Guardian, what matters is: **Do they understand it? Do they trust it? Does it solve their problem?**

---

### Why Honesty Matters in Signal Interpretation

When a user gives feedback, especially negative feedback:
- ✅ Assume they're telling us the truth as they see it
- ✅ Assume they're not trying to break Guardian
- ✅ Assume there's a reason they're frustrated or confused
- ❌ Don't assume their feedback is invalid because it's negative
- ❌ Don't dismiss criticism as "user error"

**Reality signals only work if we interpret them honestly.**

---

## Reality Signals Template

When documenting feedback, capture:

1. **Signal Type:** Trust / Confusion / Override / Alignment
2. **Sub-Category:** (specific type within category)
3. **User Context:** Site type, experience level, what they were testing
4. **What They Said:** Direct quote when possible
5. **What They Did:** Did they change behavior based on verdict?
6. **Pattern Connection:** Is this similar to other feedback?
7. **Confidence Level:** Tier 1 / Tier 2 / Tier 3
8. **Next Step:** Watch / Investigate / Act

**Example:**
```
Signal Type: Confusion
Sub-Category: Scope Confusion
User Context: SaaS, first-time Guardian user
What They Said: "Guardian said FRICTION about CSV export. But that's 
  a nice-to-have, not critical. Does FRICTION mean I shouldn't deploy?"
What They Did: Deployed anyway. Everything worked. Now questions 
  Guardian's severity levels.
Pattern Connection: Similar to 2 other reports about secondary features
Confidence Level: Tier 2 (pattern emerging)
Next Step: Investigate. Possible issue with verdicts vs importance weighting.
```

---

## Final Principle

**Reality signals are not about proving Guardian right or wrong.**

They're about understanding: *How is Guardian being experienced in the real world?*

Listen. Understand. Don't defend. Evolve.

That's how products learn.
