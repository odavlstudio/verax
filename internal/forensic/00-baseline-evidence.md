# Baseline Evidence Pack — Forensic Run (2026-01-02)

## Temp Workspaces (projA)
- Creation: `C:\temp\guardian-forensic-run\projA`

### npm init
```
cd C:\temp\guardian-forensic-run\projA
npm init -y
DIR_AFTER_INIT -> package.json only
```

### Install published package @odavl/guardian@2.0.0
```
npm i @odavl/guardian@2.0.0
# warnings: deprecated inflight/rimraf/glob/fstream (upstream), 0 vulnerabilities
DIR_AFTER_INSTALL -> node_modules, package-lock.json, package.json
```

### npx guardian --version
```
npx guardian --version
EXIT_CODE=0
Output: 2.0.0
DIR_AFTER_VERSION unchanged
```

### npx guardian --help
```
npx guardian --help > help.txt
EXIT_CODE=0
DIR_AFTER_HELP -> help.txt added
```

### npx guardian reality --url https://example.com --fast
```
npx guardian reality --url https://example.com --fast
EXIT_CODE=1
Error: snapshotBuilder.setHumanIntent is not a function
Run Dir reported: .odavlguardian\2026-01-02_19-23-34_example-com_custom_PENDING
Artifacts created in caller dir: .odavl-guardian/, .odavlguardian/
```

## Repo Root Install/Test
### npm install
```
cd c:\Users\sabou\odavlguardian
npm install
# warnings: glob deprecated, 1 high vulnerability reported post-install
```

### npm test
```
npm test
FAIL in test/mvp.test.js: AssertionError decision.json not found (line 94)
Exit code 1
Run Dir: C:\Users\sabou\AppData\Local\Temp\guardian-test-SwEKjK\2026-01-02_19-23-56_127-0-0-1-54818_custom_PENDING
Crawl timed out; decision.json missing
```

## npm audit --production
```
npm audit --production
High: qs <6.14.1 (GHSA-6rw7-vpxm-498p)
Exit code 1
```

## Git Integrity
```
git status --porcelain
# many modified/deleted/untracked files; runtime dirs present

git rev-parse HEAD
c651b26b38271182235fe6a537ba19b320a58269

git tag --points-at HEAD
# no tags

git describe --tags --exact-match
fatal: no tag exactly matches 'c651b26b38271182235fe6a537ba19b320a58269'
```

## Blockers Confirmed (Yes/No)
- Runtime pollution: **Yes** — projA reality run created `.odavl-guardian/` and `.odavlguardian/` in caller dir.
- Crash during guardian reality: **Yes** — `snapshotBuilder.setHumanIntent is not a function`, exit code 1 (projA run).
- Local tests failing: **Yes** — `npm test` fails at `test/mvp.test.js:94` (decision.json not found), exit code 1.
- Security audit high vuln: **Yes** — `qs <6.14.1` (GHSA-6rw7-vpxm-498p), `npm audit --production` exit code 1.
- Release integrity (tag): **Yes** — HEAD c651b26b… has no tag (`git tag --points-at HEAD` empty; `git describe --tags --exact-match` fatal).

## Notes
- Evidence captured per commands above; no fixes applied in this phase.
