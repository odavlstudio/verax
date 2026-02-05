# VERAX

Evidence-backed detection of silent user-facing failures in covered public flows.
Default scope: public, pre-login flows only (read-only).
Not a test runner. Not monitoring. Not analytics.
Not a business-logic correctness checker. Not a security scanner.

## 5-minute pilot (copy/paste)

1) Install (project-local)

`npm i -D @veraxhq/verax`

2) Install Playwright Chromium (required for `verax run`)

- Linux CI: `npx playwright install --with-deps chromium`
- macOS/Windows: `npx playwright install chromium`

Not needed for `verax readiness` / `verax capability-bundle`.

3) Readiness check (diagnostic-only; always exit 0)

`npx verax readiness --url https://your-site.example`

4) Capability bundle (diagnostic-only; minimized data)

`npx verax capability-bundle --url https://your-site.example --out .verax`

Artifacts: `.verax/capability-bundles/<timestamp>/` (includes `integrity.manifest.json`).

Notes:
- URLs stored in readiness/bundles are origin-only (`/`, no query/fragment). Use `--anonymize-host` to avoid storing hostnames (stores `originHash` only).

5) Run (with `--src`)

`npx verax run --url https://your-site.example --src .`

6) Run (without `--src`)

`npx verax run --url https://your-site.example`

7) Bundle a run directory (for upload/sharing)

`npx verax bundle <runDir> <bundleDir>`

Example:

`npx verax bundle .verax/runs/<scanId>/<runId> .verax/artifact-bundle`

## How to read results

- `SUCCESS`: No evidence-backed failures were found in the covered scope.
- `FINDINGS`: Evidence-backed failures were found; review `findings.json` and `evidence/`.
- `INCOMPLETE`: Coverage was partial. **THIS RESULT MUST NOT BE TREATED AS SAFE.**

## Artifacts (where the output lives)

By default, VERAX writes run directories under `.verax/runs/` (or `--out`).

Primary artifacts:

- `summary.json`: truth state + coverage summary.
- `findings.json`: findings with pointers to supporting evidence.
- `evidence/`: screenshots, traces, and supporting files.

## Troubleshooting (common infra)

- `Playwright cannot be imported.` → `npm i -D @veraxhq/verax` (or `npm i` if already installed).
- `Chromium could not be launched / browser missing.` → `npx playwright install chromium` (Linux CI: add `--with-deps`).
- `--out is not writable / invalid.` → pick a writable path, e.g. `--out ./verax-out`.
