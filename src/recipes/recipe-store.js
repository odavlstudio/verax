/**
 * Phase 12.1: Recipe Store
 * Manage built-in and custom recipes
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateRecipe } = require('./recipe-engine');
const {
  registerRecipe,
  ensureBuiltInRegistry,
  computeRecipeChecksum,
  getRegistryEntry,
  removeRegistryEntry,
} = require('./recipe-registry');

const RECIPES_DIR = path.join(os.homedir(), '.odavl-guardian', 'recipes');
const CUSTOM_RECIPES_FILE = path.join(RECIPES_DIR, 'custom.json');

// Built-in recipes
const BUILT_IN_RECIPES = [
  {
    id: 'shopify-checkout',
    name: 'Shopify Checkout Flow',
    platform: 'shopify',
    version: '1.0.0',
    intent: 'Complete a customer checkout to verify payment processing',
    steps: [
      'Navigate to product page',
      'Add item to cart',
      'Open cart',
      'Proceed to checkout',
      'Fill shipping address',
      'Select shipping method',
      'Enter payment information',
      'Complete purchase'
    ],
    expectedGoal: 'Order confirmation page loads with order number',
    notes: 'Assumes public storefront with at least one product available'
  },
  {
    id: 'saas-signup',
    name: 'SaaS Signup Flow',
    platform: 'saas',
    version: '1.0.0',
    intent: 'Create new account to verify user onboarding',
    steps: [
      'Navigate to signup page',
      'Fill email address',
      'Create password',
      'Accept terms',
      'Submit signup form',
      'Verify email verification sent',
      'Complete email verification',
      'Access dashboard'
    ],
    expectedGoal: 'User lands on authenticated dashboard or onboarding',
    notes: 'May require temporary email or mock SMTP setup for verification'
  },
  {
    id: 'landing-contact',
    name: 'Landing Page Contact Form',
    platform: 'landing',
    version: '1.0.0',
    intent: 'Submit contact form to verify lead capture',
    steps: [
      'Navigate to landing page',
      'Locate contact form',
      'Enter name',
      'Enter email',
      'Enter message',
      'Submit form',
      'Verify success message',
      'Check form was cleared'
    ],
    expectedGoal: 'Success message displays and form resets',
    notes: 'No email sending required, tests frontend only'
  }
];

/**
 * Ensure recipes directory exists
 */
function ensureRecipesDir() {
  if (!fs.existsSync(RECIPES_DIR)) {
    fs.mkdirSync(RECIPES_DIR, { recursive: true });
  }
}

/**
 * Get all recipes (built-in + custom)
 */
function getAllRecipes() {
  ensureBuiltInRegistry(BUILT_IN_RECIPES);
  const recipes = [...BUILT_IN_RECIPES];
  
  const customRecipes = getCustomRecipes();
  recipes.push(...customRecipes);
  
  return recipes;
}

/**
 * Get recipe by ID
 */
function getRecipe(id) {
  // Check built-in first
  const builtIn = BUILT_IN_RECIPES.find(r => r.id === id);
  if (builtIn) return builtIn;
  
  // Check custom
  const custom = getCustomRecipes();
  return custom.find(r => r.id === id);
}

/**
 * Get recipes by platform
 */
function getRecipesByPlatform(platform) {
  return getAllRecipes().filter(r => r.platform === platform);
}

/**
 * Get custom recipes
 */
function getCustomRecipes() {
  ensureRecipesDir();
  
  if (!fs.existsSync(CUSTOM_RECIPES_FILE)) {
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(CUSTOM_RECIPES_FILE, 'utf-8'));
    return data.recipes || [];
  } catch (_error) {
    return [];
  }
}

/**
 * Save custom recipes
 */
function saveCustomRecipes(recipes) {
  ensureRecipesDir();
  
  const data = { recipes, updatedAt: new Date().toISOString() };
  fs.writeFileSync(CUSTOM_RECIPES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Add custom recipe
 */
function addRecipe(recipe) {
  // Validate
  const validation = validateRecipe(recipe);
  if (!validation.valid) {
    throw new Error(`Invalid recipe: ${validation.errors.join(', ')}`);
  }
  if (!recipe.version) {
    recipe.version = '1.0.0';
  }
  
  // Check for duplicates
  const existing = getRecipe(recipe.id);
  if (existing) {
    throw new Error(`Recipe with id '${recipe.id}' already exists`);
  }
  
  // Add to custom recipes
  const customs = getCustomRecipes();
  customs.push(recipe);
  saveCustomRecipes(customs);
  registerRecipe({
    id: recipe.id,
    name: recipe.name,
    platform: recipe.platform,
    version: recipe.version,
    source: 'imported',
    checksum: computeRecipeChecksum(recipe),
  });
  
  return recipe;
}

/**
 * Remove custom recipe
 */
function removeRecipe(id) {
  // Can't remove built-in
  if (BUILT_IN_RECIPES.find(r => r.id === id)) {
    throw new Error(`Cannot remove built-in recipe: ${id}`);
  }
  
  const customs = getCustomRecipes();
  const index = customs.findIndex(r => r.id === id);
  
  if (index === -1) {
    throw new Error(`Recipe not found: ${id}`);
  }
  
  const recipe = customs[index];
  customs.splice(index, 1);
  saveCustomRecipes(customs);
  removeRegistryEntry(id);
  
  return recipe;
}

function replaceCustomRecipe(recipe) {
  const customs = getCustomRecipes();
  const index = customs.findIndex(r => r.id === recipe.id);
  if (index === -1) {
    customs.push(recipe);
  } else {
    customs[index] = recipe;
  }
  saveCustomRecipes(customs);
}

/**
 * Import recipes from file
 */
function importRecipes(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Invalid JSON in file: ${error.message}`);
  }
  
  const recipes = Array.isArray(data) ? data : data.recipes || [];
  
  if (!Array.isArray(recipes)) {
    throw new Error('File must contain array of recipes or object with "recipes" array');
  }
  
  const imported = [];
  const errors = [];
  
  for (const recipe of recipes) {
    try {
      // Skip if already exists
      if (getRecipe(recipe.id)) {
        errors.push(`${recipe.id}: Already exists (skipped)`);
        continue;
      }
      
      // Validate
      const validation = validateRecipe(recipe);
      if (!validation.valid) {
        errors.push(`${recipe.id}: ${validation.errors.join(', ')}`);
        continue;
      }
      
      // Add to customs
      const customs = getCustomRecipes();
      customs.push(recipe);
      saveCustomRecipes(customs);

      registerRecipe({
        id: recipe.id,
        name: recipe.name,
        platform: recipe.platform,
        version: recipe.version || '1.0.0',
        source: 'imported',
        checksum: computeRecipeChecksum(recipe),
      });
      
      imported.push(recipe.id);
    } catch (error) {
      errors.push(`${recipe.id}: ${error.message}`);
    }
  }
  
  return {
    imported,
    errors,
    count: imported.length
  };
}

function importRecipeWithMetadata(filePath, options = {}) {
  const { force = false } = options;
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    throw new Error(`Invalid JSON in file: ${error.message}`);
  }

  // Support Phase 12.1 format (array) for backwards compatibility
  const recipe = data.recipe || (Array.isArray(data.recipes) ? data.recipes[0] : data);
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Import file must include a recipe object');
  }

  const validation = validateRecipe(recipe);
  if (!validation.valid) {
    throw new Error(`Invalid recipe: ${validation.errors.join(', ')}`);
  }

  if (!recipe.version) {
    recipe.version = data.version || '1.0.0';
  }

  const checksum = computeRecipeChecksum(recipe);
  if (data.checksum && data.checksum !== checksum) {
    console.warn(`Warning: checksum mismatch for recipe ${recipe.id}. Expected ${data.checksum}, got ${checksum}.`);
  }

  const existing = getRecipe(recipe.id);
  if (existing) {
    const isBuiltIn = BUILT_IN_RECIPES.some(r => r.id === recipe.id);
    if (isBuiltIn) {
      throw new Error(`Recipe '${recipe.id}' is built-in and cannot be overwritten.`);
    }
    if (!force) {
      throw new Error(`Recipe '${recipe.id}' already exists. Use --force to overwrite.`);
    }
  }

  replaceCustomRecipe(recipe);
  registerRecipe({
    id: recipe.id,
    name: recipe.name,
    platform: recipe.platform,
    version: recipe.version,
    source: 'imported',
    checksum,
  });

  return { recipe, checksum };
}

/**
 * Export recipes
 */
function exportRecipes(ids, outputPath) {
  const recipes = ids.map(id => {
    const recipe = getRecipe(id);
    if (!recipe) {
      throw new Error(`Recipe not found: ${id}`);
    }
    return recipe;
  });
  
  const data = {
    exportedAt: new Date().toISOString(),
    count: recipes.length,
    recipes
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

function exportRecipeWithMetadata(id, outputPath) {
  const recipe = getRecipe(id);
  if (!recipe) {
    throw new Error(`Recipe not found: ${id}`);
  }

  const checksum = computeRecipeChecksum(recipe);
  const payload = {
    id: recipe.id,
    name: recipe.name,
    platform: recipe.platform,
    version: recipe.version || '1.0.0',
    checksum,
    exportedAt: new Date().toISOString(),
    recipe,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

/**
 * Reset custom recipes (for testing)
 */
function resetCustomRecipes() {
  if (fs.existsSync(CUSTOM_RECIPES_FILE)) {
    fs.unlinkSync(CUSTOM_RECIPES_FILE);
  }
}

module.exports = {
  getAllRecipes,
  getRecipe,
  getRecipesByPlatform,
  getCustomRecipes,
  addRecipe,
  removeRecipe,
  importRecipes,
  exportRecipes,
  exportRecipeWithMetadata,
  importRecipeWithMetadata,
  resetCustomRecipes,
  BUILT_IN_RECIPES
};
