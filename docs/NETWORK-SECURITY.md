# Network & Security Signals

Guardian observes network activity during user flows and detects potential security or reliability issues.

---

## What Guardian Detects

### HTTP Warnings

**What it is:** Unencrypted HTTP requests detected during user flows.

**When it matters:** In production, unencrypted requests on sensitive flows (login, checkout, payment) are security risks.

**What Guardian reports:**
```json
{
  "networkSafety": {
    "httpWarnings": [
      "example.com/login",
      "payment.example.com/checkout"
    ]
  }
}
```

**Your action:** 
- On production: Encrypt these endpoints (HTTPS required)
- On staging: May be acceptable for development
- On HTTPS pages: Ensure all subresources are also HTTPS

---

### Third-Party Domain Analysis

**What it is:** Count and tracking of external domains loaded during user flows.

**When it matters:** Too many third-party domains create:
- **Performance drag** — More requests = slower loads
- **Privacy risk** — More trackers seeing user data
- **Availability risk** — Depends on external services

**What Guardian reports:**
```json
{
  "networkSafety": {
    "thirdPartyCount": 23,
    "excessiveThirdParty": true,
    "thirdPartyDomains": [
      "analytics.google.com",
      "cdn.cloudflare.com",
      "fonts.googleapis.com",
      "...more"
    ]
  }
}
```

**What "excessive" means:**
- Domain count exceeds typical e-commerce/SaaS norms
- Suggests too many trackers, ads, or dependencies

**Your action:**
- Review loaded domains: do you need all of them?
- Consolidate services where possible
- Block unnecessary trackers
- Self-host critical assets

---

## How These Signals Affect Verdicts

Network signals inform the verdict but don't usually override it:

**READY with warnings:**
```
Verdict: READY
Note: All user flows succeeded.
      However: 5 HTTP requests detected on checkout page.
      Recommendation: Encrypt checkout endpoints before production.
```

**DO_NOT_LAUNCH if blocking:**
```
Verdict: DO_NOT_LAUNCH
Reason: Checkout flow blocked by network error.
        (Also: HTTP payment requests detected)
```

---

## Implementation Notes

Guardian's network observation:
- Captures all HTTP/HTTPS requests during user flows
- Does NOT block requests (observational only)
- Does NOT modify page behavior
- Purely informational signal for launch decisions

---

## Best Practices

**Before production:**
1. Review network signals in Guardian report
2. Verify all critical flows use HTTPS
3. Audit third-party domains
4. Remove unnecessary external dependencies

**Post-deployment:**
1. Watchdog mode includes network signals
2. Alert if new third-party domains appear
3. Alert if HTTP requests reappear on production

**Performance:**
1. Network signals are free (collected during normal test)
2. No performance impact to your site
3. No cookies or session tracking

