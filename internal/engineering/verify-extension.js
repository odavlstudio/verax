#!/usr/bin/env node
// Quarantined internal script — moved from repo root to avoid misleading users.
// This file simulates extension behavior and prints illustrative output only.
// It is NOT a real test and MUST NOT be used to claim readiness.

const path = require('path');

const workspaceRoot = process.cwd();
const GUARDIAN_ARTIFACTS_DIR = '.odavlguardian';

console.log('[internal] Extension verification demo (non-binding)');
console.log(`Workspace Root: ${workspaceRoot}`);
console.log(`Artifacts Dir (Level 1): ${path.join(workspaceRoot, GUARDIAN_ARTIFACTS_DIR)}`);
console.log('This script is for internal development only.');
