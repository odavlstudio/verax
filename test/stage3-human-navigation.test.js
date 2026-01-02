/**
 * Stage 3 Integration Tests - Human Navigation
 * Tests human-like CTA navigation, fallbacks, and mobile viewport
 */

const assert = require('assert');
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  discoverPrimaryCTAs,
  choosePrimaryCTA,
  trySelectorWithFallback,
  inferConfidenceFromSelector,
  executeHumanPath,
  executeMultiViewportPath,
  CTA_INTENT_KEYWORDS
} = require('../src/guardian/human-navigator');

describe('Stage 3 — Human Navigation', function() {
  this.timeout(20000);
  
  let browser, server, serverPort;
  
  before(async function() {
    // Start fixture server
    server = http.createServer((req, res) => {
      let filePath;
      
      if (req.url === '/good') {
        filePath = path.join(__dirname, 'fixtures', 'good-cta-path.html');
      } else if (req.url === '/broken') {
        filePath = path.join(__dirname, 'fixtures', 'broken-cta-path.html');
      } else {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });
    
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        console.log(`\n  Fixture server started at http://127.0.0.1:${serverPort}`);
        resolve();
      });
    });
    
    // Start browser
    browser = await chromium.launch({ headless: true });
  });
  
  after(async function() {
    if (browser) await browser.close();
    if (server) server.close();
    console.log('  Fixture server closed\n');
  });

  describe('CTA Discovery', function() {
    
    it('should discover primary CTA on good page', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const ctaCandidates = await discoverPrimaryCTAs(page);
      
      assert(ctaCandidates.length > 0, 'Should find at least one CTA');
      assert(ctaCandidates[0].text.includes('get started') || 
             ctaCandidates[0].text.includes('start'), 
             'Should find CTA with intent keywords');
      assert(ctaCandidates[0].confidence > 30, 'CTA should have reasonable confidence');
      
      await context.close();
    });

    it('should discover CTA on broken page with fallback selector', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/broken`);
      
      const ctaCandidates = await discoverPrimaryCTAs(page);
      
      assert(ctaCandidates.length > 0, 'Should find CTA even without data-testid');
      
      // Verify fallback selector strategy works
      const cta = ctaCandidates[0];
      assert(cta.selector, 'Should generate a selector');
      
      // Should use role or aria-label (MEDIUM confidence fallback)
      const hasFallback = cta.selector.includes('role') || 
                          cta.selector.includes('aria-label');
      assert(hasFallback, 'Should use fallback selector strategy');
      
      await context.close();
    });

    it('should choose primary CTA deterministically', function() {
      const candidates = [
        { text: 'Buy Now', confidence: 80, isAboveFold: true, position: { left: 100 }, size: { width: 150, height: 50 } },
        { text: 'Learn More', confidence: 60, isAboveFold: true, position: { left: 300 }, size: { width: 120, height: 40 } },
        { text: 'Contact', confidence: 80, isAboveFold: true, position: { left: 200 }, size: { width: 150, height: 50 } }
      ];
      
      const chosen = choosePrimaryCTA(candidates);
      
      assert.strictEqual(chosen.text, 'Buy Now', 'Should choose highest confidence with leftmost position');
    });
  });

  describe('Selector Confidence', function() {
    
    it('should infer HIGH confidence for data-testid', function() {
      const confidence = inferConfidenceFromSelector('[data-testid="submit"]');
      assert.strictEqual(confidence, 'HIGH');
    });

    it('should infer MEDIUM confidence for role/aria-label', function() {
      const confidence1 = inferConfidenceFromSelector('[role="button"][aria-label="Submit"]');
      assert.strictEqual(confidence1, 'MEDIUM');
      
      const confidence2 = inferConfidenceFromSelector('#submit-btn');
      assert.strictEqual(confidence2, 'MEDIUM');
    });

    it('should infer LOW confidence for class selectors', function() {
      const confidence = inferConfidenceFromSelector('.submit-button');
      assert.strictEqual(confidence, 'LOW');
    });
  });

  describe('Selector Fallback Strategy', function() {
    
    it('should try HIGH selector first, then fallback to MEDIUM', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      // Try primary HIGH confidence selector that exists
      const result = await trySelectorWithFallback(page, '[data-testid="primary-cta"]', {
        fallbackSelectors: ['[role="button"]', '.cta-button'],
        timeout: 3000
      });
      
      assert.strictEqual(result.success, true, 'Should find element with HIGH selector');
      assert.strictEqual(result.confidence, 'HIGH', 'Should use HIGH confidence selector');
      assert.strictEqual(result.strategy, 'primary', 'Should use primary strategy');
      
      await context.close();
    });

    it('should fallback to MEDIUM when HIGH selector missing', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/broken`);
      
      // Try non-existent HIGH selector, should fallback to MEDIUM
      const result = await trySelectorWithFallback(page, '[data-testid="non-existent"]', {
        fallbackSelectors: ['[role="button"][aria-label="Start your free trial"]', '.cta-button'],
        timeout: 3000
      });
      
      assert.strictEqual(result.success, true, 'Should find element with fallback');
      assert.strictEqual(result.confidence, 'MEDIUM', 'Should use MEDIUM confidence fallback');
      assert.strictEqual(result.strategy, 'fallback', 'Should use fallback strategy');
      assert(result.attemptCount > 1, 'Should have tried multiple selectors');
      
      await context.close();
    });

    it('should report SELECTOR_MISSING when all fallbacks fail', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const result = await trySelectorWithFallback(page, '[data-testid="does-not-exist"]', {
        fallbackSelectors: ['[data-missing="true"]', '#nonexistent'],
        timeout: 2000
      });
      
      assert.strictEqual(result.success, false, 'Should fail when all selectors missing');
      assert.strictEqual(result.error, 'SELECTOR_MISSING', 'Should report SELECTOR_MISSING');
      assert.strictEqual(result.attemptCount, 3, 'Should have tried all selectors');
      
      await context.close();
    });
  });

  describe('Human Path Execution - Good CTA', function() {
    
    it('should execute complete human path on good page', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const humanPath = await executeHumanPath(page, { 
        viewport: 'desktop',
        maxSteps: 5
      });
      
      assert.strictEqual(humanPath.viewport, 'desktop', 'Should use desktop viewport');
      assert(humanPath.steps.length >= 3, 'Should have at least 3 steps');
      assert.strictEqual(humanPath.outcome, 'SUCCESS', 'Should succeed on good page');
      
      // Verify steps
      const discoverStep = humanPath.steps.find(s => s.action === 'discover_cta');
      assert(discoverStep, 'Should have CTA discovery step');
      assert(discoverStep.candidatesFound > 0, 'Should find CTA candidates');
      
      const clickStep = humanPath.steps.find(s => s.action === 'click_cta');
      assert(clickStep, 'Should have CTA click step');
      assert.strictEqual(clickStep.result, 'SUCCESS', 'CTA click should succeed');
      
      const verifyStep = humanPath.steps.find(s => s.action === 'verify_success');
      assert(verifyStep, 'Should have success verification step');
      assert.strictEqual(verifyStep.result, 'SUCCESS', 'Should find success indicator');
      
      await context.close();
    });

    it('should detect navigation changes in good path', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const humanPath = await executeHumanPath(page, { viewport: 'desktop' });
      
      const clickStep = humanPath.steps.find(s => s.action === 'click_cta');
      assert(clickStep.evidence, 'Should have evidence');
      
      // Either URL changed or title changed or new content appeared
      const hasChange = clickStep.evidence.urlChanged || 
                       clickStep.evidence.titleChanged || 
                       clickStep.evidence.hasNewContent;
      assert(hasChange, 'Should detect some form of navigation/state change');
      
      await context.close();
    });
  });

  describe('Human Path Execution - Broken CTA', function() {
    
    it('should detect broken CTA path', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/broken`);
      
      const humanPath = await executeHumanPath(page, { 
        viewport: 'desktop',
        maxSteps: 5
      });
      
      assert(humanPath.steps.length > 0, 'Should execute some steps');
      
      // Broken page should NOT result in SUCCESS
      assert.notStrictEqual(humanPath.outcome, 'SUCCESS', 'Broken page should not show SUCCESS');
      
      // Should detect failure or no success element
      const verifyStep = humanPath.steps.find(s => s.action === 'verify_success');
      if (verifyStep) {
        assert.notStrictEqual(verifyStep.result, 'SUCCESS', 'Should not find success indicator');
      }
      
      await context.close();
    });
  });

  describe('Mobile Viewport Support', function() {
    
    it('should execute human path on mobile viewport', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const humanPath = await executeHumanPath(page, { 
        viewport: 'mobile',
        maxSteps: 5
      });
      
      assert.strictEqual(humanPath.viewport, 'mobile', 'Should use mobile viewport');
      assert.strictEqual(humanPath.viewportSize.width, 375, 'Should set mobile width');
      assert.strictEqual(humanPath.viewportSize.height, 667, 'Should set mobile height');
      assert(humanPath.steps.length > 0, 'Should execute steps on mobile');
      
      await context.close();
    });

    it('should test both desktop and mobile viewports', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const results = await executeMultiViewportPath(page, `http://127.0.0.1:${serverPort}/good`);
      
      assert(results.desktop, 'Should have desktop results');
      assert(results.mobile, 'Should have mobile results');
      assert.strictEqual(results.desktop.viewport, 'desktop');
      assert.strictEqual(results.mobile.viewport, 'mobile');
      
      // Good page should succeed on both viewports
      assert.strictEqual(results.verdict, 'READY', 'Good page should be READY on both viewports');
      
      await context.close();
    });

    it('should handle viewport-specific failures', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const results = await executeMultiViewportPath(page, `http://127.0.0.1:${serverPort}/broken`);
      
      // Broken page should NOT be READY
      assert.notStrictEqual(results.verdict, 'READY', 'Broken page should not be READY');
      
      // Should be FRICTION or DO_NOT_LAUNCH
      const isFailed = results.verdict === 'FRICTION' || results.verdict === 'DO_NOT_LAUNCH';
      assert(isFailed, 'Broken page should result in FRICTION or DO_NOT_LAUNCH');
      
      await context.close();
    });
  });

  describe('Integration with Coverage Model', function() {
    
    it('should categorize human path failures correctly', async function() {
      // When human path fails to find CTA, it should be NA_BY_UNCERTAINTY
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.setContent('<html><body><p>No CTAs here</p></body></html>');
      
      const humanPath = await executeHumanPath(page, { viewport: 'desktop' });
      
      assert.strictEqual(humanPath.outcome, 'NO_CTA_FOUND', 'Should report NO_CTA_FOUND');
      
      // This should be treated as NA_BY_UNCERTAINTY for coverage calculation
      // (selector missing/ambiguous scenario)
      
      await context.close();
    });

    it('should provide evidence for decision authority', async function() {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://127.0.0.1:${serverPort}/good`);
      
      const humanPath = await executeHumanPath(page, { viewport: 'desktop' });
      
      // Verify humanPath structure can be used as signals
      assert(humanPath.outcome, 'Should have outcome');
      assert(humanPath.steps, 'Should have steps array');
      assert(humanPath.viewport, 'Should have viewport');
      assert(humanPath.duration >= 0, 'Should have duration');
      assert(humanPath.startUrl, 'Should have start URL');
      assert(humanPath.endUrl, 'Should have end URL');
      
      // This structure should integrate with decision-authority signals
      
      await context.close();
    });
  });
});

console.log('\n✅ Human Navigation Tests Loaded\n');
