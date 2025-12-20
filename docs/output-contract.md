# Doctor Error Output Contract

Doctor Error emits a single JSON object per diagnosed error. All fields are required unless marked optional. English only. No placeholders.

## JSON Shape
```
{
  "errorTitle": string,                     // <= 80 chars, imperative or noun phrase
  "errorSignature": string,                // <= 140 chars; describes how to match (message, code, frame)
  "confidence": number,                    // 0..1 inclusive, rounded to two decimals
  "rankedCauses": [
    {
      "id": string,                        // stable kebab-case token
      "title": string,                     // <= 80 chars; concise cause
      "whyLikely": string,                 // <= 160 chars; evidence or heuristic
      "confidence": number,                // 0..1 inclusive, two decimals
      "quickCheck": string                 // <= 140 chars; deterministic check
    }
  ],                                         // 1..5 entries, sorted by confidence desc
  "diagnosticQuestions": [
    {
      "question": string,                  // <= 120 chars; single decision point
      "choices": [
        {
          "id": string,                   // kebab-case token
          "title": string,                // <= 60 chars; actionable choice
          "meaning": string               // <= 120 chars; what this answer implies
        }
      ]                                     // 2..4 choices; no freeform text
    }
  ],                                         // 0..2 items; omit when not needed
  "fixPaths": {
    "quickFix": { "steps": string[] },   // 1..6 steps, each <= 140 chars
    "bestFix": { "steps": string[] },    // 1..6 steps, durable resolution
    "verify": { "steps": string[] }      // 1..4 steps, observable checks
  },
  "safetyNotes": string[]                  // optional; each <= 120 chars
}
```

## Formatting Rules
- Use plain strings; no markdown, no bullet characters inside values.
- Keep steps imperative ("Set X", "Restart Y").
- Avoid long explanations; every field must fit its limit.
- Confidence must align with evidence; do not default to 0 or 1 without reason.
- Questions appear only when they reduce ambiguity; otherwise omit the array.
- Safety notes appear only when risk exists (data loss, downtime, security).
- All arrays must be non-empty within defined ranges; no nulls.

## Examples

### Example 1 — Undefined access in React effect
- Input error (raw):
  - `TypeError: Cannot read properties of undefined (reading 'map') at useEffect (/src/hooks/useItems.ts:42:15)`
- Output JSON:
```
{
  "errorTitle": "Undefined list access in effect",
  "errorSignature": "Cannot read properties of undefined (reading 'map') in useItems.ts:42",
  "confidence": 0.86,
  "rankedCauses": [
    {
      "id": "missing-props-guard",
      "title": "items prop arrives undefined before fetch resolves",
      "whyLikely": "stack points to useEffect before data load; common in suspense-less fetch",
      "confidence": 0.62,
      "quickCheck": "Log typeof items before map inside useEffect"
    },
    {
      "id": "selector-returns-undefined",
      "title": "selector returns undefined when store slice not registered",
      "whyLikely": "map is called on state slice referenced via selector",
      "confidence": 0.24,
      "quickCheck": "Check store keys include items slice before render"
    }
  ],
  "diagnosticQuestions": [
    {
      "question": "Is items fetched asynchronously before first render?",
      "choices": [
        { "id": "yes-async", "title": "Yes, fetched later", "meaning": "Need guard or initial empty array" },
        { "id": "no-sync", "title": "No, should be ready", "meaning": "State shape or selector likely wrong" }
      ]
    }
  ],
  "fixPaths": {
    "quickFix": {
      "steps": [
        "Initialize items to [] in component state or props default",
        "Guard map call: if (!items?.length) return null"
      ]
    },
    "bestFix": {
      "steps": [
        "Set items default to [] at source (fetch hook or selector)",
        "Add runtime prop-type or zod validation for items array",
        "Adjust effect to wait for items?.length before map"
      ]
    },
    "verify": {
      "steps": [
        "Reload page with slow network and confirm no TypeError",
        "Check component renders empty state then populated list"
      ]
    }
  },
  "safetyNotes": ["Guard avoids crash loops but may hide missing data; add logging if empty persists"]
}
```
- User-facing view (compact):
  - Likely cause: items is undefined before fetch. Quick check: log typeof items in useEffect. Quick Fix: default items to [] and guard map. Best Fix: set default at source and validate. Verify: reload on slow network; ensure no TypeError and list renders.

### Example 2 — ES module import in CommonJS runtime
- Input error (raw):
  - `SyntaxError: Unexpected token 'export' in node_modules/date-fns/esm/index.js while running node app.js`
- Output JSON:
```
{
  "errorTitle": "ESM module loaded by CommonJS entry",
  "errorSignature": "Unexpected token 'export' in node_modules/*/esm/*.js when node app.js",
  "confidence": 0.9,
  "rankedCauses": [
    {
      "id": "cjs-entry-using-esm-package",
      "title": "CommonJS entry requires ESM-only dependency",
      "whyLikely": "error shows export syntax in dependency under esm/ path",
      "confidence": 0.78,
      "quickCheck": "Inspect package.json type field ("type": "module"?) and main entry"
    },
    {
      "id": "old-node-version",
      "title": "Node version lacks ESM support flags",
      "whyLikely": "Older Node throws on ESM syntax without flags",
      "confidence": 0.12,
      "quickCheck": "Run node -v and compare >=16"
    }
  ],
  "diagnosticQuestions": [
    {
      "question": "Is the project configured as ESM?",
      "choices": [
        { "id": "package-type-module", "title": "Yes, type=module", "meaning": "Switch entry to .mjs or use dynamic import" },
        { "id": "package-type-commonjs", "title": "No, type commonjs", "meaning": "Use CJS build of dependency or enable ESM loader" }
      ]
    }
  ],
  "fixPaths": {
    "quickFix": {
      "steps": [
        "Swap import to require('date-fns/cjs') or equivalent CJS build",
        "If unavailable, use dynamic import: const mod = await import('date-fns')"
      ]
    },
    "bestFix": {
      "steps": [
        "Set package.json type to module or use .mjs entry",
        "Update imports to ESM syntax consistently",
        "Upgrade Node to >=18 and run with no legacy flags"
      ]
    },
    "verify": {
      "steps": [
        "Run node app.js without SyntaxError",
        "Ensure runtime imports resolve without --experimental flags"
      ]
    }
  },
  "safetyNotes": []
}
```
- User-facing view (compact):
  - Likely cause: CommonJS entry is requiring an ESM-only package. Quick check: inspect package.json type and dependency docs. Quick Fix: use CJS build or dynamic import. Best Fix: convert project to ESM and upgrade Node. Verify: rerun without SyntaxError.

### Example 3 — Axios request blocked by self-signed cert
- Input error (raw):
  - `Error: self signed certificate in certificate chain at TLSSocket.onConnectSecure (node:_tls_wrap:1546:34)`
- Output JSON:
```
{
  "errorTitle": "TLS blocked by self-signed certificate",
  "errorSignature": "self signed certificate in certificate chain during Axios HTTPS call",
  "confidence": 0.83,
  "rankedCauses": [
    {
      "id": "missing-trusted-ca",
      "title": "Server cert not trusted by Node trust store",
      "whyLikely": "stack from _tls_wrap with self signed certificate wording",
      "confidence": 0.71,
      "quickCheck": "Run NODE_TLS_REJECT_UNAUTHORIZED=0 temporarily to confirm trust issue"
    },
    {
      "id": "proxy-injecting-cert",
      "title": "Corporate proxy injecting self-signed cert",
      "whyLikely": "Common in corporate networks intercepting HTTPS",
      "confidence": 0.12,
      "quickCheck": "Check HTTPS_PROXY/HTTP_PROXY env vars presence"
    }
  ],
  "diagnosticQuestions": [],
  "fixPaths": {
    "quickFix": {
      "steps": [
        "Temporarily set NODE_TLS_REJECT_UNAUTHORIZED=0 only to confirm cause",
        "Retry request to verify it passes with relaxed TLS"
      ]
    },
    "bestFix": {
      "steps": [
        "Obtain server or proxy CA certificate",
        "Add CA to Node trust store via NODE_EXTRA_CA_CERTS=/path/ca.pem",
        "Restart process to load trust store"
      ]
    },
    "verify": {
      "steps": [
        "Run Axios request without NODE_TLS_REJECT_UNAUTHORIZED and confirm success",
        "Check that TLS handshake completes without warnings"
      ]
    }
  },
  "safetyNotes": ["Do not keep NODE_TLS_REJECT_UNAUTHORIZED=0 in production; use only for diagnosis"]
}
```
- User-facing view (compact):
  - Likely cause: untrusted self-signed cert. Quick check: retry with NODE_TLS_REJECT_UNAUTHORIZED=0 to confirm. Quick Fix: temporary disable for validation only. Best Fix: install CA via NODE_EXTRA_CA_CERTS and retry. Verify: request succeeds without relaxed TLS.
