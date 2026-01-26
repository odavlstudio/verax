/**
 * Human Behavior Driver v1
 * Deterministic, safe, human-like interaction executor for observation.
 */

import { getTimeProvider } from '../../cli/util/support/time-provider.js';
import { waitForSettle } from './wait-for-settle.js';
import { DEFAULT_SCAN_BUDGET } from '../shared/scan-budget.js';
import { RUNTIME_STABILITY_CONTRACT } from '../core/runtime-stability-contract.js';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const DEFAULT_SCROLL_STEPS = 5;
const DEFAULT_SCROLL_PAUSE_MS = 400;
const HOVER_MS = 120;
const FOCUS_PAUSE_MS = 40;
const CLICK_TIMEOUT_MS = 2000;
const POST_ACTION_TIMEOUT_MS = 1500; // Keep post-action waits short for fast coverage
const FORM_RETRY_LIMIT = RUNTIME_STABILITY_CONTRACT.maxRetriesPerInteraction;
const SAFE_INPUT_TYPES = ['text', 'email', 'password', 'number', 'textarea'];
const DANGEROUS_KEYWORDS = ['delete', 'drop', 'destroy', 'payment', 'card', 'checkout', 'billing'];
const DEFAULT_UPLOAD_CONTENT = 'verax-upload-fixture';
const DEFAULT_UPLOAD_NAME = 'verax-upload.txt';

const DUMMY_VALUES = {
  text: 'verax-user',
  email: 'verax@example.com',
  password: 'VeraxPass123!',
  number: '7',
  textarea: 'verax message'
};

export class HumanBehaviorDriver {
  constructor(options = {}, scanBudget = DEFAULT_SCAN_BUDGET) {
    this.maxScrollSteps = options.maxScrollSteps || DEFAULT_SCROLL_STEPS;
    this.scrollPauseMs = options.scrollPauseMs || DEFAULT_SCROLL_PAUSE_MS;
    this.postActionTimeoutMs = options.postActionTimeoutMs || POST_ACTION_TIMEOUT_MS;
    this.scanBudget = scanBudget;
    this.interactionBudgetPerPage = options.interactionBudgetPerPage || 20;
  }

  async discoverInteractionsWithScroll(page) {
    const discovered = new Map();

    await this.captureElements(page, discovered);

    const maxScrollDistance = await page.evaluate(() => document.documentElement.scrollHeight || 0);
    for (let step = 0; step < this.maxScrollSteps; step++) {
      const pct = (step + 1) / this.maxScrollSteps;
      const target = Math.min(maxScrollDistance, Math.floor(maxScrollDistance * pct));
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), target);
      await page.waitForTimeout(this.scrollPauseMs);
      await this.captureElements(page, discovered);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    return Array.from(discovered.values());
  }

  async captureElements(page, discovered) {
    const elements = await page.evaluate(() => {
      const result = [];
      const candidates = [
        ['a[href]', 'link'],
        ['button', 'button'],
        ['input[type="submit"], input[type="button"]', 'button'],
        ['[role="button"]', 'button']
      ];

      for (const [selector, type] of candidates) {
        document.querySelectorAll(selector).forEach((el) => {
          if (!isVisible(el) || el.hasAttribute('data-skip-verify')) return;
          result.push({
            type,
            selector: generateSelector(el),
            href: el.getAttribute('href') || '',
            text: (el.textContent || '').trim().slice(0, 100),
            visible: true
          });
        });
      }

      return result;

      function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
      }

      function generateSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.dataset && el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
        const path = [];
        let current = el;
        while (current && current !== document.documentElement) {
          let selector = current.tagName.toLowerCase();
          if (current.className) {
            const cls = Array.from(current.classList || [])
              .filter((c) => c && !c.startsWith('__'))
              .join('.');
            if (cls) selector += `.${cls}`;
          }
          const siblings = Array.from(current.parentElement ? current.parentElement.children : []);
          const index = siblings.filter((sib) => sib.tagName === current.tagName).indexOf(current);
          if (index >= 0) selector += `:nth-of-type(${index + 1})`;
          path.unshift(selector);
          current = current.parentElement;
        }
        return path.join(' > ');
      }
    });

    for (const el of elements) {
      if (!discovered.has(el.selector)) {
        discovered.set(el.selector, el);
      }
    }
  }

  async scrollIntoView(page, locator) {
    try {
      await locator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(FOCUS_PAUSE_MS);
    } catch {
      // Best-effort scroll
    }
  }

  async hover(page, locator) {
    try {
      await locator.hover({ timeout: CLICK_TIMEOUT_MS });
      await page.waitForTimeout(HOVER_MS);
    } catch {
      // Hover is optional; do not fail the interaction
    }
  }

  async focus(page, locator) {
    try {
      await locator.focus({ timeout: CLICK_TIMEOUT_MS });
      await page.waitForTimeout(FOCUS_PAUSE_MS);
    } catch {
      // Focus best-effort
    }
  }

  async waitAfterAction(page, timeoutMs = this.postActionTimeoutMs) {
    // Use shorter waits on local fixture pages to keep tests fast
    try {
      const url = page.url() || '';
      if (url.startsWith('file:')) {
        timeoutMs = 50; // Minimal wait for file:// fixtures
        // Skip settle wait entirely for file://
        await page.waitForTimeout(timeoutMs);
        return;
      } else if (url.includes('localhost:') || url.includes('127.0.0.1')) {
        timeoutMs = 200; // Short wait for local http fixtures
      }
    } catch {
      // Ignore config errors
    }

    const waitForUiIdle = async () => {
      const timeProvider = getTimeProvider();
      const start = timeProvider.now();
      while (timeProvider.now() - start < timeoutMs) {
        const busy = await page.evaluate(() => {
          const loading = document.querySelector('[aria-busy="true"], .loading, .spinner, [data-loading="true"]');
          return Boolean(loading);
        }).catch(() => false);
        if (!busy) {
          await page.waitForTimeout(120);
          const stillBusy = await page.evaluate(() => {
            const loading = document.querySelector('[aria-busy="true"], .loading, .spinner, [data-loading="true"]');
            return Boolean(loading);
          }).catch(() => false);
          if (!stillBusy) return;
        }
        await page.waitForTimeout(120);
      }
    };

    // Wait for network idle with longer timeout to catch slow requests
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {}),
      waitForUiIdle(),
      waitForSettle(page, this.scanBudget)
    ]);
  }

  async clickElement(page, locator) {
    await this.scrollIntoView(page, locator);
    await this.hover(page, locator);
    await this.focus(page, locator);
    await locator.click({ timeout: CLICK_TIMEOUT_MS });
    await this.waitAfterAction(page);
    return { clicked: true };
  }

  async fillFormFields(page, submitLocator) {
    const submitHandle = await submitLocator.elementHandle();
    if (!submitHandle) return { filled: [], submitted: false, reason: 'SUBMIT_NOT_FOUND' };

    const result = await submitHandle.evaluate(
      (submitEl, payload) => {
        const { dummyValues, dangerous, safeTypes } = payload;
        const form = submitEl.closest('form');
        if (!form) return { filled: [], submitted: false, reason: 'FORM_NOT_FOUND' };

        const combinedText = (form.textContent || '').toLowerCase();
        if (dangerous.some((kw) => combinedText.includes(kw))) {
          return { filled: [], submitted: false, reason: 'FORM_DANGEROUS' };
        }

        const inputs = Array.from(form.querySelectorAll('input, textarea')).filter((input) => {
          const type = (input.getAttribute('type') || input.tagName || '').toLowerCase();
          if (['submit', 'button', 'hidden', 'file'].includes(type)) return false;
          if (!safeTypes.includes(type) && !(type === '' && input.tagName.toLowerCase() === 'input')) return false;
          if (input.disabled || input.readOnly) return false;
          const style = window.getComputedStyle(input);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const name = (input.name || input.id || '').toLowerCase();
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
          if (dangerous.some((kw) => name.includes(kw) || placeholder.includes(kw))) return false;
          return true;
        });

        const filled = [];
        for (const input of inputs) {
          const type = (input.getAttribute('type') || input.tagName || '').toLowerCase();
          const valueKey = type === '' || type === 'input' ? 'text' : type === 'textarea' ? 'textarea' : type;
          const value = dummyValues[valueKey] || dummyValues.text;
          input.focus();
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          filled.push({ name: input.name || input.id || valueKey, value });
        }

        return {
          filled,
          submitted: false,
          reason: inputs.length === 0 ? 'NO_SAFE_FIELDS' : null
        };
      },
      {
        dummyValues: DUMMY_VALUES,
        dangerous: DANGEROUS_KEYWORDS,
        safeTypes: SAFE_INPUT_TYPES
      }
    );

    return result;
  }

  async submitForm(page, submitLocator) {
    let attempts = 0;
    while (attempts <= FORM_RETRY_LIMIT) {
      attempts += 1;
      try {
        await this.clickElement(page, submitLocator);
        return { submitted: true, attempts };
      } catch (error) {
        if (attempts > FORM_RETRY_LIMIT) {
          return { submitted: false, attempts, error: error.message };
        }
      }
    }
    return { submitted: false, attempts };
  }

  selectByBudget(discovered) {
    const budget = this.interactionBudgetPerPage;
    const sorted = [...discovered].sort((a, b) => (a.selector || '').localeCompare(b.selector || ''));

    const links = sorted.filter(item => item.type === 'link');
    const buttons = sorted.filter(item => item.type === 'button');
    const forms = sorted.filter(item => item.type === 'form');
    const others = sorted.filter(item => !['link', 'button', 'form'].includes(item.type));

    const allocation = {
      links: Math.floor(budget * 0.4),
      buttons: Math.floor(budget * 0.4),
      forms: Math.min(forms.length, Math.max(0, budget - Math.floor(budget * 0.4) - Math.floor(budget * 0.4)))
    };

    const selected = [];
    const take = (list, count) => list.slice(0, Math.max(0, Math.min(count, list.length)));

    selected.push(...take(links, allocation.links));
    selected.push(...take(buttons, allocation.buttons));
    selected.push(...take(forms, allocation.forms));

    const remainingBudget = Math.max(0, budget - selected.length);
    if (remainingBudget > 0) {
      const alreadySelected = new Set(selected.map(item => item.selector));
      const filler = [...links, ...buttons, ...forms, ...others].filter(item => !alreadySelected.has(item.selector));
      selected.push(...take(filler, remainingBudget));
    }

    return {
      selected,
      selectedCount: selected.length,
      discoveredCount: discovered.length,
      budgetAvailable: budget,
      skippedDueToBudgetCount: Math.max(0, discovered.length - selected.length)
    };
  }

  async fillAndSubmitForm(page, formSelector) {
    const form = page.locator(formSelector).first();
    if (await form.count() === 0) {
      return { success: false, reason: 'FORM_NOT_FOUND', filled: [], submitted: false };
    }

    const submitLocator = form.locator('button[type="submit"], input[type="submit"]').first();
    if (await submitLocator.count() === 0) {
      return { success: false, reason: 'SUBMIT_NOT_FOUND', filled: [], submitted: false };
    }

    const fillResult = await this.fillFormFields(page, submitLocator);
    const submitResult = await this.submitForm(page, submitLocator);
    return {
      success: submitResult.submitted,
      reason: fillResult.reason || (submitResult.submitted ? null : 'SUBMIT_FAILED'),
      filled: fillResult.filled || [],
      submitted: submitResult.submitted,
      attempts: submitResult.attempts
    };
  }

  async performKeyboardNavigation(page, maxTabs = 12) {
    const actions = [];
    const focusOrder = [];

    await page.focus('body').catch(() => {});

    const focusableSelectors = await page.evaluate(() => {
      const focusables = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [tabindex], [role="button"], [role="menuitem"], [contenteditable="true"]'))
        .filter(el => {
          const htmlEl = /** @type {HTMLElement} */ (el);
          return !el.hasAttribute('disabled') && htmlEl.tabIndex >= 0 && htmlEl.offsetParent !== null;
        });
      const describe = (el) => {
        if (!el) return 'body';
        if (el.id) return `#${el.id}`;
        if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
        const tag = el.tagName.toLowerCase();
        const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
        return cls ? `${tag}.${cls}` : tag;
      };
      return focusables.map(describe).slice(0, 50);
    });

    const tabLimit = Math.min(maxTabs, focusableSelectors.length || maxTabs);

    for (let i = 0; i < tabLimit; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(FOCUS_PAUSE_MS);
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { selector: 'body', tag: 'body', role: '', type: '', modal: false };
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const type = el.getAttribute('type') || '';
        const id = el.id ? `#${el.id}` : '';
        const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
        const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        const selector = id || testId || (cls ? `${tag}.${cls}` : tag);
        const modal = Boolean(el.closest('[role="dialog"], [aria-modal="true"], .modal'));
        return { selector, tag, role, type, modal };
      });

      focusOrder.push(active.selector);
      actions.push({ action: 'tab', target: active.selector });
      const isActionable = ['a', 'button'].includes(active.tag) || active.role === 'button' || active.role === 'link' || ['submit', 'button'].includes((active.type || '').toLowerCase());
      if (isActionable) {
        await page.keyboard.press('Enter');
        actions.push({ action: 'enter', target: active.selector });
        await this.waitAfterAction(page, 150);
      }

      if (active.modal) {
        await page.keyboard.press('Escape');
        actions.push({ action: 'escape', target: active.selector });
        await this.waitAfterAction(page, 120);
      }
    }

    return {
      focusOrder,
      actions,
      attemptedTabs: tabLimit
    };
  }

  async hoverAndObserve(page, locator) {
    await this.scrollIntoView(page, locator);
    await this.hover(page, locator);
    await this.waitAfterAction(page, 200);
    const hoveredSelector = await locator.evaluate(el => {
      const id = el.id ? `#${el.id}` : '';
      const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      return id || testId || (cls ? `${tag}.${cls}` : tag);
    }).catch(() => locator.selector());

    const revealState = await page.evaluate(() => {
      const revealed = document.querySelector('[data-hovered="true"], [data-menu-open="true"], [data-hover-visible="true"]');
      return Boolean(revealed);
    }).catch(() => false);

    return {
      hovered: true,
      selector: hoveredSelector,
      revealed: revealState
    };
  }

  async uploadFile(page, locator, filePath = null) {
    const uploadPath = this.ensureUploadFixture(filePath);
    await this.scrollIntoView(page, locator);
    try {
      await locator.setInputFiles(uploadPath);
    } catch {
      return { attached: false, filePath: uploadPath, submitted: false, attempts: 0, submitSelector: null };
    }

    // Attempt to submit via nearest form if present
    const submitSelector = await locator.evaluate((inputEl) => {
      const form = inputEl.closest('form');
      if (!form) return null;
      const submit = form.querySelector('button[type="submit"], input[type="submit"], button');
      if (!submit) return null;
      if (submit.id) return `#${submit.id}`;
      if (submit.getAttribute('data-testid')) return `[data-testid="${submit.getAttribute('data-testid')}"]`;
      return 'form button[type="submit"], form input[type="submit"], form button';
    }).catch(() => null);

    let submitResult = { submitted: false, attempts: 0 };
    if (submitSelector) {
      const submitLocator = page.locator(submitSelector).first();
      if (await submitLocator.count() > 0) {
        submitResult = await this.submitForm(page, submitLocator);
      }
    }

    await this.waitAfterAction(page, 200);

    return {
      attached: true,
      filePath: uploadPath,
      submitted: submitResult.submitted,
      attempts: submitResult.attempts,
      submitSelector: submitSelector || null
    };
  }

  ensureUploadFixture(filePath) {
    if (filePath) {
      return filePath;
    }
    const tmpDir = mkdtempSync(join(tmpdir(), 'verax-upload-'));
    const resolved = join(tmpDir, DEFAULT_UPLOAD_NAME);
    writeFileSync(resolved, DEFAULT_UPLOAD_CONTENT, 'utf-8');
    return resolved;
  }

  async navigateWithKeyboard(page, targetLocator) {
    try {
      await targetLocator.focus({ timeout: CLICK_TIMEOUT_MS });
      await page.waitForTimeout(FOCUS_PAUSE_MS);
      await page.keyboard.press('Enter');
      await this.waitAfterAction(page);
      return { navigated: true, method: 'keyboard' };
    } catch (error) {
      return { navigated: false, method: 'keyboard', error: error.message };
    }
  }

  async tabThroughFocusableElements(page) {
    const focusableElements = await page.evaluate(() => {
      const selectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ];
      
      const elements = [];
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          if (rect.width > 0 && rect.height > 0 && 
              style.visibility !== 'hidden' && 
              style.display !== 'none' &&
              !elements.includes(el)) {
            elements.push(el);
          }
        });
      }
      
      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          type: el.type || '',
          role: el.getAttribute('role') || '',
          id: el.id || '',
          text: (el.textContent || el.value || '').trim().slice(0, 50),
          boundingY: rect.y
        };
      });
    });
    
    return focusableElements;
  }

  async executeLogin(page, submitLocator) {
    const creds = { email: 'verax@example.com', password: 'VeraxPass123!' };
    const beforeState = await this.captureSessionState(page);
    const beforeUrl = page.url();

    try {
      // Fill login form fields
      const formHandle = await submitLocator.evaluateHandle(el => el.closest('form'));
      if (!formHandle.asElement()) {
        return { submitted: false, found: false, redirected: false, url: beforeUrl, storageChanged: false, cookiesChanged: false };
      }

      // Find and fill email/username input
      const emailInput = await page.locator('form input[type="email"], form input[name*="email" i], form input[name*="user" i], form input[name*="login" i]').first();
      if (await emailInput.count() > 0) {
        await emailInput.fill(creds.email);
      }

      // Find and fill password input
      const passwordInput = await page.locator('form input[type="password"]').first();
      if (await passwordInput.count() > 0) {
        await passwordInput.fill(creds.password);
      }

      // Submit form
      await this.scrollIntoView(page, submitLocator);
      await this.hover(page, submitLocator);
      await submitLocator.click({ timeout: CLICK_TIMEOUT_MS });
      await this.waitAfterAction(page, 600);

      const afterState = await this.captureSessionState(page);
      const afterUrl = page.url();

      const storageChanged = JSON.stringify(Object.keys(beforeState.localStorage)) !== JSON.stringify(Object.keys(afterState.localStorage));
      const cookiesChanged = beforeState.cookies.length !== afterState.cookies.length;
      const redirected = beforeUrl !== afterUrl;

      return {
        submitted: true,
        found: true,
        redirected,
        url: afterUrl,
        storageChanged,
        cookiesChanged
      };
    } catch (error) {
      return { submitted: false, found: true, redirected: false, url: beforeUrl, storageChanged: false, cookiesChanged: false, error: error.message };
    }
  }

  async performLogin(page, credentials = null) {
    const creds = credentials || { email: 'verax@example.com', password: 'VeraxPass123!' };
    const beforeUrl = page.url();
    const beforeStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const beforeCookies = await page.context().cookies();

    // Find login form
    const loginForm = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      for (const form of forms) {
        const hasPassword = form.querySelector('input[type="password"]');
        if (hasPassword) return { found: true, selector: 'form' };
      }
      return { found: false };
    });

    if (!loginForm.found) {
      return { submitted: false, found: false, redirected: false, url: beforeUrl, storageChanged: false, cookiesChanged: false };
    }

    // Fill and submit form
    const emailInput = await page.$('input[type="email"], input[name*="email"], input[name*="user"], input[name*="login"]');
    const passwordInput = await page.$('input[type="password"]');

    if (emailInput) {
      await emailInput.fill(creds.email);
    }
    if (passwordInput) {
      await passwordInput.fill(creds.password);
    }

    const submitButton = await page.$('form button[type="submit"], form input[type="submit"], form button');
    if (!submitButton) {
      return { submitted: false, found: true, redirected: false, url: beforeUrl, storageChanged: false, cookiesChanged: false };
    }

    try {
      await Promise.race([
        submitButton.click().catch(() => null),
        page.waitForTimeout(CLICK_TIMEOUT_MS)
      ]);
      await this.waitAfterAction(page, 600);
    } catch {
      // Ignore form submission errors
    }

    const afterUrl = page.url();
    const afterStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const afterCookies = await page.context().cookies();

    const storageChanged = JSON.stringify(beforeStorageKeys) !== JSON.stringify(afterStorageKeys);
    const cookiesChanged = beforeCookies.length !== afterCookies.length;
    const redirected = beforeUrl !== afterUrl;

    return {
      submitted: true,
      found: true,
      redirected,
      url: afterUrl,
      storageChanged,
      cookiesChanged
    };
  }

  async performLogout(page) {
    const beforeUrl = page.url();
    const beforeStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const beforeCookies = await page.context().cookies();

    // Find logout button/link
    const logoutElement = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      for (const el of candidates) {
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('logout') || text.includes('sign out') || text.includes('signout')) {
          return true;
        }
      }
      return false;
    });

    if (!logoutElement) {
      return { found: false, clicked: false, url: beforeUrl, storageChanged: false, cookiesChanged: false };
    }

    let clicked = false;
    const buttons = await page.$$('button, a, [role="button"]');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && (text.toLowerCase().includes('logout') || text.toLowerCase().includes('sign out'))) {
        try {
          await btn.click();
          clicked = true;
          await this.waitAfterAction(page, 400);
          break;
        } catch {
          // Ignore interaction errors
        }
      }
    }

    const afterUrl = page.url();
    const afterStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    const afterCookies = await page.context().cookies();

    const storageChanged = JSON.stringify(beforeStorageKeys) !== JSON.stringify(afterStorageKeys);
    const cookiesChanged = beforeCookies.length !== afterCookies.length;
    const redirected = beforeUrl !== afterUrl;

    return {
      found: true,
      clicked,
      url: afterUrl,
      redirected,
      storageChanged,
      cookiesChanged
    };
  }

  async checkProtectedRoute(page, url) {
    const beforeUrl = page.url();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: CLICK_TIMEOUT_MS }).catch(() => null);
    } catch {
      // Ignore navigation errors
    }

    const afterUrl = page.url();
    const redirectedToLogin = beforeUrl !== afterUrl && (afterUrl.includes('/login') || afterUrl.includes('/signin'));
    const content = await page.content();
    const hasAccessDenied = content.includes('401') || content.includes('403') || content.includes('unauthorized') || content.includes('forbidden');
    const isProtected = redirectedToLogin || hasAccessDenied;

    return {
      url,
      beforeUrl,
      afterUrl,
      isProtected,
      redirectedToLogin,
      hasAccessDenied,
      httpStatus: hasAccessDenied ? (content.includes('403') ? 403 : 401) : 200
    };
  }

  async captureSessionState(page) {
    try {
      const localStorage = await page.evaluate(() => {
        const result = {};
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) result[key] = window.localStorage.getItem(key);
          }
        } catch {
          // Ignore localStorage access errors
        }
        return result;
      });

      const sessionStorage = await page.evaluate(() => {
        const result = {};
        try {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key) result[key] = window.sessionStorage.getItem(key);
          }
        } catch {
          // Ignore sessionStorage access errors
        }
        return result;
      });

      const cookies = await page.context().cookies();

      return {
        localStorage: localStorage || {},
        sessionStorage: sessionStorage || {},
        cookies: cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path }))
      };
    } catch (error) {
      return {
        localStorage: {},
        sessionStorage: {},
        cookies: []
      };
    }
  }

}



