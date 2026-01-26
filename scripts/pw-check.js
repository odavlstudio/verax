import { chromium } from 'playwright';

async function main() {
  const url = process.argv[2] || 'http://127.0.0.1:3456/index.html';
  const browser = await chromium.launch({ headless: true, timeout: 45000 });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const title = await page.title();
  console.log(JSON.stringify({ ok: true, title }));
  await browser.close();
}

main().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }));
  process.exit(1);
});
