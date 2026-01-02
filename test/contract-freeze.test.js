// contract-freeze.test.js
// Hard contract freeze: validates all canonical artifacts against frozen schemas
// Fails on any field addition/removal/rename, type change, or required/optional drift

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv').default;
const addFormats = require('ajv-formats');

const SCHEMA_DIR = path.join(__dirname, 'schemas');
const ARTIFACTS = [
  { name: 'evidence', schema: 'evidence.schema.json', glob: ['artifacts/LATEST.json', 'artifacts/latest/**/*.json', 'artifacts/phase3-test-v2/**/*.json', 'artifacts/phase4-golden/**/*.json'] },
  { name: 'narrative', schema: 'narrative.schema.json', glob: ['artifacts/latest/**/*.narrative.json', 'artifacts/phase3-test-v2/**/*.narrative.json', 'artifacts/phase4-golden/**/*.narrative.json'] },
  { name: 'trust', schema: 'trust.schema.json', glob: ['artifacts/latest/**/*.trust.json', 'artifacts/phase3-test-v2/**/*.trust.json', 'artifacts/phase4-golden/**/*.trust.json'] },
  { name: 'trust-summary', schema: 'trust-summary.schema.json', glob: ['artifacts/latest/**/*.trust-summary.json', 'artifacts/phase3-test-v2/**/*.trust-summary.json', 'artifacts/phase4-golden/**/*.trust-summary.json'] }
];

const glob = require('glob');

describe('Guardian Contract Freeze (Schema Hardening)', () => {
  ARTIFACTS.forEach(({ name, schema, glob: patterns }) => {
    const schemaPath = path.join(SCHEMA_DIR, schema);
    const schemaObj = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schemaObj);

    patterns.forEach(pattern => {
      const files = glob.sync(pattern, { absolute: true });
      files.forEach(file => {
        it(`${name} artifact matches schema: ${file.replace(process.cwd(), '')}`, () => {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          const valid = validate(data);
          if (!valid) {
            throw new Error(`Schema validation failed for ${file}:\n` + ajv.errorsText(validate.errors, { separator: '\n' }));
          }
        });
      });
    });
  });
});
