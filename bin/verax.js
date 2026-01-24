#!/usr/bin/env node

/**
 * VERAX CLI Shim
 * Delegates to src/cli/entry.js
 */

import('../src/cli/entry.js').catch((error) => {
  console.error(`Failed to load CLI: ${error.message}`);
  process.exit(2);
});




