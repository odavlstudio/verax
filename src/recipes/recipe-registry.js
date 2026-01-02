/**
 * Phase 12.2: Recipe Registry
 * Local-first registry tracking provenance and integrity of recipes.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const RECIPES_DIR = path.join(os.homedir(), '.odavl-guardian', 'recipes');
const REGISTRY_FILE = path.join(RECIPES_DIR, 'registry.json');

function ensureRecipesDir() {
  if (!fs.existsSync(RECIPES_DIR)) {
    fs.mkdirSync(RECIPES_DIR, { recursive: true });
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(v => stableStringify(v)).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return '{' + entries.join(',') + '}';
}

function computeRecipeChecksum(recipe) {
  const normalized = stableStringify(recipe);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function loadRegistry() {
  ensureRecipesDir();
  if (!fs.existsSync(REGISTRY_FILE)) {
    return { entries: [], updatedAt: null };
  }
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  } catch (_err) {
    return { entries: [], updatedAt: null };
  }
}

function saveRegistry(registry) {
  ensureRecipesDir();
  const data = {
    entries: registry.entries || [],
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function ensureBuiltInRegistry(builtIns) {
  const registry = loadRegistry();
  let changed = false;
  for (const recipe of builtIns) {
    if (!registry.entries.some(e => e.id === recipe.id)) {
      registry.entries.push({
        id: recipe.id,
        name: recipe.name,
        platform: recipe.platform,
        version: recipe.version || '1.0.0',
        source: 'builtin',
        checksum: computeRecipeChecksum(recipe),
        addedAt: new Date().toISOString(),
      });
      changed = true;
    }
  }
  if (changed) {
    saveRegistry(registry);
  }
}

function registerRecipe({ id, name, platform, version, source, checksum }) {
  const registry = loadRegistry();
  const existing = registry.entries.find(e => e.id === id);
  if (existing) {
    Object.assign(existing, { name, platform, version, source, checksum });
  } else {
    registry.entries.push({
      id,
      name,
      platform,
      version: version || '1.0.0',
      source: source || 'imported',
      checksum,
      addedAt: new Date().toISOString(),
    });
  }
  return saveRegistry(registry);
}

function removeRegistryEntry(id) {
  const registry = loadRegistry();
  const next = registry.entries.filter(e => e.id !== id);
  registry.entries = next;
  return saveRegistry(registry);
}

function getRegistryEntry(id) {
  const registry = loadRegistry();
  return registry.entries.find(e => e.id === id);
}

function listRegistryEntries() {
  const registry = loadRegistry();
  return registry.entries;
}

function resetRegistry() {
  ensureRecipesDir();
  if (fs.existsSync(REGISTRY_FILE)) {
    fs.unlinkSync(REGISTRY_FILE);
  }
}

module.exports = {
  computeRecipeChecksum,
  loadRegistry,
  saveRegistry,
  registerRecipe,
  ensureBuiltInRegistry,
  getRegistryEntry,
  listRegistryEntries,
  removeRegistryEntry,
  resetRegistry,
};
