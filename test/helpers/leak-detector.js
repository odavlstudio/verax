/**
 * Leak Detector for Node.js Event Loop Handles
 * 
 * Helps identify handles keeping the process alive after tests complete.
 * Used to debug test hangs and ensure clean process exit.
 */

/**
 * Dump open handles and requests
 * @param {string} label - Context label for the dump
 * @returns {{ handles: any[], requests: any[], filtered: any[] }}
 */
export function dumpOpenHandles(label = 'unknown') {
  const handles = process._getActiveHandles ? process._getActiveHandles() : [];
  const requests = process._getActiveRequests ? process._getActiveRequests() : [];
  
  console.log('\n' + '='.repeat(80));
  console.log(`LEAK DETECTOR: ${label}`);
  console.log('='.repeat(80));
  
  console.log(`\nTotal active handles: ${handles.length}`);
  console.log(`Total active requests: ${requests.length}`);
  
  // Allowlist: handles that are expected and OK
  const allowlist = [
    process.stdout,
    process.stderr,
    process.stdin,
  ];
  
  const filtered = handles.filter(h => !allowlist.includes(h));
  
  console.log(`\nFiltered handles (excluding stdout/stderr/stdin): ${filtered.length}`);
  
  if (filtered.length > 0) {
    console.log('\n--- Open Handles (Potential Leaks) ---');
    filtered.forEach((handle, i) => {
      const constructorName = handle?.constructor?.name || 'Unknown';
      let info = `[${i + 1}] ${constructorName}`;
      
      try {
        // Timeout/Timer info
        if (constructorName === 'Timeout' || constructorName === 'Immediate') {
          if (handle._idleTimeout !== undefined) {
            info += ` (timeout=${handle._idleTimeout}ms)`;
          }
          if (handle._onTimeout) {
            const fnStr = handle._onTimeout.toString().substring(0, 80);
            info += ` fn=${fnStr}`;
          }
        }
        
        // Server info
        if (constructorName === 'Server' && handle.address) {
          try {
            const addr = handle.address();
            info += ` (${addr ? `${addr.address}:${addr.port}` : 'not listening'})`;
          } catch (e) {
            info += ' (address unavailable)';
          }
        }
        
        // Socket info
        if (constructorName === 'Socket' && handle.remoteAddress) {
          info += ` (${handle.remoteAddress}:${handle.remotePort})`;
        }
        
        // FSWatcher info
        if (constructorName === 'FSWatcher' && handle.filename) {
          info += ` (watching: ${handle.filename})`;
        }
        
        // TCP/Pipe info
        if ((constructorName === 'TCP' || constructorName === 'Pipe') && handle.reading !== undefined) {
          info += ` (reading=${handle.reading})`;
        }
      } catch (e) {
        info += ' (error inspecting handle)';
      }
      
      console.log(info);
    });
  }
  
  if (requests.length > 0) {
    console.log('\n--- Active Requests ---');
    requests.forEach((request, i) => {
      const constructorName = request?.constructor?.name || 'Unknown';
      console.log(`[${i + 1}] ${constructorName}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  return {
    handles,
    requests,
    filtered,
  };
}

/**
 * Check for leaks and fail if found
 * @param {string} label - Context label
 * @param {number} maxAllowed - Maximum allowed leaked handles (default 0)
 * @returns {boolean} - true if leaks found
 */
export function checkForLeaks(label = 'leak-check', maxAllowed = 0) {
  const result = dumpOpenHandles(label);
  const leakCount = result.filtered.length;
  
  if (leakCount > maxAllowed) {
    console.error(`\n❌ LEAK DETECTED: ${leakCount} handle(s) leaked (max allowed: ${maxAllowed})`);
    return true;
  } else {
    console.log(`✅ No leaks detected (${leakCount} handles, within limit of ${maxAllowed})`);
    return false;
  }
}
