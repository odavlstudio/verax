const fs = require('fs');
const path = require('path');

const PROFILE_PATH = path.join(__dirname, '../../data/guardian-profiles.json');
let cachedProfiles = null;
let cachedMtime = null;

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const url = value.startsWith('http://') || value.startsWith('https://')
      ? new URL(value)
      : new URL(`http://${value}`);
    return url.origin;
  } catch (_err) {
    return null;
  }
}

function loadProfilesFile() {
  try {
    if (!fs.existsSync(PROFILE_PATH)) {
      return [];
    }
    const stat = fs.statSync(PROFILE_PATH);
    if (cachedProfiles && cachedMtime === stat.mtimeMs) {
      return cachedProfiles;
    }
    const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const profiles = [];

    if (Array.isArray(data)) {
      data.forEach((entry) => {
        const origin = normalizeOrigin(entry.origin || entry.site);
        if (!origin || !entry.selectors) return;
        profiles.push({ site: origin, selectors: entry.selectors, navigation: entry.navigation });
      });
    } else if (data && typeof data === 'object') {
      Object.keys(data).forEach((key) => {
        const origin = normalizeOrigin(key);
        if (!origin) return;
        const entry = data[key];
        if (!entry || typeof entry !== 'object') return;
        profiles.push({ site: origin, selectors: entry.selectors || entry, navigation: entry.navigation });
      });
    }

    cachedProfiles = profiles;
    cachedMtime = stat.mtimeMs;
    return profiles;
  } catch (err) {
    console.log(`⚠️  Failed to load profiles: ${err.message}`);
    return [];
  }
}

function resolveProfileForUrl(url) {
  if (!url) return null;
  let origin = null;
  let host = null;
  try {
    const u = new URL(url);
    origin = u.origin;
    host = u.hostname;
  } catch (_err) {
    return null;
  }

  const profiles = loadProfilesFile();
  if (profiles.length === 0) {
    return null;
  }

  const exact = profiles.find((p) => p.site === origin);
  if (exact) return exact;

  const hostMatch = profiles.find((p) => {
    try {
      const u = new URL(p.site);
      if (u.port && u.port !== '80') {
        return u.hostname === host && u.port === (new URL(origin)).port;
      }
      return u.hostname === host;
    } catch {
      return false;
    }
  });

  return hostMatch || null;
}

module.exports = {
  resolveProfileForUrl,
  loadProfilesFile,
};
