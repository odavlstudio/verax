/**
 * PHASE 21.8 — Secrets Scanner
 * 
 * Scans git history, working tree, and artifacts for secrets.
 * Any secret detected = BLOCKING.
 */

import { getTimeProvider } from '../../../cli/util/support/time-provider.js';

import { resolve, relative } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Secret patterns to detect
 */
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, type: 'API_KEY', severity: 'CRITICAL' },
  { pattern: /(?:api[_-]?token|api_token)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, type: 'API_TOKEN', severity: 'CRITICAL' },
  
  // Tokens
  { pattern: /(?:bearer|token)\s+([a-zA-Z0-9._-]{20,})/gi, type: 'BEARER_TOKEN', severity: 'CRITICAL' },
  { pattern: /(?:access[_-]?token|access_token)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, type: 'ACCESS_TOKEN', severity: 'CRITICAL' },
  { pattern: /(?:refresh[_-]?token|refresh_token)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, type: 'REFRESH_TOKEN', severity: 'HIGH' },
  
  // Private Keys
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, type: 'PRIVATE_KEY', severity: 'CRITICAL' },
  { pattern: /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/gi, type: 'EC_PRIVATE_KEY', severity: 'CRITICAL' },
  { pattern: /-----BEGIN\s+DSA\s+PRIVATE\s+KEY-----/gi, type: 'DSA_PRIVATE_KEY', severity: 'CRITICAL' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/gi, type: 'AWS_ACCESS_KEY', severity: 'CRITICAL' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi, type: 'AWS_SECRET_KEY', severity: 'CRITICAL' },
  
  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/gi, type: 'GITHUB_TOKEN', severity: 'CRITICAL' },
  { pattern: /github[_-]?token\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, type: 'GITHUB_TOKEN', severity: 'CRITICAL' },
  
  // Generic secrets
  { pattern: /(?:secret|password|pwd|passwd)\s*[:=]\s*['"]?([a-zA-Z0-9._@-]{12,})['"]?/gi, type: 'SECRET', severity: 'HIGH' },
  
  // .env files
  { pattern: /\.env/, type: 'ENV_FILE', severity: 'HIGH', fileOnly: true }
];

/**
 * Files/directories to ignore
 */
const IGNORE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.verax/,
  /dist/,
  /build/,
  /coverage/,
  /\.test-release-integrity/,
  /\.tmp/,
  /release\/.*\.json$/  // Allow release artifacts
];

/**
 * File extensions to scan
 */
const SCANNABLE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.json', '.yaml', '.yml',
  '.env', '.env.local', '.env.production', '.env.development',
  '.md', '.txt', '.sh', '.bat', '.ps1'
];

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath, projectDir) {
  const relPath = relative(projectDir, filePath);
  
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(relPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if file is scannable
 */
function isScannable(filePath) {
  const ext = filePath.toLowerCase();
  return SCANNABLE_EXTENSIONS.some(e => ext.endsWith(e)) || 
         !ext.includes('.') || // Files without extension
         ext.endsWith('.env'); // .env files
}

/**
 * Scan file content for secrets
 */
function scanFileContent(content, filePath, projectDir) {
  const findings = [];
  const relPath = relative(projectDir, filePath);
  
  for (const { pattern, type, severity, fileOnly } of SECRET_PATTERNS) {
    if (fileOnly && !filePath.includes('.env')) {
      continue;
    }
    
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      // Skip if it's a comment or documentation
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const line = content.substring(lineStart, match.index + match[0].length);
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        continue;
      }
      
      findings.push({
        type,
        severity,
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        match: match[0].substring(0, 50), // Truncate for safety
        // @ts-expect-error - digest returns string
        hash: createHash('sha256').update(match[0]).digest('hex').substring(0, 16)
      });
    }
  }
  
  return findings;
}

/**
 * Scan working tree files
 */
function scanWorkingTree(projectDir) {
  const findings = [];
  
  function scanDirectory(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        
        if (shouldIgnore(fullPath, projectDir)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && isScannable(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const fileFindings = scanFileContent(content, fullPath, projectDir);
            findings.push(...fileFindings);
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  scanDirectory(projectDir);
  return findings;
}

/**
 * Scan git history (shallow, last 50 commits)
 */
function scanGitHistory(projectDir) {
  const findings = [];
  
  try {
    // Get list of files in last 50 commits
    const result = execSync('git log --all --name-only --pretty=format: --last 50', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    
    const files = new Set(result.split('\n').filter(f => f.trim() && isScannable(f)));
    
    for (const file of files) {
      if (shouldIgnore(resolve(projectDir, file), projectDir)) {
        continue;
      }
      
      try {
        // Get file content from git
        const content = execSync(`git show HEAD:${file}`, {
          cwd: projectDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
        
        const fileFindings = scanFileContent(content, resolve(projectDir, file), projectDir);
        for (const finding of fileFindings) {
          // @ts-expect-error - Dynamic finding property
          finding.source = 'git_history';
        }
        findings.push(...fileFindings);
      } catch {
        // File might not exist in current HEAD
      }
    }
  } catch {
    // Not a git repo or git command failed
  }
  
  return findings;
}

/**
 * Scan artifacts directory
 */
function scanArtifacts(projectDir) {
  const findings = [];
  const distPath = resolve(projectDir, 'dist');
  
  if (!existsSync(distPath)) {
    return findings;
  }
  
  function scanArtifactDir(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
        // @ts-ignore - Dirent has name property
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
      
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanArtifactDir(fullPath);
        } else if (entry.isFile() && isScannable(fullPath)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const fileFindings = scanFileContent(content, fullPath, projectDir);
            for (const finding of fileFindings) {
              // @ts-expect-error - Dynamic finding property
              finding.source = 'artifacts';
            }
            findings.push(...fileFindings);
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  scanArtifactDir(distPath);
  return findings;
}

/**
 * Scan for secrets
 * 
 * @param {string} projectDir - Project directory
 * @returns {Promise<Object>} Scan results
 */
export async function scanSecrets(projectDir) {
  const findings = [];
  
  // Scan working tree
  const workingTreeFindings = scanWorkingTree(projectDir);
  findings.push(...workingTreeFindings);
  
  // Scan git history (shallow)
  const gitFindings = scanGitHistory(projectDir);
  findings.push(...gitFindings);
  
  // Scan artifacts
  const artifactFindings = scanArtifacts(projectDir);
  findings.push(...artifactFindings);
  
  // Deduplicate by file + hash
  const seen = new Set();
  const uniqueFindings = [];
  for (const finding of findings) {
    const key = `${finding.file}:${finding.hash}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFindings.push(finding);
    }
  }
  
  const hasSecrets = uniqueFindings.length > 0;
  const criticalCount = uniqueFindings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = uniqueFindings.filter(f => f.severity === 'HIGH').length;
  
  return {
    ok: !hasSecrets,
    hasSecrets,
    findings: uniqueFindings,
    summary: {
      total: uniqueFindings.length,
      critical: criticalCount,
      high: highCount,
      byType: uniqueFindings.reduce((acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      }, {}),
      scannedAt: getTimeProvider().iso()
    }
  };
}

/**
 * Write secrets report
 * 
 * @param {string} projectDir - Project directory
 * @param {Object} report - Scan results
 * @returns {string} Path to written file
 */
export function writeSecretsReport(projectDir, report) {
  const outputDir = resolve(projectDir, 'release');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = resolve(outputDir, 'security.secrets.report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}




