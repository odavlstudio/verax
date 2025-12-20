#!/usr/bin/env node
// Sample runs (CLI):
// Runtime: node cli.js "TypeError: Cannot read properties of undefined (reading 'map')"
// Build:   node cli.js "TS2307: Cannot find module 'react' or its corresponding type declarations"
// React:   node cli.js "Error: Too many re-renders. React limits the number of renders to prevent an infinite loop."
// Node:    node cli.js "SyntaxError: Cannot use import statement outside a module"
import { diagnose } from './engine';

function run(): void {
  const input = process.argv.slice(2).join(' ').trim();
  if (!input) {
    console.error('Usage: node cli.js "paste error text"');
    process.exit(1);
  }

  const diagnosis = diagnose(input);
  if (!diagnosis) {
    console.error('No matching signature for provided error.');
    process.exit(2);
  }

  console.log(JSON.stringify(diagnosis, null, 2));
}

run();
