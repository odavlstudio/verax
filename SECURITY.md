# Security Policy

## Supported Versions

Only **v2.0.0 and later** receive security updates. Earlier versions (v1.x, v0.x) are **unsupported**.

| Version | Supported | Notes |
|---------|-----------|-------|
| 2.x     | ✅ Yes   | Current stable release |
| 1.x     | ❌ No    | Pre-canonical, unsupported |
| 0.x     | ❌ No    | Experimental, unsupported |

## Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

### Preferred: GitHub Security Advisory

1. Go to [Guardian Security Advisories](https://github.com/odavlstudio/odavlguardian/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the form with:
   - Title: Brief description of the vulnerability
   - Description: Technical details, affected versions, impact
   - CVSS score (if applicable)

### Alternative: Direct Email

If you cannot use GitHub Security Advisory, email:

```
security@odavl.studio
```

Include the same information as above.

## Response Behavior

**Expectations:**

- **Best-effort response:** We will acknowledge your report and work on a fix
- **No guaranteed timeline:** Fixes are released when ready, not on schedule
- **No SLA:** We maintain Guardian as a small team without dedicated security staff
- **Public disclosure:** Fixed vulnerabilities will be disclosed in CHANGELOG.md once patched

## Scope

### In-Scope (We Accept Reports For)

- **Remote Code Execution (RCE):** Any ability to execute arbitrary code
- **Privilege Escalation:** Ability to gain unauthorized access or permissions
- **Filesystem Access:** Ability to read/write outside intended scope
- **Data Leakage:** Unintended exposure of sensitive information
- **Authentication Bypass:** Breaking login or credential verification
- **Denial of Service (DoS):** Making Guardian unusable for valid users

### Out-of-Scope (We Do Not Accept Reports For)

- **Third-party dependencies:** Report directly to the dependency maintainer
- **Cross-Site Scripting (XSS):** Not applicable (Guardian is Node.js CLI, not web)
- **Denial of Service via resource exhaustion:** Expected in sandboxed execution
- **Social engineering:** Not a Guardian vulnerability
- **Documentation issues:** Use regular GitHub issues instead

## Non-Guarantees

Guardian provides **no guarantees about:**

- **Security audit status:** Guardian is not security-audited by third parties
- **Penetration test results:** No formal security testing performed
- **Compliance certifications:** Not HIPAA, SOC2, ISO 27001, etc. certified
- **Vulnerability discovery:** Some vulnerabilities may never be found or fixed
- **Update availability:** Critical security fixes may require major version bumps
- **Backwards compatibility for security:** Security fixes may require code changes

## Summary

Guardian is a **best-effort open-source tool**. Use it to improve your testing confidence, not as your only security control. If you need enterprise-grade security guarantees, consider commercial alternatives.
