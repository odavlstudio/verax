# Test Free vs Pro Response

Test script to validate server-side Pro gating.

## Free Response Test
curl -X POST http://localhost:3000/api/diagnose \
  -H "Content-Type: application/json" \
  -d '{"rawErrorText":"TypeError: Cannot read properties of undefined (reading map)"}'

Expected Free response:
- errorTitle, errorSignature, confidence present
- rankedCauses: 1 item only
- fixPaths: quickFix only (max 2 steps)
- diagnosticQuestions: absent
- bestFix, verify: absent
- isPro: false

## Pro Response Test
curl -X POST http://localhost:3000/api/diagnose \
  -H "Content-Type: application/json" \
  -H "X-Doctor-Pro: test-pro-token" \
  -d '{"rawErrorText":"TypeError: Cannot read properties of undefined (reading map)"}'

Expected Pro response:
- errorTitle, errorSignature, confidence present
- rankedCauses: 2-5 items
- fixPaths: quickFix, bestFix, verify all present with full steps
- diagnosticQuestions: present if signature includes them
- isPro: true
