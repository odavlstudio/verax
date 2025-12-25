/**
 * Preset Policy Loader
 * 
 * Load preset policies (startup, saas, enterprise) for easy adoption.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load preset policy by name
 * @param {string} presetName - 'startup', 'saas', or 'enterprise'
 * @returns {object|null} Policy object or null if not found
 */
function loadPreset(presetName) {
  const validPresets = ['startup', 'saas', 'enterprise', 'landing-demo'];
  
  if (!presetName || !validPresets.includes(presetName.toLowerCase())) {
    console.warn(`⚠️  Invalid preset: ${presetName}. Valid presets: ${validPresets.join(', ')}`);
    return null;
  }

  const presetPath = path.join(__dirname, '../../policies', `${presetName.toLowerCase()}.json`);
  
  if (!fs.existsSync(presetPath)) {
    console.error(`⚠️  Preset file not found: ${presetPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(presetPath, 'utf-8');
    const policy = JSON.parse(content);
    
    console.log(`✅ Loaded preset: ${policy.name || presetName}`);
    if (policy.description) {
      console.log(`   ${policy.description}`);
    }
    
    return policy;
  } catch (error) {
    console.error(`⚠️  Failed to load preset ${presetName}: ${error.message}`);
    return null;
  }
}

/**
 * Parse policy option (file path or preset:name)
 * @param {string} policyOption - File path or 'preset:name'
 * @returns {object|null} Policy object or null
 */
function parsePolicyOption(policyOption) {
  // Guard null/undefined
  if (policyOption == null) {
    return null;
  }

  // If a policy object was passed directly, keep legacy behavior (no implicit acceptance)
  // to avoid changing defaults. Only handle string-like inputs safely.
  const optionStr = typeof policyOption === 'string'
    ? policyOption.trim()
    : String(policyOption).trim();

  if (optionStr.length === 0) {
    return null;
  }

  // Check if it's a preset
  if (optionStr.startsWith('preset:')) {
    const presetName = optionStr.substring(7); // Remove 'preset:' prefix
    return loadPreset(presetName);
  }

  // Otherwise, treat as file path
  // Fix for Wave 0.5: Validate policy file exists BEFORE attempting to load
  if (!fs.existsSync(optionStr)) {
    console.error(`Error: Policy file not found: ${optionStr}`);
    console.error('');
    console.error('Please provide a valid policy file or use a preset:');
    console.error('  --policy preset:startup     (Permissive for fast-moving startups)');
    console.error('  --policy preset:saas        (Balanced for SaaS products)');
    console.error('  --policy preset:enterprise  (Strict for enterprise deployments)');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(optionStr, 'utf-8');
    const policy = JSON.parse(content);
    console.log(`✅ Loaded policy from: ${optionStr}`);
    return policy;
  } catch (error) {
    console.error(`Error: Failed to load policy from ${optionStr}: ${error.message}`);
    process.exit(1);
  }
}

/**
 * List available presets
 * @returns {array} Array of preset info objects
 */
function listPresets() {
  const presetsDir = path.join(__dirname, '../../policies');
  
  if (!fs.existsSync(presetsDir)) {
    return [];
  }

  const presets = [];
  const files = fs.readdirSync(presetsDir);
  
  files.forEach(file => {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf-8');
        const policy = JSON.parse(content);
        presets.push({
          name: file.replace('.json', ''),
          displayName: policy.name || file,
          description: policy.description || 'No description',
          policy
        });
      } catch (error) {
        // Skip invalid files
      }
    }
  });

  return presets;
}

/**
 * Print preset list to console
 */
function printPresets() {
  const presets = listPresets();
  
  if (presets.length === 0) {
    console.log('No presets found.');
    return;
  }

  console.log('\n📋 Available Policy Presets:\n');
  presets.forEach(preset => {
    console.log(`  • ${preset.name}`);
    console.log(`    ${preset.description}`);
    console.log(`    Usage: --policy preset:${preset.name}\n`);
  });
}

module.exports = {
  loadPreset,
  parsePolicyOption,
  listPresets,
  printPresets
};
