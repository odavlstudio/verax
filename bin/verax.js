#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import inquirer from 'inquirer';
import { learn, observe, detect } from '../src/verax/index.js';
import { resolveWorkspaceRoot } from '../src/verax/resolve-workspace-root.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('VERAX\n');

  const args = process.argv.slice(2);
  let projectDir = null;
  let url = null;
  let manifestPath = null;
  
  const projectDirIndex = args.indexOf('--project-dir');
  const projectDirArg = projectDirIndex !== -1 && args[projectDirIndex + 1] ? args[projectDirIndex + 1] : null;
  
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1 && urlIndex + 1 < args.length) {
    url = args[urlIndex + 1];
  }
  
  const manifestIndex = args.indexOf('--manifest');
  if (manifestIndex !== -1 && manifestIndex + 1 < args.length) {
    manifestPath = resolve(args[manifestIndex + 1]);
  }

  // Resolve workspace root using the new function
  try {
    const resolved = resolveWorkspaceRoot(projectDirArg, process.cwd());
    projectDir = resolved.workspaceRoot;
    
    if (resolved.isRepoRoot) {
      console.error(
        'VERAX: Refusing to write artifacts in repository root.\n' +
        'Use --project-dir to specify the target project directory.'
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(2);
  }

  const actions = ['Scan my website'];
  let action;
  
  if (actions.length === 1) {
    action = actions[0];
  } else {
    const result = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: actions,
        default: actions[0]
      }
    ]);
    action = result.action;
  }

  if (action === 'Scan my website') {
    try {
      console.log('Understanding your website...');
      const manifest = await learn(projectDir);
      
      console.log(`\nProject type: ${manifest.projectType}`);
      console.log(`Total routes: ${manifest.routes.length}`);
      console.log(`Public routes: ${manifest.publicRoutes.length}`);
      console.log(`Internal routes: ${manifest.internalRoutes.length}`);
      
      if (url) {
        const { scan } = await import('../src/verax/index.js');
        const result = await scan(projectDir, url, manifestPath);
        const { observation, findings, scanSummary } = result;
        
        console.log('\nObserving real user interactions...');
        console.log('Comparing expectations with reality...');
        
        console.log('\nScan complete.\n');
        console.log(`Total interactions observed: ${observation.traces.length}`);
        console.log(`Silent failures detected: ${findings.findings.length}`);
        
        if (findings.findings.length > 0) {
          console.log(`\nFindings report: ${findings.findingsPath}\n`);
        } else {
          console.log('\nNo silent user failures were detected.');
          console.log(`\nFindings report: ${findings.findingsPath}\n`);
        }
        
        if (scanSummary) {
          const truth = scanSummary.truth;
          console.log('Truth Summary:');
          console.log(`- Learn: routes=${truth.learn.routesDiscovered} (confidence: ${truth.learn.routesConfidence}, source: ${truth.learn.routesSource}), expectations=${truth.learn.expectationsDiscovered} (strong=${truth.learn.expectationsStrong}, weak=${truth.learn.expectationsWeak})`);
          if (truth.learn.validation) {
            console.log(`- Learn validation: validated=${truth.learn.validation.routesValidated}, reachable=${truth.learn.validation.routesReachable}, unreachable=${truth.learn.validation.routesUnreachable}`);
          }
          const coverage = truth.observe.coverage;
          const coverageLine = coverage
            ? `Coverage: selected=${coverage.candidatesSelected}/${coverage.candidatesDiscovered} (cap=${coverage.cap})${coverage.capped ? ' — capped' : ''}`
            : null;
          console.log(`- Observe: interactions=${truth.observe.interactionsObserved}, external-blocked=${truth.observe.externalNavigationBlockedCount}, timeouts=${truth.observe.timeoutsCount}`);
          if (coverageLine) {
            console.log(`  - ${coverageLine}`);
          }
          console.log(`- Detect: analyzed=${truth.detect.interactionsAnalyzed}, skipped(no expectation)=${truth.detect.interactionsSkippedNoExpectation}, findings=${truth.detect.findingsCount}`);
          if (truth.detect.skips && truth.detect.skips.total > 0) {
            const topReasons = truth.detect.skips.reasons.slice(0, 3).map(r => `${r.code}=${r.count}`).join(', ');
            console.log(`- Detect skips: ${truth.detect.skips.total} (top: ${topReasons})`);
          }
          console.log(`- Scan summary: ${scanSummary.summaryPath}\n`);
        }
      } else {
        console.log('\nNote: Provide --url to observe website interactions\n');
      }
      
      process.exit(0);
    } catch (error) {
      console.error(`\nError: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(2);
    }
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(2);
});
