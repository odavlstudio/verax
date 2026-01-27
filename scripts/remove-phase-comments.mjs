#!/usr/bin/env node
/**
 * Remove PHASE XX vibecoding comments from source files
 * Keeps only substantive logic comments
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function removePhaseComments(content) {
  // Remove standalone PHASE XX comments (entire line)
  let cleaned = content.replace(/^\s*\/\/\s*PHASE\s+\d+[^\n]*\n/gm, '');
  
  // Remove inline PHASE comments  
  cleaned = cleaned.replace(/\s*\/\/\s*PHASE\s+\d+[^\n]*/gm, '');
  
  // Remove multiple consecutive blank lines
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');
  
  return cleaned;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const cleaned = removePhaseComments(content);
    
    if (content !== cleaned) {
      fs.writeFileSync(filePath, cleaned, 'utf-8');
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Error processing ${filePath}:`, e.message);
    return false;
  }
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip future-gates and node_modules
      if (!file.includes('future-gates') && !file.includes('node_modules')) {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith('.js') && !file.includes('.deprecated.')) {
      callback(filePath);
    }
  }
}

let processed = 0;
let modified = 0;

walkDir(srcDir, (filePath) => {
  processed++;
  if (processFile(filePath)) {
    modified++;
    console.log(`✓ Cleaned: ${path.relative(srcDir, filePath)}`);
  }
});

console.log(`\nProcessed ${processed} files, modified ${modified} files`);
