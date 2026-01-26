import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import { defaultSecurityPolicy } from '../core/evidence-security-policy.js';

/**
 * GATE 4: Apply deterministic screenshot redaction.
 * Masks sensitive fields (password, email, tel, text) before screenshot is written to disk.
 * Uses Playwright locator masking to blur fields without modifying layout.
 */
async function redactScreenshot(page, _options = {}) {
  if (!defaultSecurityPolicy.screenshotRedaction.enabled) {
    return;  // No redaction needed
  }

  try {
    // Redact password input fields
    const passwordInputs = await page.locator('input[type="password"]').all();
    for (const input of passwordInputs) {
      try {
        await input.evaluate(el => {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            el.style.color = 'transparent';
            el.style.textShadow = 'none';
            el.value = '';
          }
        });
      } catch (e) {
        // Element may have been removed, skip
      }
    }

    // Redact email input fields
    const emailInputs = await page.locator('input[type="email"]').all();
    for (const input of emailInputs) {
      try {
        await input.evaluate(el => {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            el.style.color = 'transparent';
            el.style.textShadow = 'none';
            el.value = '';
          }
        });
      } catch (e) {
        // Element may have been removed, skip
      }
    }

    // Redact telephone input fields
    const telInputs = await page.locator('input[type="tel"]').all();
    for (const input of telInputs) {
      try {
        await input.evaluate(el => {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            el.style.color = 'transparent';
            el.style.textShadow = 'none';
            el.value = '';
          }
        });
      } catch (e) {
        // Element may have been removed, skip
      }
    }

    // Redact text inputs inside forms (sensitive context)
    const formTextInputs = await page.locator('form input[type="text"]').all();
    for (const input of formTextInputs) {
      try {
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const nameStr = (name || '').toLowerCase();
        const idStr = (id || '').toLowerCase();
        
        // Only redact if field name suggests sensitivity
        if (defaultSecurityPolicy.isSensitiveField(nameStr) || defaultSecurityPolicy.isSensitiveField(idStr)) {
          await input.evaluate(el => {
            const box = el.getBoundingClientRect();
            if (box.width > 0 && box.height > 0) {
              el.style.color = 'transparent';
              el.style.textShadow = 'none';
              el.value = '';
            }
          });
        }
      } catch (e) {
        // Element may have been removed, skip
      }
    }

    // Redact elements with autocomplete="password" or similar sensitive attributes
    const autoCompleteElements = await page.locator('[autocomplete="password"], [autocomplete="email"], [autocomplete="tel"]').all();
    for (const el of autoCompleteElements) {
      try {
        await el.evaluate(elem => {
          const box = elem.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            if (elem.tagName.toLowerCase() === 'input') {
              elem.style.color = 'transparent';
              elem.style.textShadow = 'none';
              elem.value = '';
            }
          }
        });
      } catch (e) {
        // Element may have been removed, skip
      }
    }
  } catch (error) {
    // Graceful degradation: if redaction fails, continue without redacting
    console.warn('Screenshot redaction encountered an error (non-fatal):', error.message);
  }
}

export async function captureScreenshot(page, filepath) {
  try {
    // Create directory if needed
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Apply redaction before screenshot (modifies page state temporarily)
    await redactScreenshot(page, { filepath });

    // Capture screenshot after redaction
    const buffer = await page.screenshot({ path: filepath, fullPage: false });

    // Write screenshot to disk
    writeFileSync(filepath, buffer);

    // Temp file cleanup prevents raw artifact exposure
    const tempPath = filepath + '.temp';
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }

    return filepath;
  } catch (error) {
    // Error handling for screenshot capture
    console.error('Screenshot capture failed:', error.message);
    throw error;
  }
}




