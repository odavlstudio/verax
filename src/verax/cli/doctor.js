/**
 * Wave 7 — VERAX Doctor
 * 
 * Checks environment, dependencies, and project setup.
 */

import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright';
import { get } from 'http';
import { get as httpsGet } from 'https';
import { learn } from '../index.js';

/**
 * Check Node version
 * @returns {Object} { status: 'ok'|'warn'|'fail', message: string }
 */
function checkNodeVersion() {
  const requiredMajor = 18;
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion >= requiredMajor) {
    return { status: 'ok', message: `Node.js ${nodeVersion} (required: >=${requiredMajor}.0.0)` };
  } else {
    return { 
      status: 'fail', 
      message: `Node.js ${nodeVersion} is too old (required: >=${requiredMajor}.0.0)`,
      fix: `Upgrade Node.js: nvm install ${requiredMajor} or visit nodejs.org`
    };
  }
}

/**
 * Check write permissions to output directory
 * @param {string} projectRoot - Project root
 * @returns {Object} { status: 'ok'|'fail', message: string }
 */
function checkWritePermissions(projectRoot) {
  try {
    const veraxDir = resolve(projectRoot, '.verax');
    mkdirSync(veraxDir, { recursive: true });
    
    const testFile = resolve(veraxDir, '.write-test');
    writeFileSync(testFile, 'test');
    unlinkSync(testFile);
    
    return { status: 'ok', message: 'Can write to .verax directory' };
  } catch (error) {
    return {
      status: 'fail',
      message: `Cannot write to .verax directory: ${error.message}`,
      fix: 'Check file permissions or run with appropriate access'
    };
  }
}

/**
 * Check Playwright availability
 * @returns {Promise<Object>} { status: 'ok'|'fail', message: string }
 */
async function checkPlaywright() {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return { status: 'ok', message: 'Playwright browser is available' };
  } catch (error) {
    // Detect common error messages and provide specific fixes
    const errorMsg = error.message.toLowerCase();
    let fix = 'Run: npx playwright install';
    
    if (errorMsg.includes('chromium') || errorMsg.includes('executable')) {
      fix = 'Run: npx playwright install chromium';
    } else if (errorMsg.includes('missing') || errorMsg.includes('not found')) {
      fix = 'Run: npx playwright install --with-deps chromium';
    }
    
    return {
      status: 'fail',
      message: `Playwright browser not available: ${error.message}`,
      fix: fix
    };
  }
}

/**
 * Check project detection and expectations
 * @param {string} projectRoot - Project root
 * @returns {Promise<Object>} { status: 'ok'|'warn', message: string, details: Object }
 */
async function checkProjectExpectations(projectRoot) {
  try {
    const manifest = await learn(projectRoot);
    const projectType = manifest.projectType || 'unknown';
    const expectationsCount = manifest.learnTruth?.expectationsDiscovered || 0;
    
    if (expectationsCount > 0) {
      return {
        status: 'ok',
        message: `Project type: ${projectType}, ${expectationsCount} expectations found`,
        details: {
          projectType,
          expectationsCount,
          routesCount: manifest.publicRoutes?.length || 0
        }
      };
    } else {
      return {
        status: 'warn',
        message: `Project type: ${projectType}, but 0 expectations found`,
        details: {
          projectType,
          expectationsCount: 0
        },
        fix: 'Add static patterns (HTML links, static fetch calls, or state mutations)'
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Failed to analyze project: ${error.message}`,
      fix: 'Check that projectRoot is correct and project is readable'
    };
  }
}

/**
 * Check URL reachability
 * @param {string} url - URL to check
 * @returns {Promise<Object>} { status: 'ok'|'fail', message: string }
 */
async function checkUrlReachability(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const clientGet = urlObj.protocol === 'https:' ? httpsGet : get;

      const request = clientGet(url, { timeout: 5000 }, (response) => {
        request.destroy();
        if (response.statusCode >= 200 && response.statusCode < 400) {
          resolve({ status: 'ok', message: `URL ${url} is reachable (${response.statusCode})` });
        } else {
          resolve({ 
            status: 'warn', 
            message: `URL ${url} returned ${response.statusCode}`,
            fix: 'Verify URL is correct and server is running'
          });
        }
      });
      
      request.on('error', (error) => {
        resolve({
          status: 'fail',
          message: `Cannot reach ${url}: ${error.message}`,
          fix: 'Ensure server is running and URL is correct'
        });
      });
      
      request.on('timeout', () => {
        request.destroy();
        resolve({
          status: 'warn',
          message: `URL ${url} did not respond within 5 seconds`,
          fix: 'Check if server is running and accessible'
        });
      });
      
      request.setTimeout(5000);
    } catch (error) {
      resolve({
        status: 'fail',
        message: `Invalid URL: ${error.message}`,
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
  
  const checks = [];
  let overallStatus = 'ok';
  
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
  else if (projectCheck.status === 'warn' && overallStatus === 'ok') overallStatus = 'warn';
  
  // Check 5: URL reachability (if provided)
  if (url) {
    const urlCheck = await checkUrlReachability(url);
    checks.push({ name: 'URL Reachability', ...urlCheck });
    if (urlCheck.status === 'fail') overallStatus = 'fail';
    else if (urlCheck.status === 'warn' && overallStatus === 'ok') overallStatus = 'warn';
  }
  
  // Collect fixes
  const fixes = checks.filter(c => c.fix).map(c => c.fix);
  
  return {
    status: overallStatus,
    checks,
    fixes
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
  console.error('\n' + '═'.repeat(60));
  console.error('VERAX Doctor');
  console.error('═'.repeat(60));
  
  const statusEmoji = {
    'ok': '✅',
    'warn': '⚠️',
    'fail': '❌'
  };
  
  for (const check of results.checks) {
    const emoji = statusEmoji[check.status] || '❓';
    console.error(`\n${emoji} ${check.name}`);
    console.error(`   ${check.message}`);
    if (check.details) {
      for (const [key, value] of Object.entries(check.details)) {
        console.error(`   ${key}: ${value}`);
      }
    }
    if (check.fix) {
      console.error(`   Fix: ${check.fix}`);
    }
  }
  
  console.error('\n' + '─'.repeat(60));
  console.error(`Overall Status: ${results.status.toUpperCase()}`);
  
  if (results.fixes.length > 0) {
    console.error('\nRecommended Fixes:');
    results.fixes.forEach((fix, index) => {
      console.error(`  ${index + 1}. ${fix}`);
    });
  }
  
  console.error('═'.repeat(60) + '\n');
}




