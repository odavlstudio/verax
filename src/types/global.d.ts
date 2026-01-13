/**
 * Global type declarations for VERAX
 * These extend built-in types to support runtime-injected properties
 */

// Extend Window interface for browser-injected properties
declare global {
  interface Window {
    __veraxNavTracking?: any;
    next?: any;
    __REDUX_STORE__?: any;
    store?: any;
    __REDUX_DEVTOOLS_EXTENSION__?: any;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any;
    __VERAX_STATE_SENSOR__?: any;
    __unhandledRejections?: any[];
    __ZUSTAND_STORE__?: any;
  }
}

// Playwright Page type (imported from playwright)
import type { Page as PlaywrightPage } from 'playwright';

// Re-export for use in JS files
export type Page = PlaywrightPage;

export {};

