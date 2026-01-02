/**
 * Phase 11: Multi-Site Management
 * Support multiple sites per install with project organization
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SITES_DIR = path.join(os.homedir(), '.odavl-guardian', 'sites');
const SITES_FILE = path.join(SITES_DIR, 'sites.json');

/**
 * Ensure sites directory exists
 */
function ensureSitesDir() {
  if (!fs.existsSync(SITES_DIR)) {
    fs.mkdirSync(SITES_DIR, { recursive: true });
  }
}

/**
 * Get all sites
 */
function getSites() {
  ensureSitesDir();
  
  if (!fs.existsSync(SITES_FILE)) {
    return { sites: [], projects: {} };
  }
  
  try {
    return JSON.parse(fs.readFileSync(SITES_FILE, 'utf-8'));
  } catch (_error) {
    return { sites: [], projects: {} };
  }
}

/**
 * Save sites
 */
function saveSites(data) {
  ensureSitesDir();
  fs.writeFileSync(SITES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Add a site
 */
function addSite(name, url, project = 'default') {
  const data = getSites();
  
  // Check if site name already exists
  const existing = data.sites.find(s => s.name === name);
  if (existing) {
    throw new Error(`Site '${name}' already exists`);
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (_error) {
    throw new Error(`Invalid URL: ${url}`);
  }
  
  const site = {
    name,
    url,
    project,
    addedAt: new Date().toISOString(),
    lastScannedAt: null,
    scanCount: 0,
  };
  
  data.sites.push(site);
  
  // Add to project index
  if (!data.projects[project]) {
    data.projects[project] = [];
  }
  data.projects[project].push(name);
  
  saveSites(data);
  return site;
}

/**
 * Remove a site
 */
function removeSite(name) {
  const data = getSites();
  
  const index = data.sites.findIndex(s => s.name === name);
  if (index === -1) {
    throw new Error(`Site '${name}' not found`);
  }
  
  const site = data.sites[index];
  
  // Remove from sites array
  data.sites.splice(index, 1);
  
  // Remove from project index
  if (data.projects[site.project]) {
    data.projects[site.project] = data.projects[site.project].filter(n => n !== name);
    
    // Clean up empty projects
    if (data.projects[site.project].length === 0) {
      delete data.projects[site.project];
    }
  }
  
  saveSites(data);
  return site;
}

/**
 * Get a site by name
 */
function getSite(name) {
  const data = getSites();
  return data.sites.find(s => s.name === name);
}

/**
 * Update site scan stats
 */
function recordSiteScan(name) {
  const data = getSites();
  
  const site = data.sites.find(s => s.name === name);
  if (!site) {
    return null;
  }
  
  site.lastScannedAt = new Date().toISOString();
  site.scanCount += 1;
  
  saveSites(data);
  return site;
}

/**
 * Get sites by project
 */
function getSitesByProject(project) {
  const data = getSites();
  return data.sites.filter(s => s.project === project);
}

/**
 * List all projects
 */
function listProjects() {
  const data = getSites();
  return Object.keys(data.projects).map(name => ({
    name,
    siteCount: data.projects[name].length,
  }));
}

/**
 * Reset sites (for testing)
 */
function resetSites() {
  if (fs.existsSync(SITES_FILE)) {
    fs.unlinkSync(SITES_FILE);
  }
}

module.exports = {
  addSite,
  removeSite,
  getSite,
  getSites,
  recordSiteScan,
  getSitesByProject,
  listProjects,
  resetSites,
};
