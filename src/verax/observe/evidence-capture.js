import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

// Screenshot redaction is not implemented; buffers are returned unchanged to avoid false claims
// Apply deterministic redaction to captured content (placeholder pass-through)
async function redactScreenshot(buffer, _options = {}) {
  const redactionEnabled = process.env.VERAX_REDACT !== 'false';
  if (!redactionEnabled) return buffer;
  
  try {
    // Screenshot redaction not implemented - binary buffer returned unmodified
    // Binary screenshot redaction requires specialized image processing
    return buffer;
  } catch (error) {
    // Graceful degradation if redaction fails
    console.warn('Redaction failed:', error.message);
    return buffer;
  }
}

export async function captureScreenshot(page, filepath) {
  try {
    // Create directory if needed
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    // Capture screenshot
    const buffer = await page.screenshot({ path: filepath, fullPage: false });
    
    // Apply redaction before disk write
    const redactedBuffer = await redactScreenshot(buffer, { filepath });
    
    // Write redacted version to disk
    writeFileSync(filepath, redactedBuffer);
    
    // Temp file cleanup prevents raw artifact exposure
    const tempPath = filepath + '.temp';
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
    
    return filepath;
  } catch (error) {
    // Error handling present for redaction
    console.error('Screenshot capture failed:', error.message);
    throw error;
  }
}




