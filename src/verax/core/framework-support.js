/**
 * Framework Surface Contract
 * Single source of truth for supported frameworks and their stability modes.
 */
export const SUPPORTED_FRAMEWORKS = {
  react_spa: { id: 'react_spa', display: 'React', status: 'supported', modes: ['dev', 'prod'] },
  nextjs_app_router: { id: 'nextjs_app_router', display: 'Next.js (App Router)', status: 'supported', modes: ['dev', 'prod'] },
  nextjs_pages_router: { id: 'nextjs_pages_router', display: 'Next.js (Pages Router)', status: 'supported', modes: ['dev', 'prod'] },
  static: { id: 'static', display: 'Static HTML', status: 'supported', modes: ['static'] }
};

export function evaluateFrameworkSupport(projectType) {
  if (!projectType) {
    return {
      id: 'unknown',
      status: 'unsupported',
      mode: 'unknown',
      warning: 'Framework could not be detected; treating as unsupported to avoid false confidence'
    };
  }

  const normalized = String(projectType).toLowerCase();
  const hit = Object.values(SUPPORTED_FRAMEWORKS).find(f => f.id === normalized || normalized.includes(f.id.replace('_', '')) || normalized === f.display.toLowerCase());
  if (hit) {
    return {
      id: hit.id,
      status: hit.status,
      mode: hit.modes.includes('dev') ? 'dev_or_prod' : hit.modes[0],
      warning: null
    };
  }

  return {
    id: normalized,
    status: 'unsupported',
    mode: 'unknown',
    warning: `Framework ${projectType} is outside VERAX supported envelope (React, Next.js, Static HTML)`
  };
}

export function isFrameworkSupported(projectType) {
  return evaluateFrameworkSupport(projectType).status === 'supported';
}
