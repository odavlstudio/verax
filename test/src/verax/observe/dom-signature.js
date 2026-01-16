import { createHash } from 'crypto';

const MAX_TEXT_LENGTH = 5000;

export async function captureDomSignature(page) {
  try {
    const text = await page.evaluate(() => {
      return document.body?.innerText?.trim() || '';
    });
    
    const normalized = text
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, MAX_TEXT_LENGTH);
    
    const hash = createHash('sha256').update(normalized).digest('hex');
    
    return hash;
  } catch (error) {
    return null;
  }
}

