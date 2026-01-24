## PHASE 1 — PROJECT & EXECUTION REALITY

### Project Anatomy
- CLI entry is a thin shim: [bin/verax.js](bin/verax.js) only dynamic-imports the real CLI code.
- Command router lives in [src/cli/entry.js](src/cli/entry.js) and only recognizes: run, inspect, doctor, diagnose, explain, stability, stability-run, triage, clean, gate. Interactive mode is explicitly disabled; unknown commands throw UsageError and exit 64.
- Published binary maps to `verax` via package bin field in [package.json](package.json); repository is ESM Node (type: module) with minimum Node 18.
- Help text claims many flags, but the run handler only destructures a subset; many parsed flags are never used (see limitations below).

### Execution Flow Reality (`verax run`)
- Arg handling/validation: `--url` is required; `--src` defaults to `.` and must exist; `--out` defaults to `.verax`; missing/invalid retention flags throw UsageError (exit 64) in [src/cli/entry.js](src/cli/entry.js) and [src/cli/run/validation-simple.js](src/cli/run/validation-simple.js).
- Read-only guard: `enforceReadOnlyOperation` rejects only when the output directory sits inside the source tree; otherwise run proceeds even with write-blocked promises (read-only not enforced beyond that) in [src/cli/entry.js](src/cli/entry.js).
- Run identity: [src/cli/util/support/run-id.js](src/cli/util/support/run-id.js) delegates to [src/verax/core/run-id.js](src/verax/core/run-id.js) producing a deterministic SHA-256–based 16-char hash from the URL and static budgets (no timestamp/randomness). Re-running the same URL reuses the same `<out>/runs/<runId>` path and overwrites prior artifacts.
- Setup: [src/cli/commands/run.js](src/cli/commands/run.js) creates the run directory via `getRunPaths`/`ensureRunDirectories`, instantiates `RunEventEmitter` (heartbeats every 2.5s into traces), and generates the runId.
- Discovery phase: writes `run.status.json` (status RUNNING) and `run.meta.json` with command/url/src/out metadata before any scanning, using detected project profile from [src/cli/util/config/project-discovery.js](src/cli/util/config/project-discovery.js).
- Learn phase: extracts expectations by recursively scanning source files (AST + HTML heuristics) with skip filters for node_modules/dist/etc. in [src/cli/util/observation/expectation-extractor.js](src/cli/util/observation/expectation-extractor.js). Expectations are sorted and assigned deterministic IDs. Runtime budget is computed purely from expectation count via [src/cli/util/observation/runtime-budget.js](src/cli/util/observation/runtime-budget.js); the user’s `--max-total-ms`/`--profile` is ignored.
- Observe phase: launches headless Playwright Chromium in [src/cli/util/observation/observation-engine.js](src/cli/util/observation/observation-engine.js). All mutating HTTP methods are blocked; network/console are redacted/logged. Runtime navigation links are discovered post-load. Each expectation (static + runtime) is executed through `InteractionPlanner`, which captures before/after screenshots, DOM diffs, network logs, console logs, and writes evidence files via [src/cli/util/evidence/evidence-engine.js](src/cli/util/evidence/evidence-engine.js). Auth options are parsed but never forwarded, so no cookies/headers/storage state are applied.
- Detect phase: learned expectations and observations are converted to findings in [src/cli/phases/detect-phase.js](src/cli/phases/detect-phase.js), using the detection engine in [src/cli/util/detection-engine.js](src/cli/util/detection-engine.js) and constitution validator; errors here fall back to an empty findings set.
- Artifact finalization: `run.status.json` is rewritten to COMPLETE/INCOMPLETE, `summary.json`, `findings.json`, `traces.jsonl`, `project.json`, `learn.json`, `observe.json`, optional `run.digest.json` (only if digest is present) and completion sentinel `.run-complete` are written in [src/cli/commands/run.js](src/cli/commands/run.js). Validation in [src/cli/util/run-artifact-validation.js](src/cli/util/run-artifact-validation.js) can downgrade status to INCOMPLETE/FAIL_DATA if artifacts are missing/corrupt.
- Exit codes: after validation, exit 1 if silentFailures > 0; 66 if run marked INCOMPLETE; otherwise 0. Global/phase timeouts use `TimeoutManager` and `withTimeout`; a timeout triggers `createTimeoutHandler` to mark run FAILED and exit 0 (no sentinel).
- Retention: unless `--no-retention`, it deletes oldest runs beyond retain count using birthtime ordering while keeping the active runId in [src/cli/util/support/retention.js](src/cli/util/support/retention.js).

### Artifact & Output Reality
- Run directory location: `<out>/runs/<runId>/` from [src/cli/util/support/paths.js](src/cli/util/support/paths.js).
- Always attempted to write (happy path): `run.status.json`, `run.meta.json`, `summary.json`, `findings.json`, `traces.jsonl`, `learn.json`, `observe.json`, `project.json`, evidence directory, `.run-complete` sentinel.
- Evidence contents per interaction (when captured): `exp_<n>_before.png`, `exp_<n>_after.png`, `exp_<n>_dom_diff.json`, `exp_<n>_network.json`, `exp_<n>_console_errors.json` plus any correlated files listed in observation entries via [src/cli/util/evidence/evidence-engine.js](src/cli/util/evidence/evidence-engine.js).
- Traces: every emitted event and heartbeat is appended as JSONL in `traces.jsonl` via [src/cli/commands/run.js](src/cli/commands/run.js) and [src/cli/util/support/events.js](src/cli/util/support/events.js).
- Digest: `run.digest.json` is only written when observation produced a digest; determinism helpers live in [src/cli/util/evidence/digest-engine.js](src/cli/util/evidence/digest-engine.js).
- Failure/timeout paths: `createTimeoutHandler` and `handleRunError` still write `run.status.json`, `run.meta.json`, `summary.json` (status FAILED) but skip sentinel; artifact validation later marks such runs INCOMPLETE/FAIL_DATA.
- Deterministic runId means reruns for the same URL overwrite the same artifact folder, so prior evidence is not retained unless the user changes `--out`.

### Observed Limitations (non-speculative)
- CLI parses but the run command ignores: `--auth-storage`, `--auth-cookie`, `--auth-header`, `--auth-mode`, `--learn-paths`, `--allow-empty-learn`, `--project-subdir`, `--profile`, `--max-total-ms`, `--exit-on-first-actionable`, and `--retain-runs` beyond basic numeric validation; these options never reach `runCommand` or downstream engines in [src/cli/commands/run.js](src/cli/commands/run.js).
- Auth is therefore never applied in Playwright despite help text support.
- Runtime budget always uses defaults; user-supplied time budgets are ignored.
- Run IDs are deterministic and not namespaced per execution, so repeated scans of the same URL overwrite artifacts and may confuse retention bookkeeping.
- Completion sentinel is only written on the success path; any thrown error or timeout leaves runs without `.run-complete`, causing validation to mark them incomplete even if partial artifacts exist.

## PHASE 2 — PROMISE EXTRACTION REALITY

### Extraction Sources
- Scanner walks resolved source roots from discovery and recurses all files except skipped dirs (node_modules, dist, build, .next, etc.) in [src/cli/util/observation/expectation-extractor.js](src/cli/util/observation/expectation-extractor.js). File types considered: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.vue`, `.svelte`, `.html` plus Next `<Link>` patterns inside JS/TS text lines.
- HTML extraction (static regex) covers `<a href>`, `<button>`, `<form action>`, `<input required>`, `aria-live` elements in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L1-L399). Dynamic href/action patterns containing `${`, `+`, or backticks are skipped and counted as `skipped.dynamic`.
- JSX/TSX uses Babel AST parsing to find `<button onClick>`, `<form onSubmit>`, `<input required>`, validation handlers, and `aria-live` regions in [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js). Only elements with handlers/attributes present are emitted; buttons with `type="submit"` are skipped there (forms handle submit).
- Framework-specific regex extractors run for Vue, Angular, and SvelteKit Single File Components: [vue-extractor.js](src/cli/util/detection/vue-extractor.js), [angular-extractor.js](src/cli/util/detection/angular-extractor.js), [sveltekit-extractor.js](src/cli/util/detection/sveltekit-extractor.js). All restrict to literal static paths; anything with `$`, `{`, `(`, `[` or params like `/:id`/`[slug]` is skipped and tallied.
- SvelteKit filesystem routes derive routes from file paths under `src/routes` only when segments lack brackets in [sveltekit-extractor.js](src/cli/util/detection/sveltekit-extractor.js#L104-L179).

### Supported Promise Types (as coded)
- Navigation:
	- HTML `<a href>` static links in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L86-L143) and Svelte/Vue/Angular link patterns in their extractors.
	- Next.js `<Link href>` and `router.push/replace/prefetch("/path")` regex lines in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L430-L514); dynamic hrefs skipped.
	- Vue `<router-link to="/path">` and `$router.push/replace` literals only in [vue-extractor.js](src/cli/util/detection/vue-extractor.js).
	- Angular `[routerLink]`, `router.navigate/ByUrl` literals only in [angular-extractor.js](src/cli/util/detection/angular-extractor.js).
	- Svelte `<a href>` and `goto("/path")` literals in [sveltekit-extractor.js](src/cli/util/detection/sveltekit-extractor.js#L19-L103), plus filesystem route derivation.
- Form submissions:
	- `<form action="/path">` static in HTML/Vue/Angular/SvelteKit extractors (same skip rules); JSX/TSX `<form onSubmit>` via AST in [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js#L75-L141).
- Network requests:
	- Regex only: `fetch("http..." )` and `axios.<method>("http..." )` in JS/TS lines in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L515-L578); relative URLs are counted as skipped.external when static, dynamic templated URLs skipped.dynamic. No AST-level network detection.
- State mutations:
	- Heuristic regex only: `useState(`, `dispatch({`, `set({` with a loose `zustand`/`store` substring guard in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L579-L621). No other state patterns.
- UI feedback / validation:
	- Input `required` attributes (HTML and JSX) produce validation promises in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L144-L216) and [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js#L143-L200).
	- Form handler code emitting validation promises when handler source contains keywords in [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js#L202-L256); selectors are null when unknown.
	- Aria-live regions create feedback promises in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L217-L259). Toast/modal imports are tracked but not converted into promises (imports only inform navigation detection and are otherwise unused).

### Determinism & Identity
- Expectations are sorted deterministically by file/line/column/kind/value before writing learn artifacts in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L20-L74) and [writeLearnJson](src/cli/util/evidence/learn-writer.js#L1-L34).
- IDs: `expIdFromHash` hashes normalized file path + line + column + promise kind + value to `exp_<6hex>` in [idgen.js](src/cli/util/support/idgen.js#L1-L49). Angular/SvelteKit extractors assign IDs immediately; HTML/JS/AST expectations get IDs after sort in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L26-L38).
- Findings later derive `finding_<expId>` via [findings-writer.js](src/cli/util/evidence/findings-writer.js#L1-L34). Ordering is stable by the comparator in [idgen.js](src/cli/util/support/idgen.js#L51-L82).

### Explicit Limitations
- Dynamic routes or expressions containing `${`, `+`, backticks, function calls, array/routerLink bindings with non-literals, parameter segments (`/:id`, `[slug]`, `[[optional]]`) are explicitly skipped and counted in `skipped` structures in [vue-extractor.js](src/cli/util/detection/vue-extractor.js), [angular-extractor.js](src/cli/util/detection/angular-extractor.js), [sveltekit-extractor.js](src/cli/util/detection/sveltekit-extractor.js), and [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L33-L60).
- No runtime or data-flow analysis: only static string literals/regex hits are emitted; conditional paths, props-driven routes, and dynamic query params are not extracted.
- Network detection ignores relative/local URLs (counts as skipped.external) and any templated URLs (skipped.dynamic); no axios instance interceptors, no GraphQL, no WebSocket detection.
- State detection is shallow: only simple regex hits for React hooks/dispatch/Zustand; no MobX, Redux Toolkit createSlice, context reducers, or class setState patterns.
- Vue extractor ignores dynamic `to` bindings and router calls with variables; Angular extractor ignores non-literal arrays or params; SvelteKit filesystem routes skip any bracketed segments, so dynamic routes generate no promises.

### Mismatch With Vision (code-evidenced)
- Vision/docs claim broad “technical promise” understanding, but code limits extraction to static literals and a handful of regex/AST heuristics; dynamic routes, conditional navigation, and data-dependent network calls are not emitted (see skip policies above).
- UI feedback “toasts/alerts/snackbar” imports are tracked in [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js#L39-L70) but never produce promises; only `aria-live` and `required`/validation heuristics emit feedback promises.
- Help text and narrative imply deep form validation awareness, but implementation only checks for `preventDefault`, keyword heuristics, and `required` attributes; no schema/validator/framework-specific extraction present in the code paths cited.

---

## PHASE 3: OBSERVATION, EVIDENCE CAPTURE, AND SILENCE DETECTION (RUNTIME MECHANICS)

### Runtime Environment & Browser Automation Setup
- **Playwright Configuration**: Launched in headless mode (headless: true) with viewport 1280x800 in [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L1-L50). Read-only enforcement: POST/PUT/PATCH/DELETE requests are intercepted and blocked; only GET requests and browser navigation are allowed.
- **Page Listeners**: During `executeRuntimeNavigation`, before interaction execution:
  - Network request handler logs all XHR/fetch calls with URL, method, status, timing in [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L200-L250).
  - Console listener captures `console.log`, `console.error`, `console.warn` with timestamp.
  - Response listener logs HTTP response bodies (captured only for GET requests due to read-only filter).
  - No DOM mutation observer; instead, before/after DOM snapshots are captured via `page.content()` and parsed into DOM trees.

### Evidence Capture (Before & After Interaction)
- **Before State**: Called from [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L100-L150):
  - Screenshot via `page.screenshot()` at baseline.
  - DOM snapshot via `page.content()` parsed to element tree; DOM fingerprint computed as count of elements by tag + first 50 text nodes concatenated.
  - Route signature captured via injected `window.__VERAX_ROUTE_TRANSITIONS__` (see route-sensor below).
  - Current form input values serialized if a form element exists.
  - Network log empty array initialized.
  - Console log empty array initialized.
- **After State**: Captured once interaction completes and outcome waiting begins (see Outcome Watcher below):
  - Screenshot via `page.screenshot()` after interaction and outcome acknowledgment.
  - DOM snapshot via `page.content()` parsed identically.
  - Route signature re-captured from same injected array.
  - Form input values re-serialized (if form exists).
  - Network log contains all captured requests from interaction start to observation end.
  - Console log contains all captured messages from interaction start to observation end.

### Route Detection (SPA Route Transitions)
- **Route Sensor Injection**: At page load, [route-sensor.js](src/cli/util/observation/route-sensor.js#L1-L80) injects JavaScript that patches `window.history.pushState` and `window.history.replaceState` to capture route transition events into `window.__VERAX_ROUTE_TRANSITIONS__` array.
- **Route Signature**: Computed on-demand via [route-sensor.js](src/cli/util/observation/route-sensor.js#L80-L150):
  - **path**: `window.location.pathname + window.location.search`.
  - **title**: `document.title`.
  - **canonical**: href of first `<link rel="canonical">` if exists, else null.
  - **containerFingerprint**: `document.body.querySelectorAll('*').length` (total element count).
  - Signatures are stored as array elements in `window.__VERAX_ROUTE_TRANSITIONS__`.
- **Route Changed Detection** in [route-sensor.js](src/cli/util/observation/route-sensor.js#L150-L200): compares before/after signatures:
  - Different **path** → route changed = true.
  - Different **title** → route changed = true.
  - **containerFingerprint** changed by >20% (element count delta / before count > 0.20) → route changed = true.
  - Same path/title/fingerprint → route changed = false (SPA internal state change without navigation).
- **Behavior**: Route sensor does NOT detect virtual routing (e.g., Next.js App Router state changes without URL change) or client-only state transitions; only History API mutations or URL changes are detected. Route detection is boolean (changed/not-changed), not categorized by navigation type.

### DOM Diff & Meaningful Change Detection
- **DOM Diff Computation** in [dom-diff.js](src/cli/util/observation/dom-diff.js#L1-L100):
  - Before and after HTML strings are parsed to flat element lists.
  - Counts elements added, elements removed, attributes changed.
  - Returns: `{changed: boolean, isMeaningful: boolean, elementsAdded, elementsRemoved, attributesChanged}`.
  - **Noise Filtering** in [dom-diff.js](src/cli/util/observation/dom-diff.js#L100-L200):
    - Attributes like `data-timestamp`, `data-uuid`, `data-request-id`, Google Analytics `ga_*`, Facebook `fb_*` params are stripped before comparison.
    - If only noise attributes changed and no elements added/removed, `isMeaningful = false`.
  - **Meaningful Change Indicators** in [dom-diff.js](src/cli/util/observation/dom-diff.js#L200-L280):
    - Presence of feedback elements: `aria-live` regions, elements with class/id containing `toast`, `alert`, `snackbar`, `modal`, `dialog`.
    - Presence of validation errors: elements with `aria-invalid`, `aria-describedby` pointing to error text, or class containing `error`, `invalid`.
    - Form state changes: input `disabled`, `aria-disabled`, `checked`, `value` changed.
    - Any element added/removed > 0 (unless pure noise).
    - If any of the above are true, `isMeaningful = true`.
- **DOM Diff Size**: Compared against 100-byte threshold in [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L250-L280). Diffs representing >100 bytes of structural change count as a "DOM changed" signal.

### Outcome Watcher: Silence vs. Acknowledgment
- **Purpose**: Determine if an action (click/submit/observe) produced observable acknowledgment within a configurable timeout window.
- **Polling Loop** in [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L1-L100):
  - Polls for acknowledgment signals every 250 milliseconds.
  - Timeout: 10 seconds by default (configurable via budget).
  - **Stability Window**: 300 milliseconds; once a signal is detected, watcher waits an additional 300ms before early-exiting to confirm stability.
  - **Signals Checked** (each check is a boolean in [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L100-L200)):
    1. **Route Changed**: Compares route signature before interaction vs. after via `page.evaluate()` calling injected route-sensor getter (triggers `routeSignatureChanged` logic above).
    2. **DOM Changed**: Calls `page.content()`, computes DOM diff, checks if `isMeaningful=true` AND diff size >100 bytes.
    3. **Feedback Appeared**: Queries for feedback elements via `page.locator('aria-live, [role="alert"], .toast, .modal')` and checks if any are visible and textContent is non-empty.
    4. **Loading Resolved**: Checks for absence of loading indicators via locator queries for `[aria-busy="true"], .spinner, [class*="loading"]`; if previously present and now absent, signal = true.
  - **Early Exit Condition**: If any signal = true AND stability window (300ms) has passed without signal reverting, return `{acknowledged: true, ...}`.
  - **Timeout**: If 10s elapsed without acknowledgment, return `{acknowledged: false, ...}`.
- **Latency Buckets** in [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L200-L250):
  - `0-3s`: acknowledged within 3 seconds.
  - `3-6s`: acknowledged between 3-6 seconds.
  - `6-10s`: acknowledged between 6-10 seconds.
  - `>10s`: acknowledged after 10 seconds OR timed out (not acknowledged).
  - Watcher returns bundle: `{acknowledged: boolean, latencyBucket: string, signals: {route: bool, dom: bool, feedback: bool, loading: bool}, duration: ms}`.
- **Silence Definition**: `acknowledged=false` means NO signal triggered within 10s timeout. No retry; single observation window per interaction.

### Interaction Execution Order (Evidence Chain)
- **Execution Flow** in [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L1-L100):
  1. Capture **before state** (screenshot, DOM, route, form inputs, network/console logs reset).
  2. Inject route sensor at page context if not already injected.
  3. Listen to network/console events.
  4. **Execute interaction**:
     - **Runtime Navigation**: Call `page.goto(url)` directly or use `page.click()` if link element detected via selector.
     - **Button Click**: Find button via selector, call `page.click()`.
     - **Form Submission**: Find form via selector, fill inputs listed in promise (if required=true or name in handler code), call `page.click()` on submit button or `page.press('Enter')` on last input.
     - **Observe**: No click; just wait for signal (e.g., waiting for state change or network request completion).
  5. **Wait for Outcome** (calls outcome-watcher):
     - Poll for 4 signals (route/DOM/feedback/loading) every 250ms for up to 10s.
     - Record which signals triggered and at what latency.
     - Return `{acknowledged, latencyBucket, signals, duration}`.
  6. Capture **after state** (screenshot, DOM, route, form inputs, accumulated network/console logs).
  7. **Classify Outcome** in [outcome-evaluator.js](src/cli/util/observation/outcome-evaluator.js#L1-L100):
     - Compare expected outcome promise.expectedOutcome (e.g., "navigation", "feedback", "network", "state") against actual signals.
     - If promise.expectedOutcome matches a triggered signal OR acknowledged=true with latencyBucket <10s, outcome = success (meetsExpectation=true).
     - If acknowledged=false or latency >10s or expected signal not triggered, outcome = silence or unexpected (meetsExpectation=false).
     - Record reason: e.g., "route_changed", "dom_changed", "feedback_appeared", "timeout_no_signal", "expected_signal_missing".

### Evidence Law Enforcement (Finding Validation)
- **Evidence Categories** in [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L1-L100):
  - **Strong Evidence** (CONFIRMED finding requires ≥1):
    - `navigation`: route signature changed (path/title/containerFingerprint).
    - `meaningful_dom`: DOM diff computed, `isMeaningful=true`, size >100 bytes, feedback/validation/form state indicators present.
    - `feedback`: feedback elements appeared with non-empty text (aria-live, toast, error, success, modal).
    - `network`: HTTP request completed (status code received); same-origin only; GET requests only due to read-only enforcement.
  - **Weak Evidence** (cannot alone justify CONFIRMED):
    - `console`: `console.log` or `console.error` in captured logs; no console-only filtering for scope (all logs count as evidence).
    - `blocked_write`: POST/PUT/PATCH/DELETE request attempted and intercepted by read-only filter.
  - **Evidence Absence**: No network request detected, no DOM change detected, no feedback detected → finding status downgraded.
- **Constitution Validation Rules** in [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L100-L250):
  1. **Evidence Law Enforcement**: Finding status=CONFIRMED requires ≥1 strong evidence category. If all evidence is weak (console-only or blocked_write-only), downgrade to SUSPECTED.
  2. **No Guessing Rule**: If confidence > 0.7 (high confidence) but zero evidence categories present, downgrade status and reduce confidence by 0.2.
  3. **Required Fields**: status, severity, confidence must be present and non-null; if missing, finding is rejected.
  4. **Status/Severity Validation**: status ∈ {CONFIRMED, SUSPECTED, NOT_POSSIBLE}; severity ∈ {CRITICAL, MAJOR, MINOR}; confidence ∈ [0, 1].
  5. **Ambiguity Detection** in [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L250-L350):
     - If `blocked_write` evidence present → downgrade from CONFIRMED to SUSPECTED (write intent unclear; outcome ambiguous).
     - If evidence is `console_only` (console logs but no route/DOM/feedback/network) → downgrade to SUSPECTED (console logs could be noise or cached).
     - If evidence is `network_only` (network request but no DOM/feedback/route) → downgrade to SUSPECTED (network response not visible to user).
     - These downgrades occur automatically when evidence categories are classified; no manual override.
  6. **Confidence Reduction**: Downgraded findings have confidence reduced by 0.15 (e.g., 0.9 → 0.75).
- **Downgrade Path**: CONFIRMED (with strong evidence) → SUSPECTED (if ambiguity detected or evidence weak) → NOT_POSSIBLE (if finding contradicts expectation, e.g., no_signal AND expected route change).

### Failure Modes & False Results
- **False Silence (incorrectly marked acknowledged=false)**:
  - **Root Cause**: Debounced UI updates, slow network responses, or JavaScript-rendered feedback appearing after 10s timeout.
  - **Mechanism**: Outcome watcher has hard 10s timeout; latency buckets only go up to >10s but still return `acknowledged=true` if ANY signal fires; however, if no signal fires by 10s, result is acknowledged=false regardless of actual user-perceivable effect.
  - **Observable in Code**: [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L250-L290) has `if (elapsed >= 10000) return {acknowledged: false, ...}` with no retry.
  - **Example**: Form submits successfully but validation feedback rendered server-side takes 12s to appear; VERAX sees no feedback by 10s and marks as silence, but user saw successful outcome.
- **False Green (incorrectly marked acknowledged=true)**:
  - **Root Cause**: Transient DOM changes (e.g., progress spinner appearing then disappearing) or console logs from unrelated async code triggering signal detection.
  - **Mechanism**: Outcome watcher early-exits after stability window (300ms); if a DOM change occurs for 300ms then reverts, watcher records acknowledged=true and does not continue polling.
  - **Observable in Code**: [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L100-L150) exits loop once `signalTriggered && timeInStabilityWindow > 300ms`.
  - **Example**: React re-render adds/removes temporary elements for keying; if 300ms in, watcher assumes user-observable change and stops waiting. Actual outcome is error or silence but marked acknowledged.
- **Missing Evidence Due to Read-Only Enforcement**:
  - **Root Cause**: POST/PUT/PATCH/DELETE requests intercepted and blocked; responses not captured; server state changes not reflected in outcome decision.
  - **Mechanism**: [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L150-L200) blocks non-GET requests before they reach the network; response body never captured.
  - **Observable in Code**: Network listener only records `method: 'GET'` or skips mutating methods; blocked_write evidence category is populated when mutation detected, triggering ambiguity downgrade.
  - **Example**: Form submission POSTs data to `/api/save`; response is 200 OK but body not captured; DOM unchanged (server state saved silently); VERAX records blocked_write + no DOM change → SUSPECTED not CONFIRMED.
- **Route Detection Blind Spots**:
  - **Root Cause**: Virtual routing (Next.js App Router, Remix loaders) or client-only state changes without URL mutation.
  - **Mechanism**: Route sensor only watches History API and URL changes; framework-level navigation that doesn't mutate URL is not detected.
  - **Observable in Code**: [route-sensor.js](src/cli/util/observation/route-sensor.js#L1-L80) patches only `history.pushState` and `replaceState`; Next.js App Router state is not accessible from window context.
  - **Example**: Next.js App Router navigates from `/page1` to `/page2` but URL remains `/` (app is SPA-mode); route-sensor detects no URL change; navigation promise marked as silence.
- **DOM Diff Noise Filtering Issues**:
  - **Root Cause**: Legitimate attribute changes filtered as noise; or noise misidentified as meaningful feedback.
  - **Mechanism**: [dom-diff.js](src/cli/util/observation/dom-diff.js#L200-L250) maintains hardcoded list of noise patterns (data-timestamp, data-uuid, ga_*, fb_*); custom tracking params or framework-specific attributes not in list are counted as meaningful.
  - **Observable in Code**: Noise stripping regex in dom-diff.js is static; if app uses custom `data-track-id` or vendor-specific attributes, they are NOT stripped and cause false meaningful-change detection.
  - **Example**: React-based app re-renders with `data-track-session` changing every 100ms; DOM diff records this as meaningful change every 100ms; outcome-watcher early-exits on first 300ms window thinking UI updated; actual outcome unclear.
- **Evidence Law Downgrade Unexpected Interactions**:
  - **Root Cause**: Overlapping weak evidence categories or multiple ambiguity triggers causing cascading downgrades.
  - **Mechanism**: [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L250-L350) applies ALL ambiguity checks; if blocked_write AND console_only both true, downgrade happens twice (confidence reduced twice).
  - **Observable in Code**: No guard against multiple downgrade application; each ambiguity trigger independently reduces confidence.
  - **Example**: Form POST blocked (blocked_write=true) + server returns error in console (console_only=true) + no DOM feedback rendered → status downgraded from CONFIRMED to SUSPECTED, confidence 0.9 → 0.75 → 0.60 (two reductions applied).

### Summary: Reality vs. Vision
- **Claimed**: VERAX observes "deep technical understanding of outcomes"; vision implies semantic awareness of user intent and application correctness.
- **Actual**: VERAX observes 4 boolean signals (route/DOM/feedback/loading) with 10s timeout and 250ms polling. Evidence is categorized (strong vs. weak) and downgrades applied if evidence insufficient. No semantic understanding; only pattern matching on DOM elements, network requests, and route signatures.
- **Finding Status**: CONFIRMED when ≥1 strong evidence present. SUSPECTED when only weak evidence or ambiguity detected. NOT_POSSIBLE when outcome contradicts expectation and zero evidence.
- **Latency Awareness**: Watcher returns latency bucket (0-3s, 3-6s, 6-10s, >10s) but does not use it to calibrate silence threshold; all 4 buckets are treated as acknowledged=true if any signal fires; only >10s timeout triggers acknowledged=false.
- **Failure Modes**: Debounced UIs cause false silence; transient DOM changes cause false green; read-only enforcement hides POST responses; virtual routing undetected; hardcoded noise filters miss custom attributes.

---

## PHASE 4 — DETECTION, DETERMINISM & CI CONTRACT REALITY

### Detection Logic Reality (Finding Generation)
- **Detection Entry Point**: [detect-phase.js](src/cli/phases/detect-phase.js#L1-L80) calls detectSilentFailures() in [detection-engine.js](src/cli/util/detection-engine.js#L1-L150).
- **Three Silent Failure Classes Detected**:
  1. **dead_interaction_silent_failure** in [detection-engine.js](src/cli/util/detection-engine.js#L100-L200): Click action attempted but zero outcome signals (no nav, no DOM change, no feedback). Status downgraded to INFORMATIONAL if state context explains no-change (empty state, disabled button, valid no-op).
  2. **broken_navigation_promise** in [detection-engine.js](src/cli/util/detection-engine.js#L220-L320): Navigation intent (URL/router call) but route did not change AND no acknowledgment AND no UI change AND no feedback. Runtime navigation has higher confidence (0.85 base) than static nav (0.6 base).
  3. **silent_submission** in [detection-engine.js](src/cli/util/detection-engine.js#L340-L400): Form submit action but zero outcome signals (no nav, no DOM change, no feedback). Status determined by confidence threshold (≥0.7 = CONFIRMED, else SUSPECTED).
  4. **interaction_silent_failure** (PHASE 3): Runtime interaction detection not tied to static promises; triggered when observation.evidence.interactionIntent.classification.intentful === true AND observation.evidence.interactionAcknowledgment.acknowledged === false. Status always SUSPECTED, confidence always 0.8.
- **Observation-to-Finding Mapping** in [detection-engine.js](src/cli/util/detection-engine.js#L450-L536):
  - Observations matched to expectations by ID.
  - Each observation tested against all detection patterns (dead interaction, broken nav, silent submission).
  - First match emits a finding; no observation generates multiple findings.
  - Unmatched observations (no expectation) are skipped silently.
  - Candidates converted via createFinding() in [finding-contract.js](src/verax/detect/finding-contract.js#L1-L150).
  - ALL findings then validated through atchValidateFindings() in [constitution-validator.js](src/cli/util/observation/constitution-validator.js); invalid findings dropped before returning.
- **State Context Detection** in [detection-engine.js](src/cli/util/detection-engine.js#L40-L90):
  - **isEmpty**: UI signals (uiSignals.emptyState or uiSignals.noItems) OR interaction label contains "clear"/"delete" on empty list.
  - **isDisabled**: observation.beforeState.disabledElements.length > 0.
  - **isNoOp**: Valid behavior marker if label is "clear" or "delete" on empty list.
  - State context reason array populated with human-readable explanations.
  - Confidence capped: empty → ≤0.3, disabled → ≤0.3, no-op → ≤0.2.
- **Confidence Computation** in [detection-engine.js](src/cli/util/detection-engine.js#L95-L130):
  - Base: 0.6 for dead interaction, 0.85 for runtime nav, computed for others.
  - State adjustments: capped to 0.3 or 0.2 if state explains no-change.
  - Evidence adjustments: +0.1 each for screenshots, DOM diff, network activity (only if not state-explained).
  - Ambiguity reducers: -0.2 for console errors, -0.2 for blocked writes.
  - Final clamp: [0, 1].
  - **Runtime Navigation Specifics**: Confidence reduced by 0.1 if iframe context detected (observation.runtimeNav.context.kind === 'iframe').

### Determinism Guarantees & Ordering
- **Expectations Ordering**: [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L20-L74) sorts expectations deterministically by:
  - File path (normalized, forward slashes).
  - Line number (ascending).
  - Column number (ascending).
  - Kind (string comparison).
  - Value (string comparison).
  - Sorting happens AFTER all expectations extracted, IDs assigned post-sort in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L26-L38).
- **Expectation ID Generation**: [idgen.js](src/cli/util/support/idgen.js#L1-L49) derives deterministic ID via SHA-256 hash of normalized file path + line + column + promise kind + value, truncated to xp_<6hex>. Same hash = same ID across reruns.
- **Observations Ordering**: Observations written in [observe-writer.js](src/cli/util/observation/observe-writer.js) in execution order (array appended as interactions execute). NOT sorted; order reflects chronological execution.
- **Findings Ordering**: [findings-writer.js](src/cli/util/evidence/findings-writer.js#L1-L40) assigns deterministic indingId via indingIdFromExpectationId(finding.id) which derives from expectation ID. Findings array order is NOT guaranteed deterministic; order follows detection engine traversal of observations array (which is execution order).
- **Ordering Stability Caveat**: If two expectations on the SAME line/column/kind exist (possible if value differs and regex matches multiple times), their relative order is deterministic ONLY within a single run. Across runs, regex match order may differ if files change; NO guarantee of stable ID ordering.
- **Digest for Reproducibility**: [digest-engine.js](src/cli/util/evidence/digest-engine.js) optionally computes SHA-256 hash of: expectations array + observations array + findings array. Hash is written to un.digest.json if present. Digest changes if ANY artifact changes; used to prove reproducibility of evidence.

### Exit Code Contract (Actual Implementation)
- **Exit Code Paths** in [entry.js](src/cli/entry.js#L130-L260):
  1. **Exit 0**: Success — run completed, no findings detected, validation passed, OR global timeout (process.exit(0) in [run.js](src/cli/commands/run.js#L193) from timeout watchdog).
  2. **Exit 1**: Findings detected — valid run with detectData.stats.silentFailures > 0, validation passed, status is COMPLETE.
  3. **Exit 64**: Usage error — invalid CLI args (missing --url, bad flag), no args provided, interactive mode attempted.
  4. **Exit 65**: Input validation error — reserved for future use; not currently emitted in run.js.
  5. **Exit 66**: Incomplete run — validation failed (missing sentinel, corrupted artifacts, status downgraded to INCOMPLETE) in [run.js](src/cli/commands/run.js#L514).
  6. **Exit 2**: Internal crash — unhandled exception during command execution in [entry.js](src/cli/entry.js#L230-L260).
- **Exit Code Decision Tree** in [run.js](src/cli/commands/run.js#L510-L520):
  `
  validation = validateRunDirectory(paths.baseDir)
  exitCode = validationExitCode(validation)  // 0 if valid, 66 if not
  if exitCode === 0:
    if runStatus === 'INCOMPLETE': exitCode = 66
    else if silentFailures > 0: exitCode = 1
  `
- **Global Timeout Path** in [run.js](src/cli/commands/run.js#L185-L195):
  - TimeoutManager sets watchdog at [run.js](src/cli/commands/run.js#L646-L653).
  - If watchdog fires (budget.totalMaxMs exceeded), inalizeOnTimeout() called in [timeout-handler.js](src/cli/run/timeout-handler.js).
  - Finalizes with FAILED status, but process.exit(0) in [run.js](src/cli/commands/run.js#L193) (timeout is non-fatal exit).
  - No sentinel written on timeout (only written in artifact write phase in [run-completion-sentinel.js](src/cli/util/run-completion-sentinel.js)); validation marks run INCOMPLETE.
  - OBSERVATION: Timeout → FAILED status + no sentinel → validation fails → exit 66 (INCOMPLETE), NOT exit 0.

### CI Safety & Failure Transparency
- **Can VERAX exit 0 with incomplete data?**
  - YES, but only in two scenarios:
    1. **Global timeout**: Watchdog fires, process.exit(0) in [run.js](src/cli/commands/run.js#L193). Status FAILED, no sentinel. Validation fails, should be exit 66, NOT 0.
    2. **Validation passes despite artifact issues**: If validateRunDirectory() says valid (sentinel exists, all JSON files valid), but artifacts are incomplete (e.g., 0 findings generated), exit is 0 or 1 depending on finding count. Validation does NOT check completeness of observation—only JSON structure.
  - **RISK**: If observation phase times out mid-way but completion sentinel written, validation passes and exit is 0, even though many expectations untested.
- **Can VERAX exit 1 without strong evidence?**
  - YES if constitution validator downgrades CONFIRMED → SUSPECTED but finding still emitted and counted.
  - detectData.stats.silentFailures counts all findings with type matching 'silent_failure' patterns, regardless of status or evidence strength.
  - EXAMPLE: dead_interaction_silent_failure with status SUSPECTED (due to ambiguity/evidence) still increments silentFailures counter, triggering exit 1.
  - **OBSERVATION**: Exit 1 only means "findings emitted", not "findings are strong/confirmed."
- **Are timeouts, crashes, and partial runs visible?**
  - **Timeouts**: Marked in run.status.json and summary.json as FAILED or INCOMPLETE. NOT visible in exit code (exit 0 or 66 depending on sentinel).
  - **Crashes**: Marked in run.status.json as FAILED with error message. Exit code determined by entry.js exception handler (exit 2 for unhandled, or exit code from error.exitCode).
  - **Partial runs**: Artifacts validation checks for sentinel and required files. If sentinel missing or files missing, exit 66 (INCOMPLETE). If observe phase timed out mid-interaction, observations.json may be incomplete but validation does NOT check observation count vs. expectation count; only JSON validity.
  - **RISK**: Partial observation (only N of M expectations tested) is NOT detected; validation only checks file structure, not coverage.

### Artifact Validation & Status Determination
- **Validation Entry Point** in [run-artifact-validation.js](src/cli/util/run-artifact-validation.js#L60-L150):
  - alidateRunDirectory() checks:
    1. Completion sentinel .run-complete exists.
    2. summary.json valid JSON with required fields [runId, status, startedAt].
    3. findings.json valid JSON with required fields [findings, stats].
    4. observe.json valid JSON with required fields [observations, stats].
    5. run.meta.json valid JSON.
    6. run.status.json valid JSON.
    7. runId matches across all artifacts.
    8. summary.status === run.status.json status.
    9. findings count matches summary.findingsCounts total.
    10. findings array length matches findings.stats.total.
    11. evidence directory exists (warning if missing).
    12. traces.jsonl lines are valid JSON (warnings per invalid line).
- **Status Determination** in [run-artifact-validation.js](src/cli/util/run-artifact-validation.js#L250-L270):
  - If validation.valid === false:
    - If corrupted files present: status = FAIL_DATA.
    - Else if missing files present: status = INCOMPLETE.
    - Else if sentinel error found: status = INCOMPLETE.
    - Else: status = FAIL_DATA.
  - If validation.valid === true: status = existing summaryStatus (COMPLETE).
- **Exit Code from Validation** in [run-artifact-validation.js](src/cli/util/run-artifact-validation.js#L310-L316):
  - alidationExitCode(validation) returns 66 if invalid, else 0.
  - Invalid = any validation.valid === false.

### Determinism Risks & Known Violations
- **Risk 1: Regex Match Order Non-Determinism**
  - **Where**: expectation-extractor.js regex extraction (fetch, axios, useState, etc.) uses match() or matchAll() on source lines.
  - **Risk**: If a single source line has multiple matches (e.g., two etch() calls), order of extraction depends on regex engine. Relative ordering of these expectations is deterministic (all same line/column/kind, differ by value), but value order from regex matches may differ across JS engines or source changes.
  - **Mitigation**: Sort after extraction in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L26-L38) ensures deterministic ID assignment.
  - **Residual Risk**: If file format changes (e.g., ESM to CJS), regex matches may change, changing extracted expectation IDs.
- **Risk 2: Filesystem Walk Order**
  - **Where**: expectation-extractor.js recursively walks directories in [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L1-L399).
  - **Risk**: Filesystem walk order is OS-dependent (APFS vs. ext4 vs. NTFS return different orders). But since expectations are sorted post-extraction, final ordering is deterministic.
  - **Mitigation**: Sort step ensures deterministic IDs despite filesystem order variation.
- **Risk 3: Observation Order = Execution Order**
  - **Where**: observations array in observe.json written in execution order, NOT sorted.
  - **Risk**: If browser execution is non-deterministic (e.g., race conditions in Playwright, timing-dependent network events), observation order can vary across runs.
  - **Potential Cause**: Concurrent interaction execution, browser caching, CDN latency, network timeouts.
  - **Impact**: Findings order can vary (findings order follows observation order), even though finding IDs are deterministic (based on expectation IDs).
  - **No Mitigation**: Observations intentionally preserve execution order for debugging; no post-sort applied.
- **Risk 4: Route Sensor Injection Timing**
  - **Where**: route-sensor.js injected at [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L50-L100).
  - **Risk**: If script injection fails or page reloads between injection and observation, route transitions may not be captured. Determinism assumes injection always succeeds.
  - **Mitigation**: Injection in dedicated step before first interaction; page.evaluate() confirms presence.
- **Risk 5: Async Timing in Evidence Capture**
  - **Where**: page.content(), page.screenshot(), network listeners all async in [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L150-L250).
  - **Risk**: If browser is slow or network delays, before/after captures can differ in timing, leading to different evidence. Evidence content is deterministic, but timing of capture relative to actual browser state can vary.
  - **Mitigation**: Fixed timeouts (250ms poll, 300ms stability window, 10s max wait) bound variance.
- **Risk 6: Evidence Law Ambiguity Cascading**
  - **Where**: [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L250-L350) applies multiple ambiguity rules; each rule independently downgrades.
  - **Risk**: If multiple ambiguity conditions are met (e.g., blocked_write + console_only + network_only), confidence is reduced multiple times. Order of rule application not specified; if rules applied in different order (async, filesystem, etc.), final confidence can differ.
  - **Current Behavior**: Rules applied sequentially in code order; deterministic within single run. Across different code versions, rule order could change.
  - **Impact**: CONFIRMED finding with initial confidence 0.9 and 2 ambiguity triggers → confidence 0.9 - 0.15 - 0.15 = 0.6. If rules applied differently, could be 0.6 or 0.55.

### Summary: Reality vs. Vision & CI Guarantees
- **Claimed**: VERAX is "deterministic and CI-safe"; findings are deterministic, exit codes reflect true status.
- **Actual**:
  - Expectation extraction deterministic (sorted post-regex).
  - Finding IDs deterministic (SHA-256 of expectation attributes).
  - Observation order = execution order (non-deterministic due to browser timing, filesystem caching, async behavior).
  - Findings order = observation order (thus non-deterministic, even though IDs deterministic).
  - Exit codes reflect validation status + finding count, NOT evidence strength or completeness.
  - Can exit 0 if validation passes despite partial observation (no coverage check).
  - Can exit 1 with SUSPECTED findings (evidence weakness not reflected in exit code).
  - Timeouts marked as FAILED but exit 0 (semantic confusion: "failed" vs. "success").
  - Global timeout writes no sentinel, triggering exit 66 (INCOMPLETE), obscuring "timeout" in exit code.
- **CI Safety Risks**:
  - Partial observation not detected; exit 0 with untested expectations is possible.
  - Confidence cascading can vary across code versions; no guarantee of stable CONFIRMED count.
  - Observation order variation means findings.json order is unstable; diffing runs is fragile.
  - Evidence Law downgrade conditions are overlapping; second ambiguity trigger may apply twice if not guarded.


---

## PHASE 5 — VISION vs REALITY ALIGNMENT MATRIX

This matrix compares Vision 1.0 claims against observable code behavior documented in Phases 1–4.

### Claim 1: Read-Only Guarantee

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Read-Only Operation** | VERAX is strictly observational, never mutates analyzed application state | [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L150-L200) blocks POST/PUT/PATCH/DELETE; only GET requests allowed. Page.goto() for navigation but no state writes. | FULLY TRUE | POST/PUT/PATCH/DELETE intercepted before network transmission. |
| **Code Patching** | Never applies fixes to application code, never patches behavior | No code written to src/, no webpack/build modifications in [observation-engine.js](src/cli/util/observation/observation-engine.js). | FULLY TRUE | Playwright runs isolated headless browser; source code untouched. |
| **Output Directory Restriction** | Never modify the analyzed application (absolute claim) | [entry.js](src/cli/entry.js#L420-L440) enforces read-only boundary: rejects if --out inside --src. | PARTIALLY TRUE | enforceReadOnlyOperation only rejects if output sits inside source tree; could write to sibling dirs. |
| **Risk: Incomplete Boundary** | Vision implies absolute isolation | [run-artifact-validation.js](src/cli/util/run-artifact-validation.js#L1-L50) never checks for side effects; artifacts only validated for structure. | OVERSTATED | Boundary check is location-based, not behavior-based (actual write monitoring). |

### Claim 2: Evidence Authority

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **No Evidence to No Finding** | No evidence means no finding | [constitution-validator.js](src/cli/util/observation/constitution-validator.js#L250-L350) enforces Evidence Law: CONFIRMED requires strong evidence. Downgraded to SUSPECTED or dropped. | FULLY TRUE | Evidence categories enforced before finding emission. |
| **Weak Evidence to Low Confidence** | Weak evidence means low confidence | [detection-engine.js](src/cli/util/detection-engine.js#L95-L130) confidence computation: weak evidence triggers ambiguity downgrades. | FULLY TRUE | Confidence reduced mechanically based on evidence classification. |
| **No Assumptions** | VERAX never reports assumptions, reports provable reality | [detectSilentFailures()](src/cli/util/detection-engine.js#L450-L536) only generates findings when signals match observation. State context detection explains no-change. | MOSTLY TRUE | State context detection uses pattern-based heuristics (isEmpty, isDisabled keywords). |
| **Evidence Storage** | Before/after artifacts and verifiable runtime signals | [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L100-L250) captures screenshots, DOM diffs, network logs, console logs, route signatures. Evidence files written to evidence/ directory. | FULLY TRUE | All signal types captured and stored deterministically. |

### Claim 3: Silence Definition

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Silence Components** | No UI change, no navigation, no message, no visible acknowledgment | [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L1-L200) polls 4 signals: route changed, DOM changed, feedback appeared, loading resolved. All must be false for silence. | FULLY TRUE | Silence is defined as NOT(route OR DOM OR feedback OR loading). |
| **Indefinite Observation** | Vision implies continuous waiting for outcome | [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L250-L290) has hard 10s timeout: if elapsed >= 10000ms with no signal, acknowledged=false. | OVERSTATED | Vision does not mention timeout; code enforces 10s cutoff. Slow UIs marked silent. |
| **Silence as Evidence** | Silence is evidence | [detectSilentFailures()](src/cli/util/detection-engine.js#L100-L400) generates findings when silence detected. Absence of signals is actionable. | FULLY TRUE | Absence of signals generates findings. |

### Claim 4: Framework Agnosticism

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **No Framework Plugins** | Does not rely on framework plugins, SDKs, or adapters | [route-sensor.js](src/cli/util/observation/route-sensor.js#L1-L80) injects window.history patches; no Next.js/React SDK required. | FULLY TRUE | Pure browser-level observation; no framework hooks. |
| **Common Web Patterns** | Understands applications through common web interaction patterns | [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L1-L399) extracts static literal patterns only. Dynamic routes, props-driven navigation missed. | PARTIALLY TRUE | Extracts only static patterns; dynamic routes, computed state missed. |
| **90 Percent Coverage Claim** | Designed for 90% of modern web applications | Phase 2: Dynamic routes skipped; no data-flow analysis; state detection shallow. Actual coverage likely less than 50% for complex apps. | OVERSTATED | Extraction covers static literals only; cannot handle modern patterns. Coverage claim unsupported. |

### Claim 5: Promise Extraction & Real Interaction

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Derives Explicit Observable Promises** | Analyze application to derive explicit, observable promises | Extraction from HTML regex, JSX AST, framework extractors. All explicit code/UI scanning. | FULLY TRUE | Extraction is explicit code analysis. |
| **Includes Navigation Intent** | Navigation intent (links, routing, redirects) | [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L86-L430) extracts href, router.push, router calls, goto(). | FULLY TRUE | Navigation routes extracted. |
| **Includes Form Submission** | Form submission behavior | [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L75-L141) and [ast-promise-extractor.js](src/cli/util/detection/ast-promise-extractor.js#L75-L141) extract form submission. | FULLY TRUE | Form submissions extracted. |
| **Includes State Transitions** | Visible state transitions (state to UI) | [expectation-extractor.js](src/cli/util/observation/expectation-extractor.js#L579-L621) has shallow regex for useState, dispatch, set. No MobX, Redux Toolkit, RxJS. | OVERSTATED | Detection extremely limited; only React hooks detected. Modern state patterns missed. |
| **Acts as Rational User** | Interacts as rational, realistic user would, without guessing intent | [interaction-planner.js](src/cli/util/observation/interaction-planner.js#L1-L400) clicks buttons, submits forms, follows links. No random clicks. | FULLY TRUE | Interactions follow extracted promises only. |
| **Authentication Capability** | Vision implies execution like any user (with optional auth config) | [entry.js](src/cli/entry.js#L443-L460) parses --auth-storage, --auth-cookie, --auth-header but [run.js](src/cli/commands/run.js) never forwards to Playwright. Auth non-functional. | FALSE | Auth flags parsed but never applied. Execution without auth always. |

### Claim 6: Determinism

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Same App + State + Interaction = Same Outcome** | Given same application, state, interaction, must produce same outcome | Expectation IDs deterministic ([idgen.js](src/cli/util/support/idgen.js#L1-L49) SHA-256). Run IDs deterministic. Observations order = execution order (non-deterministic). | PARTIALLY TRUE | Expectations deterministic; observations and findings order vary. |
| **Predictability & Reproducibility** | Prioritizes determinism over intelligence; forensic clarity | Findings order = execution order (browser timing dependent). [run.js](src/cli/commands/run.js#L450-L500) has no stabilization. Digest [digest-engine.js](src/cli/util/evidence/digest-engine.js) sensitive to order. | OVERSTATED | Findings IDs deterministic but array order unstable. Cross-run diffs fragile. |

### Claim 7: All Silent Failure Classes

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **7 Failure Classes Listed** | Vision lists: Dead Interactions, Silent Submissions, Broken Navigation, Invisible State, Stuck/Phantom Loading, Silent Permission Walls, Render Failures | [detection-engine.js](src/cli/util/detection-engine.js#L100-L400) implements only 3-4: dead_interaction, broken_navigation, silent_submission, plus interaction_silent_failure (runtime). | OVERSTATED | Vision lists 7; code implements 3-4. Four classes not detected: Invisible State, Phantom Loading, Permission Walls, Render Failures. |
| **Observable Acknowledgment Types** | May include: navigation, messaging, state updates, loading resolution, validation feedback, focus changes | [outcome-watcher.js](src/cli/util/observation/outcome-watcher.js#L100-L200) checks: route changed, DOM changed, feedback appeared, loading resolved. NO focus change detection. | MOSTLY TRUE | 4 of 5 acknowledgment types implemented; focus ignored. |

### Claim 8: Zero Configuration

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Works Out-of-the-Box** | Zero configuration by default; works out-of-the-box in common case | verax run --url url requires only URL. Defaults: --src=. --out=.verax --retain-runs=10. | FULLY TRUE | Minimal required args; sensible defaults. |
| **Optional Config for Scope/Auth/CI** | Optional configuration for narrowing scope, providing auth, integrating CI | [entry.js](src/cli/entry.js#L443-L460) provides --src, --learn-paths, --auth options, --max-total-ms. | PARTIALLY TRUE | Options provided but auth non-functional; budget flags accepted but ignored (Phase 1). |

### Claim 9: Never a Gatekeeper by Default

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **No Hard Failures by Default** | No hard failures, no forced pipeline blocks, no automated judgment authority | Exit code 1 when findings detected; exit 66 when INCOMPLETE. Both can block CI. | OVERSTATED | Exit codes create blocking signals; easily configured to block pipelines. |
| **Informs Not Blocks** | VERAX informs decisions, does not block delivery | Exit 1 signals findings; CI system decides to block. But exit codes exist and are blocking triggers. | PARTIALLY TRUE | VERAX provides signal; CI blocks based on exit code. By default, signals exist; blocking depends on CI config. |

### Claim 10: CI Safety Guarantees

| Aspect | Vision Claim | Reality Evidence | Status | Reason for Mismatch |
|--------|--------------|------------------|--------|---------------------|
| **Never Masks Failures** | Implies transparency in all paths | Phase 4: Timeouts marked FAILED but exit 0 (via process.exit in [run.js](src/cli/commands/run.js#L193)). Partial observation not detected. | OVERSTATED | Timeout failure status is semantic; exit code is 0 (success). Misleading. |
| **Provides Actionable Evidence** | Evidence strong enough to act upon | [constitution-validator.js](src/cli/util/observation/constitution-validator.js) enforces Evidence Law. CONFIRMED findings have strong evidence. | MOSTLY TRUE | But SUSPECTED findings (weak evidence) also emitted and counted in exit code. Exit 1 does NOT distinguish CONFIRMED from SUSPECTED. |
| **Can Exit 0 with Incomplete Data** | Vision assumes full observation | No validation that all expectations were tested. Partial observation exits 0 if artifacts valid. | NOT MENTIONED | Vision assumes coverage validation; not implemented. Exit 0 with untested expectations possible. |

### Summary: Vision vs Reality Alignment

**Overall Assessment: ~40% Fully True, ~30% Partially True, ~25% Overstated, ~5% False**

**Key Discrepancies:**

1. **Framework Coverage**: Vision claims 90% coverage; extraction limited to static literals. Dynamic routes, computed state, advanced patterns skipped. Actual coverage likely 30-50%.

2. **Silent Failure Classes**: Vision lists 7; code implements 3-4. Invisible State Failures, Phantom Loading, Permission Walls, Render Failures unimplemented.

3. **Authentication**: Flags parsed but never applied. Auth feature advertised but non-functional.

4. **Determinism**: Expectations deterministic but observation order = execution order (non-deterministic). Findings order unstable across runs.

5. **Timeout Handling**: Vision does not mention 10s timeout; code enforces it. UIs slower than 10s marked silent. Timeout exit code ambiguous (0 or 66, not error).

6. **Partial Observation**: No validation that all expectations tested. Partial observation exits 0 if artifacts valid. Vision claims forensic clarity; code does not guarantee coverage.

7. **CI Safety**: Vision says informs not blocks; exit codes 1 and 66 are blocking triggers. Exit 1 does not distinguish CONFIRMED from SUSPECTED.

8. **State Context Heuristics**: Pattern-based confidence reduction (isEmpty, isDisabled) adds guessing despite no-assumptions claim.

