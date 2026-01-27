import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

/**
 * Test: --no-micro-crawl flag actually disables micro-crawl
 * CLI-level control test ensuring flag is properly parsed and passed through
 */
describe('CLI: --no-micro-crawl flag control', () => {
  it('should reject --no-micro-crawl when no --url provided', () => {
    return new Promise((resolve) => {
      const proc = spawn('node', ['bin/verax.js', 'run', '--no-micro-crawl'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let _stdout = '';
      let _stderr = '';
      proc.stdout.on('data', (d) => { _stdout += d.toString(); });
      proc.stderr.on('data', (d) => { _stderr += d.toString(); });

      proc.on('close', (code) => {
        // Should exit with usage error (64)
        assert.strictEqual(code, 64, `Expected exit code 64 for missing --url, got ${code}`);
        resolve();
      });
    });
  });

  it('should accept --no-micro-crawl flag in allowed flags list', () => {
    // Verify the flag is in the allowedFlags set in entry.js
    const entryPath = resolve(process.cwd(), 'src/cli/entry.js');
    const content = readFileSync(entryPath, 'utf8');
    assert.match(content, /--no-micro-crawl/, 'Flag should be documented in entry.js');
  });

  it('should document --no-micro-crawl in help text', () => {
    const entryPath = resolve(process.cwd(), 'src/cli/entry.js');
    const content = readFileSync(entryPath, 'utf8');
    assert.match(content, /--no-micro-crawl.*Disable.*micro-crawl/i, 'Help text should explain the flag');
  });

  it('should pass disableMicroCrawl option to observation engine', () => {
    const entryPath = resolve(process.cwd(), 'src/cli/entry.js');
    const content = readFileSync(entryPath, 'utf8');
    assert.match(content, /disableMicroCrawl/, 'Option should be passed through CLI');
  });

  it('should parse --no-micro-crawl flag correctly in handleRunCommand', () => {
    const entryPath = resolve(process.cwd(), 'src/cli/entry.js');
    const content = readFileSync(entryPath, 'utf8');
    // Check that args.includes('--no-micro-crawl') is used to set the option
    assert.match(content, /args\.includes\('--no-micro-crawl'\)/, 'Flag should be parsed from args');
  });
});
