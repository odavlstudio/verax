/**
 * Wave 3 — Interactive Wizard
 * 
 * Guides users through VERAX configuration with friendly prompts.
 */

/**
 * @typedef {Object} ReadlineInterface
 * @property {function(string): Promise<string>} question - Prompt user with question
 * @property {function(): void} close - Close the readline interface
 */

/**
 * Create a readline interface (can be injected for testing)
 * @returns {Promise<ReadlineInterface>}
 */
async function createReadlineInterface(input = process.stdin, output = process.stdout) {
  const readline = await import('readline/promises');
  return readline.default.createInterface({
    input,
    output,
    terminal: true
  });
}

/**
 * @typedef {Object} WizardOptions
 * @property {ReadlineInterface} [readlineInterface] - Readline interface (injectable for testing)
 */

/**
 * Run interactive wizard
 * @param {WizardOptions} [options={}] - Options for wizard
 * @returns {Promise<Object>} Wizard results
 */
export async function runWizard(options = {}) {
  const rl = options.readlineInterface || await createReadlineInterface();
  
  try {
    console.log('VERAX — Silent Failure Detection\n');
    console.log('This wizard will guide you through setting up a VERAX scan.\n');
    
    // 1. Mode selection (Wave 7: add init and doctor)
    const modeAnswer = await rl.question('Mode: (s)can, (f)low, (i)nit, or (d)octor? [s]: ');
    const modeInput = (modeAnswer.trim().toLowerCase() || 's');
    let mode;
    if (modeInput.startsWith('i')) {
      mode = 'init';
    } else if (modeInput.startsWith('d')) {
      mode = 'doctor';
    } else if (modeInput.startsWith('f')) {
      mode = 'flow';
    } else {
      mode = 'scan';
    }
    
    // For init and doctor modes, return early
    if (mode === 'init' || mode === 'doctor') {
      return { mode };
    }
    
    // 2. URL
    const urlAnswer = await rl.question('URL to scan [http://localhost:3000]: ');
    let url = urlAnswer.trim();
    if (!url) {
      url = 'http://localhost:3000';
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    
    // 3. Project root (for scan) or flow file (for flow)
    let projectRoot = process.cwd();
    let flowPath = null;
    
    if (mode === 'scan') {
      const projectRootAnswer = await rl.question(`Project root [${projectRoot}]: `);
      if (projectRootAnswer.trim()) {
        projectRoot = projectRootAnswer.trim();
      }
    } else {
      const flowPathAnswer = await rl.question('Flow file path: ');
      flowPath = flowPathAnswer.trim();
      if (!flowPath) {
        throw new Error('Flow file path is required');
      }
    }
    
    // 4. JSON output
    const jsonAnswer = await rl.question('JSON output? (y/N) [N]: ');
    const jsonOutput = (jsonAnswer.trim().toLowerCase() || 'n').startsWith('y');
    
    // 5. Output directory
    const outDirAnswer = await rl.question(`Output directory [.verax/runs]: `);
    const outDir = outDirAnswer.trim() || '.verax/runs';
    
    return {
      mode,
      url,
      projectRoot,
      flowPath,
      json: jsonOutput,
      out: outDir
    };
  } finally {
    rl.close();
  }
}

