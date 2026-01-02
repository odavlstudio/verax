const EMAIL_REGEX = /([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const TOKEN_REGEX = /\b[A-Za-z0-9\-_]{20,}\b/g;
const PASSWORD_QUERY_REGEX = /(password|pwd)=([^&\s]+)/gi;

function maskEmail(value) {
  return value.replace(EMAIL_REGEX, (_, first, _rest, domain) => `${first}***${domain}`);
}

function sanitizeString(value, keyPath) {
  EMAIL_REGEX.lastIndex = 0;
  TOKEN_REGEX.lastIndex = 0;
  PASSWORD_QUERY_REGEX.lastIndex = 0;
  const lowerKey = (keyPath || '').toLowerCase();

  if (lowerKey.includes('password') || lowerKey.includes('pwd')) {
    return '******';
  }
  if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
    return '****';
  }

  let sanitized = value;
  sanitized = sanitized.replace(PASSWORD_QUERY_REGEX, (_match, key) => `${key}=******`);
  if (EMAIL_REGEX.test(sanitized)) {
    sanitized = maskEmail(sanitized);
  }
  sanitized = sanitized.replace(TOKEN_REGEX, '****');
  return sanitized;
}

function sanitizeArtifact(input, keyPath = '') {
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return sanitizeString(input, keyPath);
  }

  if (typeof input !== 'object') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item, idx) => sanitizeArtifact(item, `${keyPath}[${idx}]`));
  }

  const result = {};
  for (const [key, value] of Object.entries(input)) {
    const childPath = keyPath ? `${keyPath}.${key}` : key;
    result[key] = sanitizeArtifact(value, childPath);
  }
  return result;
}

module.exports = {
  sanitizeArtifact
};
