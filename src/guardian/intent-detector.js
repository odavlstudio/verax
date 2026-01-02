/**
 * Intent Detection Engine
 * Inspects the homepage and classifies site intent.
 * Returns { intent: 'saas'|'shop'|'landing'|'unknown', confidence: 0-100, signals: string[] }
 */

const { GuardianBrowser } = require('./browser');

async function detectIntent(url, options = {}) {
  const browser = new GuardianBrowser();
  const timeout = options.timeout || 20000;
  const headless = options.headless !== false;
  const result = { intent: 'unknown', confidence: 0, signals: [] };

  try {
    await browser.launch(timeout, { headless });
    await browser.page.goto(url, { waitUntil: 'load', timeout });
    // Ensure content is rendered before signal extraction
    await browser.page.waitForLoadState('domcontentloaded');
    await browser.page.waitForTimeout(100);
    const signals = await _extractSignals(browser.page);
    const { intent, confidence } = _classifyFromSignals(signals);
    result.intent = intent;
    result.confidence = confidence;
    result.signals = signals;
    return result;
  } catch (err) {
    return { intent: 'unknown', confidence: 0, signals: [`error:${err.message}`] };
  } finally {
    try {
      if (browser?.context) await browser.context.close();
      if (browser?.browser) await browser.browser.close();
    } catch (_err) {
      // Browser cleanup errors are non-critical - browser may already be closed
    }
  }
}

async function _extractSignals(page) {
  try {
    return await page.evaluate(() => {
      const signals = [];

      function textIncludes(el, kws) {
        const t = (el.innerText || '').toLowerCase();
        return kws.some(k => t.includes(k));
      }

      const anchors = Array.from(document.querySelectorAll('a'));
      const buttons = Array.from(document.querySelectorAll('button'));
      const forms = Array.from(document.querySelectorAll('form'));

      // URL patterns in anchors
      const urlKWs = ['/pricing', '/signup', '/account/signup', '/shop', '/cart', '/checkout', '/contact'];
      for (const a of anchors) {
        const href = (a.getAttribute('href') || '').toLowerCase();
        urlKWs.forEach(k => { if (href.includes(k)) signals.push(`url:${k}`); });
      }

      // Keywords: signup/subscribe/pricing
      const saasKWs = ['sign up', 'signup', 'subscribe', 'get started', 'pricing', 'plan'];
      [...anchors, ...buttons].forEach(el => {
        if (textIncludes(el, saasKWs)) signals.push('kw:saas');
      });

      // Shop keywords: buy/cart/checkout/add to cart/order/purchase
      const shopKWs = ['buy', 'cart', 'checkout', 'add to cart', 'order', 'purchase'];
      [...anchors, ...buttons].forEach(el => {
        if (textIncludes(el, shopKWs)) signals.push('kw:shop');
      });

      // Landing/contact keywords
      const landingKWs = ['contact', 'get in touch'];
      [...anchors, ...buttons].forEach(el => {
        if (textIncludes(el, landingKWs)) signals.push('kw:landing');
      });

      // Forms vs payment buttons
      const hasEmailInput = !!document.querySelector('input[type="email"], input[name*="email" i]');
      const hasContactForm = forms.some(f => {
        const txts = f.querySelectorAll('textarea');
        const names = f.querySelectorAll('input[name*="name" i]');
        const emails = f.querySelectorAll('input[type="email"], input[name*="email" i]');
        return emails.length > 0 || (names.length > 0 && txts.length > 0);
      });
      if (hasEmailInput) signals.push('form:email');
      if (hasContactForm) signals.push('form:contact');

      const hasPaymentBtn = [...buttons, ...anchors].some(el => textIncludes(el, ['buy', 'checkout', 'add to cart', 'purchase']));
      if (hasPaymentBtn) signals.push('btn:payment');

      // Price indications (numbers with per month/year)
      const bodyText = (document.body.innerText || '').toLowerCase();
      if (/\$\s*\d+/.test(bodyText) || /€\s*\d+/.test(bodyText)) {
        if (bodyText.includes('per month') || bodyText.includes('/month') || bodyText.includes('monthly')) {
          signals.push('price:monthly');
        }
        if (bodyText.includes('per year') || bodyText.includes('/year') || bodyText.includes('annually')) {
          signals.push('price:annual');
        }
      }

      // Fallback: scan body text for keywords
      if (saasKWs.some(k => bodyText.includes(k))) signals.push('kw:saas');
      if (shopKWs.some(k => bodyText.includes(k))) signals.push('kw:shop');
      if (landingKWs.some(k => bodyText.includes(k))) signals.push('kw:landing');

      return signals;
    });
  } catch (e) {
    return [`error:${e.message}`];
  }
}

function _classifyFromSignals(signals) {
  let saas = 0, shop = 0, landing = 0;

  for (const s of signals) {
    if (s.startsWith('kw:saas')) saas += 2;
    if (s.startsWith('url:/pricing')) saas += 3;
    if (s.startsWith('url:/signup')) saas += 3;
    if (s.startsWith('form:email')) saas += 2;
    if (s.startsWith('price:')) saas += 1;

    if (s.startsWith('kw:shop')) shop += 2;
    if (s.startsWith('btn:payment')) shop += 3;
    if (s.startsWith('url:/shop')) shop += 2;
    if (s.startsWith('url:/cart')) shop += 3;
    if (s.startsWith('url:/checkout')) shop += 3;

    if (s.startsWith('kw:landing')) landing += 2;
    if (s.startsWith('form:contact')) landing += 3;
    if (s.startsWith('url:/contact')) landing += 2;
  }

  const scores = { saas, shop, landing };
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const maxScore = top ? top[1] : 0;
  const intent = maxScore >= 2 ? top[0] : 'unknown';
  const confidence = Math.min(100, Math.round((maxScore / 10) * 100));
  return { intent, confidence };
}

module.exports = {
  detectIntent,
  _extractSignals,
  _classifyFromSignals
};
