# ONE_LINER: Guardian Product Definition

Guardian decides whether a website is safe to launch by observing real users, then monitors what breaks after.

---

## Evidence

**Word count:** 18 words ✓

**Source material:**

From [README.md](../../README.md):
> "The final decision authority before launch. The watchdog after."
> "It observes your website as real users experience it. Not based on tests. Not based on assumptions. Based on real user reality."

From [PRODUCT_IDENTITY.md](../../PRODUCT_IDENTITY.md):
> "Guardian is the final decision authority before launch. It determines whether a website or digital product is safe to go live based on real user reality — not code assumptions."

From [docs/PRODUCT.md](../PRODUCT.md):
> "Guardian is a launch decision engine that tests websites with real browsers and returns a reality-based verdict (READY | FRICTION | DO_NOT_LAUNCH) to gate deployments."

---

## Validation

- **Answers "What is it?"** — Decision authority using browser automation to observe real user flows
- **Answers "For whom?"** — Teams shipping websites/products to production
- **Answers "Why exists?"** — Prevent launches that would break user reality
- **Non-technical?** — Yes (no mention of Playwright, code, or test frameworks)
- **No buzzwords?** — Yes (concrete: watches real users, decides safe/unsafe, then monitors)
- **Testable?** — Yes (observable behaviors: blocks launches, sends alerts, generates reports)

---

**Clarity score:** 10/10  
**Ambiguities remaining:** None
