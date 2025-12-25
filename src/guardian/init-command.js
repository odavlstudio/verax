/**
 * Init Command
 * 
 * One-command onboarding: `guardian init`
 * Creates policy file, .gitignore, and prints next steps.
 */

const fs = require('fs');
const path = require('path');

/**
 * Initialize Guardian in current directory
 * @param {object} options - Init options
 * @returns {object} Result with created files
 */
function initGuardian(options = {}) {
  const cwd = options.cwd || process.cwd();
  const policyPreset = options.preset || 'startup';
  
  const result = {
    created: [],
    updated: [],
    errors: []
  };

  console.log('\n🛡️  Initializing Guardian...\n');

  // 1. Create policy file
  try {
    const configDir = path.join(cwd, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const policyPath = path.join(configDir, 'guardian.policy.json');
    
    if (fs.existsSync(policyPath)) {
      console.log('⚠️  config/guardian.policy.json already exists. Skipping.');
    } else {
      // Load preset
      const presetsDir = path.join(__dirname, '../../policies');
      const presetPath = path.join(presetsDir, `${policyPreset}.json`);
      
      let policyContent;
      if (fs.existsSync(presetPath)) {
        policyContent = fs.readFileSync(presetPath, 'utf-8');
      } else {
        // Fallback to default
        policyContent = JSON.stringify({
          name: 'Default Policy',
          description: 'Default Guardian policy',
          failOnSeverity: 'CRITICAL',
          maxWarnings: 999,
          maxInfo: 999,
          maxTotalRisk: 999,
          failOnNewRegression: false,
          failOnSoftFailures: false,
          softFailureThreshold: 999,
          requireBaseline: false
        }, null, 2);
      }

      fs.writeFileSync(policyPath, policyContent, 'utf-8');
      result.created.push('config/guardian.policy.json');
      console.log('✅ Created config/guardian.policy.json');
    }
  } catch (error) {
    result.errors.push(`Failed to create policy: ${error.message}`);
    console.error(`❌ Failed to create policy: ${error.message}`);
  }

  // 2. Update .gitignore
  try {
    const gitignorePath = path.join(cwd, '.gitignore');
    const guardianIgnores = [
      '# Guardian artifacts',
      'artifacts/',
      'test-artifacts/',
      '.odavl-guardian/',
      'tmp-artifacts/'
    ].join('\n');

    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('Guardian artifacts')) {
        fs.appendFileSync(gitignorePath, '\n' + guardianIgnores + '\n');
        result.updated.push('.gitignore');
        console.log('✅ Updated .gitignore');
      } else {
        console.log('⚠️  .gitignore already has Guardian entries. Skipping.');
      }
    } else {
      fs.writeFileSync(gitignorePath, guardianIgnores + '\n', 'utf-8');
      result.created.push('.gitignore');
      console.log('✅ Created .gitignore');
    }
  } catch (error) {
    result.errors.push(`Failed to update .gitignore: ${error.message}`);
    console.error(`❌ Failed to update .gitignore: ${error.message}`);
  }

  // 3. Print next steps
  console.log('\n━'.repeat(60));
  console.log('✅ Guardian initialized successfully!\n');
  console.log('📝 Next steps:\n');
  console.log('  1. Run Guardian:');
  console.log('     npm start -- --url https://your-site.com\n');
  console.log('  2. Or use the protect shortcut:');
  console.log('     npm start -- protect https://your-site.com\n');
  console.log('  3. Review the generated report:');
  console.log('     Check artifacts/ directory\n');
  console.log('  4. Customize policy:');
    console.log('     Edit config/guardian.policy.json\n');
  console.log('  5. Integrate with CI/CD:');
  console.log('     Use .github/workflows/guardian.yml as template\n');
  console.log('━'.repeat(60) + '\n');

  return result;
}

/**
 * Detect project type
 * @param {string} cwd - Current working directory
 * @returns {string} Project type: 'node', 'empty', 'unknown'
 */
function detectProjectType(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    return 'node';
  }

  const files = fs.readdirSync(cwd);
  if (files.length === 0) {
    return 'empty';
  }

  return 'unknown';
}

module.exports = {
  initGuardian,
  detectProjectType
};
