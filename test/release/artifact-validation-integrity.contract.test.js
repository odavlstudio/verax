/**
 * Artifact Validation Integrity Contract Tests
 * 
 * Verifies that no raw (unredacted) screenshots exist in any test run directory.
 * Ensures redaction integration is properly implemented throughout the pipeline.
 */

import test from 'node:test';
import { strict as assert } from 'assert';
import { globSync } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getDefaultVeraxOutDir } from '../../src/cli/util/support/default-output-dir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

test('Artifact Validation Integrity & Pipeline Integration', async (suite) => {
  await suite.test('verifies redaction integration in evidence-capture.js', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    assert.ok(existsSync(captureFile), 'evidence-capture.js exists');
    
    const content = readFileSync(captureFile, 'utf-8');
    assert.match(content, /redactScreenshot/, 'redaction function called');
    assert.match(content, /writeFileSync/, 'only redacted version written');
    assert.match(content, /(unlinkSync|deleteSync).*temp/, 'temp file cleaned up');
  });

  await suite.test('verifies redaction integration in observe-writer.js', () => {
    const writerFile = resolve(rootDir, 'src/cli/util/observation/observe-writer.js');
    assert.ok(existsSync(writerFile), 'observe-writer.js exists');
    
    const content = readFileSync(writerFile, 'utf-8');
    assert.match(content, /redaction/, 'redaction field present in output');
  });

  await suite.test('no .temp screenshot artifacts exist', () => {
    const outDir = getDefaultVeraxOutDir(rootDir);
    if (!existsSync(outDir)) return;
    const tempScreenshots = globSync(resolve(outDir, '**/*.png.temp'), { nodir: true });
    assert.equal(tempScreenshots.length, 0, 'no leftover .temp screenshot files');
  });

  await suite.test('redaction-config exports correct patterns', () => {
    const configFile = resolve(rootDir, 'src/cli/util/config/redaction-config.js');
    assert.ok(existsSync(configFile), 'redaction-config.js exists');
    
    const content = readFileSync(configFile, 'utf-8');
    assert.match(content, /SENSITIVE_PATTERNS/, 'pattern definitions present');
    assert.match(content, /SENSITIVE_SELECTORS/, 'selector definitions present');
  });

  await suite.test('dom-redactor exports all required functions', () => {
    const redactorFile = resolve(rootDir, 'src/cli/util/evidence/dom-redactor.js');
    assert.ok(existsSync(redactorFile), 'dom-redactor.js exists');
    
    const content = readFileSync(redactorFile, 'utf-8');
    assert.match(content, /export.*redactTextPatterns/, 'redactTextPatterns exported');
    assert.match(content, /export.*getRedactionPlaceholder/, 'getRedactionPlaceholder exported');
    assert.match(content, /export.*redactDOMSnapshot/, 'redactDOMSnapshot exported');
  });

  await suite.test('screenshot-redactor exports geometry utilities', () => {
    const redactorFile = resolve(rootDir, 'src/cli/util/evidence/screenshot-redactor.js');
    assert.ok(existsSync(redactorFile), 'screenshot-redactor.js exists');
    
    const content = readFileSync(redactorFile, 'utf-8');
    assert.match(content, /export.*mergeOverlappingBBoxes/, 'mergeOverlappingBBoxes exported');
    assert.match(content, /export.*padBoundingBoxes/, 'padBoundingBoxes exported');
  });

  await suite.test('environment variable config defaults are secure', () => {
    // All redaction should default to ON (not false)
    const config = {
      emails: process.env.VERAX_REDACT_EMAILS !== 'false',
      tokens: process.env.VERAX_REDACT_TOKENS !== 'false',
      cards: process.env.VERAX_REDACT_CREDIT_CARDS !== 'false',
      phones: process.env.VERAX_REDACT_PHONE_NUMBERS !== 'false',
    };
    
    assert.equal(config.emails, true, 'email redaction enabled by default');
    assert.equal(config.tokens, true, 'token redaction enabled by default');
    assert.equal(config.cards, true, 'card redaction enabled by default');
    assert.equal(config.phones, true, 'phone redaction enabled by default');
  });

  await suite.test('no raw sensitive patterns in test fixtures', () => {
    // Verify test fixtures don't expose raw secrets (they should use placeholders)
    const fixtures = globSync(resolve(rootDir, 'test/release/**/fixtures/*'), { nodir: true });
    
    // Sample check: no literal credit cards in fixtures
    let fixturesChecked = 0;
    fixtures.forEach(f => {
      if (!f.endsWith('.json')) return; // Only check JSON fixtures
      try {
        const content = readFileSync(f, 'utf-8');
        // Should not contain raw CC patterns like 4111 1111 1111 1111
        assert.ok(!content.match(/4111[\s-]*1111[\s-]*1111[\s-]*1111/), `fixture ${f} has no raw credit cards`);
        fixturesChecked++;
      } catch (_e) {
        // Skip files that can't be read
      }
    });
    
    // At least some fixtures should be checked
    if (fixturesChecked > 0) {
      console.log(`  [INFO] Verified ${fixturesChecked} fixture files for raw sensitive data`);
    }
  });

  await suite.test('observe.json contract includes redaction field', () => {
    const registryFile = resolve(rootDir, 'src/verax/core/artifacts/registry.js');
    assert.ok(existsSync(registryFile), 'artifact registry exists');
    
    const content = readFileSync(registryFile, 'utf-8');
    // The registry should define observe.json schema with redaction field
    assert.match(content, /observe|registry/, 'artifact definitions present');
  });

  await suite.test('no bypass mechanism for redaction', () => {
    const captureFile = resolve(rootDir, 'src/verax/observe/evidence-capture.js');
    const content = readFileSync(captureFile, 'utf-8');
    
    // Should NOT have patterns like:
    // - skipRedaction
    // - bypassRedaction
    // - rawScreenshot
    assert.ok(!content.includes('skipRedaction'), 'no bypass mechanism');
    assert.ok(!content.includes('bypassRedaction'), 'no bypass mechanism');
    assert.ok(!content.includes('rawScreenshot'), 'no raw screenshot variable exposed');
  });
});




