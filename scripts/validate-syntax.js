#!/usr/bin/env node
/**
 * Lightweight syntax validator for JavaScript files
 * Catches parse errors without full type checking overhead
 */

const fs = require('fs');
const path = require('path');
const { parseSync } = require('@babel/core');

const dirs = ['bin', 'src'];
let errors = 0;

console.log('Validating JavaScript syntax...\n');

for (const dir of dirs) {
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) {
    console.warn(`⚠ Directory not found: ${dir}`);
    continue;
  }

  const files = getAllJsFiles(fullDir);
  console.log(`Checking ${files.length} files in ${dir}/...`);

  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      parseSync(code, {
        filename: file,
        parserOpts: {
          sourceType: 'unambiguous',
          plugins: []
        }
      });
    } catch (err) {
      errors++;
      console.error(`\n✗ ${path.relative(process.cwd(), file)}`);
      console.error(`  ${err.message}`);
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ Found ${errors} syntax error(s)\n`);
  process.exit(1);
} else {
  console.log(`\n✓ All files have valid JavaScript syntax\n`);
  process.exit(0);
}

function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}
