import { resolve } from 'path';
import { loadAuthCookiesSource, loadAuthStorage, parseAuthHeader, validateAuthConfig } from './auth-utils.js';

/**
 * Normalize CLI auth inputs into a single configuration object with validation.
 * Returns { authConfig, errors } so callers can surface UsageError (exit 64) early.
 */
export function buildAuthConfig({ authStorage, authCookiesArgs = [], authHeadersArgs = [], authMode = 'auto', cwd = process.cwd() }) {
  const errors = [];
  const cookies = [];
  const headers = [];
  const mode = authMode || 'auto';

  let storageState = null;
  let storagePath = null;
  if (authStorage) {
    storagePath = resolve(cwd, authStorage);
    const storage = loadAuthStorage(storagePath);
    if (storage.error) {
      errors.push(storage.error);
    } else {
      storageState = storage;
    }
  }

  for (const source of authCookiesArgs) {
    const parsed = loadAuthCookiesSource(source, cwd);
    if (parsed.error) {
      errors.push(parsed.error);
    } else if (parsed.cookies && parsed.cookies.length) {
      cookies.push(...parsed.cookies);
    }
  }

  for (const headerStr of authHeadersArgs) {
    const parsed = parseAuthHeader(headerStr);
    if (parsed.error) {
      errors.push(`Invalid header: ${parsed.error}`);
    } else {
      headers.push({ name: parsed.name, value: parsed.value });
    }
  }

  const validation = validateAuthConfig({ authStorage: storagePath, authCookies: cookies, authMode: mode });
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  return {
    authConfig: {
      authStorage: storagePath,
      authStorageState: storageState,
      authCookies: cookies,
      authHeaders: headers,
      authMode: mode,
    },
    errors,
  };
}

export function hasAuthInput(authConfig = {}) {
  return Boolean(authConfig.authStorage || (authConfig.authCookies && authConfig.authCookies.length) || (authConfig.authHeaders && authConfig.authHeaders.length));
}
