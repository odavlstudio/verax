# VERAX Demo: Static HTML

A minimal static HTML project demonstrating VERAX silent failure detection.

## Project Contents

- `index.html` - Simple web page with intentional silent failure

## The Silent Failure

The demo includes a navigation link without an `href` attribute:

```html
<!-- INTENTIONAL SILENT FAILURE: href is missing -->
<a>Products</a>
```

This represents a promise that the link should be clickable and functional, but it fails silently:
- **Code says:** There's a link element (appears as a link to the user)
- **User expects:** Clicking should navigate or perform an action
- **Reality:** The link does nothing when clicked
- **VERAX detects:** Coverage gap or unproven expectation (no href to navigate to)

## How to Run VERAX

### 1. Install VERAX globally

```bash
npm install -g @veraxhq/verax
```

### 2. Run VERAX on this demo

From the `demo-static/` directory:

```bash
verax run --url file://$(pwd)/index.html --src . --out .verax
```

Or if on Windows:

```powershell
verax run --url file://$((Get-Item -Path ".\").FullName | % {$_ -replace '\\', '/'})/index.html --src . --out .verax
```

Or simply:

```bash
verax run --url http://localhost:3000 --src .
```

(if you serve this directory with a local HTTP server)

### 3. Review the Results

After VERAX completes, check the artifacts:

```bash
cat .verax/runs/*/findings.json
cat .verax/runs/*/summary.json
```

## Expected Results

VERAX should:
1. ✅ Learn the page structure
2. ✅ Observe actual behavior (click on the link element)
3. ✅ Detect that the link has no href, making it a coverage-gap
4. ✅ Report findings with evidence

## What VERAX Won't Do

- ❌ NOT judge whether your HTML is correct
- ❌ NOT require navigation to actually work
- ❌ NOT guess at intent
- ❌ NOT make assumptions beyond explicit code promises

VERAX only reports what can be observed vs. what code explicitly promises.

## Learning Resources

- See `.verax/runs/<runId>/learn.json` for extracted expectations
- See `.verax/runs/<runId>/observe.json` for actual observations
- See `.verax/runs/<runId>/findings.json` for VERAX's classification
- See `.verax/runs/<runId>/evidence/` for screenshots and logs

## Privacy

VERAX automatically redacts:
- Authorization headers
- Cookies and session tokens
- API keys in URLs and bodies
- JWT tokens and bearer tokens
- Console logs with sensitive data

All evidence files are safe to share in CI/CD logs.
