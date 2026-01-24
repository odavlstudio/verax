/**
 * PHASE 21.7 — Provenance Builder (Experimental)
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { VERSION } from '../../../version.js';

async function getGitStatus(projectDir) {
  try {
    const gitDir = resolve(projectDir, '.git');
    if (!existsSync(gitDir)) return { clean: false, commit: null, branch: null };
    const commit = execSync('git rev-parse HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
    const status = execSync('git status --porcelain', { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' });
    const clean = status.trim() === '';
    return { clean, commit, branch };
  } catch { return { clean: false, commit: null, branch: null }; }
}

function getPackageInfo(projectDir) {
  try {
    const pkgPath = resolve(projectDir, 'package.json');
    if (!existsSync(pkgPath)) return { name: 'unknown', version: 'unknown' };
    const pkg = JSON.parse(/** @type {string} */ (readFileSync(pkgPath, 'utf-8')));
    return { name: pkg.name || 'unknown', version: VERSION || 'unknown' };
  } catch { return { name: 'unknown', version: 'unknown' }; }
}

export async function buildProvenance(projectDir) {
  const isTestMode = process.env.VERAX_TEST_MODE === '1' || process.env.NODE_ENV === 'test';
  let gitStatus = await getGitStatus(projectDir);
  if (!isTestMode && !gitStatus.clean) {
    gitStatus = { ...gitStatus, clean: false };
  }
  const _pkg = getPackageInfo(projectDir);
  const env = {
    node: process.version,
    os: process.platform,
    arch: process.arch
  };
  const provenance = {
    version: 1,
    git: { commit: gitStatus.commit, branch: gitStatus.branch, dirty: !gitStatus.clean },
    env,
    policies: { guardrails: 'default', confidence: 'legacy' },
    gaStatus: 'UNKNOWN'
  };
  return provenance;
}

export function writeProvenance(projectDir, provenance) {
  const outDir = resolve(projectDir, 'release');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const path = resolve(outDir, 'release.provenance.json');
  writeFileSync(path, JSON.stringify(provenance, null, 2), 'utf-8');
  return path;
}
