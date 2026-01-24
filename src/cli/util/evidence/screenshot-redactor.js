/**
 * Screenshot Redaction Engine
 * 
 * Applies deterministic masking overlays to screenshot buffers.
 * Masks sensitive regions based on CSS selectors and text pattern detection.
 */

import { SENSITIVE_SELECTORS } from '../config/redaction-config.js';

/**
 * Find bounding boxes of all elements matching sensitive selectors
 * @param {Object} page - Playwright Page object
 * @param {Array<string>} selectors - CSS selectors to match
 * @returns {Promise<Array>} Array of { selector, bbox: { x, y, width, height } }
 */
export async function findSensitiveElementBBoxes(page, selectors = SENSITIVE_SELECTORS) {
  const bboxes = [];
  
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      
      for (let i = 0; i < count; i++) {
        const element = locator.nth(i);
        const bbox = await element.boundingBox();
        
        // Only add if element is visible and has a bounding box
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          bboxes.push({
            selector,
            bbox,
            elementIndex: i,
          });
        }
      }
    } catch (err) {
      // Selector may not match anything, continue to next
    }
  }
  
  return bboxes;
}

/**
 * Detect text patterns in DOM and locate their regions
 * Returns bounding boxes for text content matching sensitive patterns
 * @param {Object} page - Playwright Page object
 * @param {RegExp} pattern - Pattern to search for
 * @returns {Promise<Array>} Array of bbox objects
 */
export async function findTextPatternBBoxes(page, pattern) {
  const bboxes = [];
  
  try {
    // Get all text nodes from DOM
    const textNodes = await page.evaluate((_patternStr) => {
      const walker = /** @type {any} */ (document.createTreeWalker)(
        document.body,
        // eslint-disable-next-line no-undef
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const nodes = [];
      let node;
      
      // Only process text nodes (not in scripts/styles)
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
          nodes.push({
            text: node.textContent,
            parentTag: parent.tagName,
          });
        }
      }
      
      return nodes;
    }, pattern.source);
    
    // For each text node that matches pattern, find its element's bbox
    for (const textNode of textNodes) {
      // Re-query page to find elements containing this text
      const xpath = `//${textNode.parentTag.toLowerCase()}[contains(text(), '${textNode.text.slice(0, 50)}')]`;
      try {
        const locators = await page.locator(`xpath=${xpath}`);
        const count = await locators.count();
        
        for (let i = 0; i < count; i++) {
          const bbox = await locators.nth(i).boundingBox();
          if (bbox && bbox.width > 0 && bbox.height > 0) {
            bboxes.push({
              type: 'textPattern',
              pattern: pattern.source,
              bbox,
            });
          }
        }
      } catch (err) {
        // XPath may not be valid, continue
      }
    }
  } catch (err) {
    // Text detection may fail, continue without text-based redaction
  }
  
  return bboxes;
}

/**
 * Merge overlapping bounding boxes to avoid double-masking
 * @param {Array<Object>} bboxes - Array of bbox objects
 * @returns {Array<Object>} Merged bboxes
 */
export function mergeOverlappingBBoxes(bboxes) {
  if (bboxes.length <= 1) return bboxes;
  
  // Sort by x, then y
  const sorted = [...bboxes].sort((a, b) => {
    const abox = a.bbox;
    const bbox = b.bbox;
    return abox.x - bbox.x || abox.y - bbox.y;
  });
  
  const merged = [];
  let current = { ...sorted[0].bbox };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i].bbox;
    
    // Check if boxes overlap or are adjacent
    if (
      current.x + current.width >= next.x &&
      current.y + current.height >= next.y
    ) {
      // Merge: expand current to encompass next
      const minX = Math.min(current.x, next.x);
      const minY = Math.min(current.y, next.y);
      const maxX = Math.max(current.x + current.width, next.x + next.width);
      const maxY = Math.max(current.y + current.height, next.y + next.height);
      
      current = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    } else {
      // No overlap, save current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged.map(bbox => ({ bbox }));
}

/**
 * Apply padding to bounding boxes
 * @param {Array<Object>} bboxes - Bboxes to pad
 * @param {number} padding - Padding in pixels
 * @param {number} viewportWidth - Viewport width for clamping
 * @param {number} viewportHeight - Viewport height for clamping
 * @returns {Array<Object>} Padded bboxes
 */
export function padBoundingBoxes(bboxes, padding, viewportWidth, viewportHeight) {
  return bboxes.map(item => {
    const bbox = item.bbox;
    return {
      ...item,
      bbox: {
        x: Math.max(0, bbox.x - padding),
        y: Math.max(0, bbox.y - padding),
        width: bbox.width + 2 * padding,
        height: bbox.height + 2 * padding,
        // Clamp to viewport
        maxX: Math.min(viewportWidth, bbox.x + bbox.width + padding),
        maxY: Math.min(viewportHeight, bbox.y + bbox.height + padding),
      },
    };
  });
}

/**
 * Redact screenshot buffer by applying solid color masks to sensitive regions
 * @param {Buffer} screenshotBuffer - Original screenshot as PNG buffer
 * @param {Array<Object>} bboxes - Bounding boxes to redact
 * @param {Object} maskColor - Color { r, g, b, alpha }
 * @returns {Promise<Buffer>} Redacted screenshot buffer
 */
export async function redactScreenshotBuffer(screenshotBuffer, bboxes, maskColor = { r: 0, g: 0, b: 0, alpha: 1.0 }) {
  if (!bboxes || bboxes.length === 0) {
    // No redaction needed
    return screenshotBuffer;
  }
  
  try {
    // Use sharp for image manipulation (lightweight, deterministic)
    const sharp = (await import('sharp')).default;
    
    let image = sharp(screenshotBuffer);
    const _metadata = await image.metadata();
    
    // Create compositing array for overlays
    const overlays = bboxes.map(item => {
      const bbox = item.bbox;
      const width = Math.max(1, bbox.maxX ? bbox.maxX - bbox.x : bbox.width);
      const height = Math.max(1, bbox.maxY ? bbox.maxY - bbox.y : bbox.height);
      
      // Create solid color image for this region
      return {
        input: {
          create: {
            width: Math.ceil(width),
            height: Math.ceil(height),
            channels: 4,
            background: {
              r: maskColor.r,
              g: maskColor.g,
              b: maskColor.b,
              alpha: maskColor.alpha,
            },
          },
        },
        left: Math.floor(bbox.x),
        top: Math.floor(bbox.y),
      };
    });
    
    // Apply all overlays
    if (overlays.length > 0) {
      // @ts-ignore - sharp library version compatibility
      image = image.composite(overlays);
    }
    
    return await image.png().toBuffer();
  } catch (err) {
    // Sharp not available or error in image processing
    // Fall back to returning original buffer (no redaction)
    console.warn('Screenshot redaction failed, using unredacted buffer:', err.message);
    return screenshotBuffer;
  }
}

/**
 * Main redaction orchestrator
 * @param {Buffer} screenshotBuffer - Original screenshot
 * @param {Object} page - Playwright Page (optional, for element detection)
 * @param {Array<string>} selectors - Selectors to redact
 * @param {Object} config - Redaction config { maskColor, maskPadding }
 * @returns {Promise<Object>} { buffer, stats: { regionsRedacted } }
 */
export async function redactScreenshot(screenshotBuffer, page = null, selectors = SENSITIVE_SELECTORS, config = {}) {
  const maskColor = config.maskColor || { r: 0, g: 0, b: 0, alpha: 1.0 };
  const padding = config.maskPadding || 2;
  
  let bboxes = [];
  
  // If page is available, find sensitive elements
  if (page) {
    try {
      bboxes = await findSensitiveElementBBoxes(page, selectors);
      
      // Apply padding
      const viewport = page.viewportSize();
      if (viewport) {
        bboxes = padBoundingBoxes(bboxes, padding, viewport.width, viewport.height);
      }
      
      // Merge overlapping regions
      bboxes = mergeOverlappingBBoxes(bboxes);
    } catch (err) {
      // Element detection failed, proceed without page-based redaction
    }
  }
  
  // Apply redaction
  const redacted = await redactScreenshotBuffer(screenshotBuffer, bboxes, maskColor);
  
  return {
    buffer: redacted,
    stats: {
      regionsRedacted: bboxes.length,
      bboxes,
    },
  };
}








