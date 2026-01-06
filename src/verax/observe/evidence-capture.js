export async function captureScreenshot(page, filepath) {
  await page.screenshot({ path: filepath, fullPage: false });
  return filepath;
}

