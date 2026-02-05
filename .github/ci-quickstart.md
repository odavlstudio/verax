# VERAX CI Integration — Quick Start (Pilot)

Minimal workflow that:
1) installs dependencies
2) installs Playwright Chromium
3) runs `verax run`
4) bundles artifacts
5) uploads the bundle

Create `.github/workflows/verax.yml`:

```yaml
name: VERAX (Pilot)

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verax:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright Chromium (Linux)
        if: runner.os == 'Linux'
        run: npx playwright install --with-deps chromium

      - name: Install Playwright Chromium (non-Linux)
        if: runner.os != 'Linux'
        run: npx playwright install chromium

      - name: Run VERAX
        env:
          VERAX_URL: https://your-site.example
        run: npx verax run --url ${{ env.VERAX_URL }} --out .verax --src . --ci-mode strict --min-coverage 0.90

      - name: Bundle artifacts (always, Linux)
        if: runner.os == 'Linux' && always()
        shell: bash
        run: |
          RUN_DIR=$(node --input-type=module -e "import { findLatestRun } from './node_modules/@veraxhq/verax/src/cli/util/ci/artifact-pack.js'; console.log(findLatestRun('.verax/runs') || '')" 2>/dev/null)
          if [ -n \"$RUN_DIR\" ]; then
            npx verax bundle \"$RUN_DIR\" .verax/artifact-bundle
          fi

      - name: Bundle artifacts (always, Windows)
        if: runner.os == 'Windows' && always()
        shell: pwsh
        run: |
          $runDir = node --input-type=module -e "import { findLatestRun } from './node_modules/@veraxhq/verax/src/cli/util/ci/artifact-pack.js'; console.log(findLatestRun('.verax/runs') || '')" 2>$null
          if ($runDir) {
            npx verax bundle $runDir .verax/artifact-bundle
          }

      - name: Upload bundle (always)
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: verax-bundle-${{ matrix.os }}
          path: .verax/artifact-bundle/
          retention-days: 7
          if-no-files-found: ignore
```

Exit code contract (unchanged): `0` SUCCESS, `20` FINDINGS, `30` INCOMPLETE, `50` INVARIANT_VIOLATION, `64` USAGE_ERROR.
