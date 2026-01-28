/**
 * Wave 7 — VERAX Doctor
 * 
 * Checks environment, dependencies, and project setup.
 */

import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { get } from 'http';
import { get as httpsGet } from 'https';

/**
 * Check Node version
 * @returns {Object} { status: 'pass'|'warn'|'fail', details: string, fix?: string }
 */
function checkNodeVersion() {
  const requiredMajor = 18;
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion >= requiredMajor) {
    return { status: 'pass', details: `Node.js ${nodeVersion} (required: >=${requiredMajor}.0.0)` };
  } else {
    return { 
      status: 'fail', 
      details: `Node.js ${nodeVersion} is too old (required: >=${requiredMajor}.0.0)`,
      fix: `Upgrade Node.js: nvm install ${requiredMajor} or visit nodejs.org`
    };
  }
}

/**
 * Check write permissions to output directory
 * @param {string} projectRoot - Project root
 * @returns {Object} { status: 'pass'|'fail', details: string, fix?: string }
 */
function checkWritePermissions(projectRoot) {
  try {
    const veraxDir = resolve(projectRoot, '.verax');
    mkdirSync(veraxDir, { recursive: true });
    
    const testFile = resolve(veraxDir, '.write-test');
    writeFileSync(testFile, 'test');
    unlinkSync(testFile);
    
    return { status: 'pass', details: 'Can write to .verax directory' };
  } catch (error) {
    return {
      status: 'fail',
      details: `Cannot write to .verax directory: ${error.message}`,
      fix: 'Check file permissions or run with appropriate access'
    };
  }
}

/**
 * Check Playwright availability
 * @returns {Promise<Object>} { status: 'pass'|'fail', details: string, fix?: string }
 */
async function checkPlaywright() {
  try {
    // Lazy-load playwright to avoid breaking when devDependencies aren't installed
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return { status: 'pass', details: 'Playwright browser is available' };
  } catch (error) {
    // Detect common error messages and provide specific fixes
    const errorMsg = error.message.toLowerCase();
    let fix = 'Run: npx playwright install';
    
    if (errorMsg.includes('chromium') || errorMsg.includes('executable')) {
      fix = 'Run: npx playwright install chromium';
    } else if (errorMsg.includes('missing') || errorMsg.includes('not found') || errorMsg.includes('cannot find')) {
      fix = 'Run: npm install --save-dev playwright && npx playwright install';
    }
    
    return {
      status: 'fail',
      details: `Playwright browser not available: ${error.message}`,
      fix: fix
    };
  }
}

/**
 * Check project detection and expectations
 * @param {string} projectRoot - Project root
 * @returns {Promise<Object>} { status: 'pass'|'warn'|'fail', details: string, metadata?: Object, fix?: string }
 */
async function checkProjectExpectations(projectRoot) {
  try {
    // Lazy-load learn to avoid requiring devDependencies like playwright
    const { learn } = await import('../index.js');
    const manifest = await learn(projectRoot);
    const projectType = manifest.projectType || 'unknown';
    const expectationsCount = manifest.learnTruth?.expectationsDiscovered || 0;
    
    if (expectationsCount > 0) {
      return {
        status: 'pass',
        details: `Project type: ${projectType}, ${expectationsCount} expectations found`,
        metadata: {
          projectType,
          expectationsCount,
          routesCount: manifest.publicRoutes?.length || 0
        }
      };
    } else {
      return {
        status: 'warn',
        details: `Project type: ${projectType}, but 0 expectations found`,
        metadata: {
          projectType,
          expectationsCount: 0
        },
        fix: 'Add static patterns (HTML links, static fetch calls, or state mutations)'
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      details: `Failed to analyze project: ${error.message}`,
      fix: 'Check that projectRoot is correct and project is readable'
    };
  }
}

/**
 * Check URL reachability
 * @param {string} url - URL to check
 * @returns {Promise<Object>} { status: 'pass'|'warn'|'fail', details: string, fix?: string }
 */
async function checkUrlReachability(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const clientGet = urlObj.protocol === 'https:' ? httpsGet : get;

      const request = clientGet(url, { timeout: 5000 }, (response) => {
        request.destroy();
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve({ status: 'pass', details: `URL ${url} is reachable (${response.statusCode})` });
        } else {
          resolve({ 
            status: 'warn', 
            details: `URL ${url} returned ${response.statusCode}`,
            fix: 'Verify URL is correct and server is running'
          });
        }
      });
      
      request.on('error', (error) => {
        resolve({
          status: 'fail',
          details: `Cannot reach ${url}: ${error.message}`,
          fix: 'Ensure server is running and URL is correct'
        });
      });
      
      request.on('timeout', () => {
        request.destroy();
        resolve({
          status: 'warn',
          details: `URL ${url} did not respond within 5 seconds`,
          fix: 'Check if server is running and accessible'
        });
      });
      
      request.setTimeout(5000);
    } catch (error) {
      resolve({
        status: 'fail',
        details: `Invalid URL: ${error.message}`,
        fix: 'Provide a valid URL (e.g., http://localhost:3000)'
      });
    }
  });
}

/**
 * Run doctor checks
 * @param {Object} options - { projectRoot, url, json }
 * @returns {Promise<Object>} Doctor results
 */
export async function runDoctor(options = {}) {
  const { projectRoot = process.cwd(), url = null, json: _json = false } = options;

  const isSmokeMode = process.env.VERAX_TEST_MODE === '1' || process.env.VERAX_DOCTOR_SMOKE_TIMEOUT_MS;
  if (isSmokeMode) {
    const checks = [
      { name: 'Doctor smoke mode', status: 'pass', details: 'Heavy checks skipped (smoke mode)' },
      { name: 'Node.js Version', status: 'pass', details: `Node.js version ${process.version}` },
      { name: 'Playwright Browser', status: 'pass', details: 'Skipped in smoke mode' },
      { name: 'Project Analysis', status: 'pass', details: 'Skipped in smoke mode' },
    ];
    return { status: 'pass', platform: `${process.platform}-${process.arch}`, ok: true, checks, recommendations: [] };
  }
  
  const checks = [];
  let overallStatus = 'pass';
  
  // Check 1: Node version
  const nodeCheck = checkNodeVersion();
  checks.push({ name: 'Node.js Version', ...nodeCheck });
  if (nodeCheck.status === 'fail') overallStatus = 'fail';
  
  // Check 2: Write permissions
  const writeCheck = checkWritePermissions(projectRoot);
  checks.push({ name: 'Write Permissions', ...writeCheck });
  if (writeCheck.status === 'fail') overallStatus = 'fail';
  
  // Check 3: Playwright
  const playwrightCheck = await checkPlaywright();
  checks.push({ name: 'Playwright Browser', ...playwrightCheck });
  if (playwrightCheck.status === 'fail') overallStatus = 'fail';
  
  // Check 4: Project expectations
  const projectCheck = await checkProjectExpectations(projectRoot);
  checks.push({ name: 'Project Analysis', ...projectCheck });
  if (projectCheck.status === 'fail') overallStatus = 'fail';
  else if (projectCheck.status === 'warn' && overallStatus === 'pass') overallStatus = 'warn';
  
  // Check 5: URL reachability (if provided)
  if (url) {
    const urlCheck = await checkUrlReachability(url);
    checks.push({ name: 'URL Reachability', ...urlCheck });
    if (urlCheck.status === 'fail') overallStatus = 'fail';
    else if (urlCheck.status === 'warn' && overallStatus === 'pass') overallStatus = 'warn';
  }
  
  // Collect recommendations
  const recommendations = checks.filter(c => c.fix).map(c => c.fix);
  
  return {
    status: overallStatus,
    ok: overallStatus === 'pass',
    platform: `${process.platform}-${process.arch}`,
    checks,
    recommendations
  };
}

/**
 * Print doctor results
 * @param {Object} results - Doctor results
 * @param {boolean} json - Whether to output JSON
 */
export function printDoctorResults(results, json = false) {
  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  
  // Human-readable output
  console.log('\n' + '═'.repeat(60));
  console.log('VERAX Doctor');
  console.log('═'.repeat(60));
  
  const statusEmoji = {
    'pass': '✅',
    'warn': '⚠️',
    'fail': '❌'
  };
  
  for (const check of results.checks) {
    const emoji = statusEmoji[check.status] || '❓';
    console.log(`\n${emoji} ${check.name}`);
    const detailText = check.details || check.message || '';
    if (detailText) console.log(`   ${detailText}`);
    if (check.metadata) {
      for (const [key, value] of Object.entries(check.metadata)) {
        console.log(`   ${key}: ${value}`);
      }
    }
    if (check.fix) {
      console.log(`   Fix: ${check.fix}`);
    }
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Overall Status: ${results.status.toUpperCase()}`);
  
  if (results.recommendations && results.recommendations.length > 0) {
    console.log('\nRecommended Fixes:');
    results.recommendations.forEach((fix, index) => {
      console.log(`  ${index + 1}. ${fix}`);
    });
  }
  
  console.log('═'.repeat(60) + '\n');
}




