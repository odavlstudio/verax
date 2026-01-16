/**
 * Wave 7 — VERAX Init
 * 
 * Initializes VERAX configuration and templates.
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

/**
 * Initialize VERAX configuration
 * @param {Object} options - { projectRoot, yes, ciTemplate, flowTemplate }
 * @returns {Promise<Object>} { created: string[], skipped: string[] }
 */
export async function runInit(options = {}) {
  const {
    projectRoot = process.cwd(),
    yes = false,
    ciTemplate = null,
    flowTemplate = null
  } = options;
  
  const created = [];
  const skipped = [];
  
  // Create .verax directory if needed
  const veraxDir = resolve(projectRoot, '.verax');
  mkdirSync(veraxDir, { recursive: true });

  // Zero-config enforcement: do not scaffold config files
  
  // Create CI template if requested
  if (ciTemplate === 'github') {
    const workflowsDir = resolve(projectRoot, '.github', 'workflows');
    mkdirSync(workflowsDir, { recursive: true });
    
    const workflowFile = resolve(workflowsDir, 'verax-ci.yml');
    if (existsSync(workflowFile) && !yes) {
      skipped.push('.github/workflows/verax-ci.yml');
    } else {
      const workflowContent = `name: VERAX CI

on:
  workflow_dispatch:
  pull_request:

jobs:
  verax-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start fixture server
        id: fixture-server
        run: |
          node test/infrastructure/fixture-server.js &
          SERVER_PID=$!
          echo "SERVER_PID=$SERVER_PID" >> $GITHUB_ENV
          sleep 3
          echo "url=http://127.0.0.1:8888" >> $GITHUB_OUTPUT
        working-directory: \${{ github.workspace }}

      - name: Run VERAX CI scan
        id: verax
        run: |
          npx @veraxhq/verax ci --url \${{ steps.fixture-server.outputs.url }} --projectRoot .
        continue-on-error: true

      - name: Stop fixture server
        if: always()
        run: |
          if [ ! -z "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null || true
          fi

      - name: Upload VERAX artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: verax-artifacts
          path: |
            .verax/runs/**/*
            .verax/verax-run-*.zip
          retention-days: 7
          if-no-files-found: ignore

      - name: Check VERAX exit code and fail gate
        if: always()
        run: |
          EXIT_CODE=\${{ steps.verax.exitcode }}
          if [ "$EXIT_CODE" == "" ]; then
            EXIT_CODE=\${{ steps.verax.outcome == 'success' && 0 || 1 }}
          fi
          
          if [ "$EXIT_CODE" == "0" ]; then
            echo "✅ VERAX: VERIFIED - Scan passed"
          elif [ "$EXIT_CODE" == "1" ]; then
            echo "⚠️ VERAX: NO_EXPECTATIONS_FOUND or MEDIUM/LOW findings"
            echo "Gate passes (non-blocking)"
          elif [ "$EXIT_CODE" == "2" ]; then
            echo "❌ VERAX: HIGH severity findings detected"
            echo "Gate fails (blocking)"
            exit 2
          elif [ "$EXIT_CODE" == "4" ]; then
            echo "❌ VERAX: INVALID_CONTEXT - URL does not match project"
            echo "Gate fails (blocking)"
            exit 4
          elif [ "$EXIT_CODE" == "3" ]; then
            echo "❌ VERAX: FATAL error"
            echo "Gate fails (blocking)"
            exit 3
          else
            echo "❌ VERAX: Unexpected exit code $EXIT_CODE"
            exit $EXIT_CODE
          fi
`;
      writeFileSync(workflowFile, workflowContent);
      created.push('.github/workflows/verax-ci.yml');
    }
  }
  
  // Create flow template if requested
  if (flowTemplate === 'login') {
    const flowsDir = resolve(projectRoot, 'flows');
    mkdirSync(flowsDir, { recursive: true });
    
    const flowFile = resolve(flowsDir, 'login.json');
    if (existsSync(flowFile) && !yes) {
      skipped.push('flows/login.json');
    } else {
      const flowContent = {
        name: 'login',
        description: 'User login flow',
        steps: [
          {
            type: 'goto',
            url: '${VERAX_BASE_URL}/login'
          },
          {
            type: 'fill',
            selector: 'input[name="email"]',
            value: '${VERAX_TEST_EMAIL}'
          },
          {
            type: 'fill',
            selector: 'input[name="password"]',
            value: '${VERAX_TEST_PASSWORD}',
            isSecret: true
          },
          {
            type: 'click',
            selector: 'button[type="submit"]'
          },
          {
            type: 'wait',
            selector: '[data-testid="dashboard"]',
            timeout: 5000
          }
        ]
      };
      writeFileSync(flowFile, JSON.stringify(flowContent, null, 2) + '\n');
      created.push('flows/login.json');
    }
  }
  
  return { created, skipped };
}

/**
 * Print init results
 * @param {Object} results - Init results
 */
export function printInitResults(results) {
  console.error('\n' + '═'.repeat(60));
  console.error('VERAX Init');
  console.error('═'.repeat(60));
  
  if (results.created.length > 0) {
    console.error('\n✅ Created:');
    results.created.forEach(file => {
      console.error(`  • ${file}`);
    });
  }
  
  if (results.skipped.length > 0) {
    console.error('\n⏭️  Skipped (already exist):');
    results.skipped.forEach(file => {
      console.error(`  • ${file}`);
    });
  }
  
  // No config scaffolding in zero-config mode
  
  if (results.created.includes('.github/workflows/verax-ci.yml')) {
    console.error('\n🔧 CI Setup:');
    console.error('  • Review .github/workflows/verax-ci.yml');
    console.error('  • Update URL placeholder with your deployment URL');
    console.error('  • Commit and push to enable VERAX in CI');
  }
  
  if (results.created.includes('flows/login.json')) {
    console.error('\n🔐 Flow Template:');
    console.error('  • Review flows/login.json');
    console.error('  • Set VERAX_TEST_EMAIL and VERAX_TEST_PASSWORD environment variables');
    console.error('  • Note: Flow commands are not available in this version');
  }
  
  console.error('═'.repeat(60) + '\n');
}

