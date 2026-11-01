import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const pages = browser.contexts().flatMap((context) => context.pages());
const page = pages.find((candidate) => candidate.url().includes('8788')) ?? pages[0];
if (!page) throw new Error('No packaged page found');
await page.evaluate(() => localStorage.setItem('lienzo:user-name', 'Ismael'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.dashboard', { timeout: 30000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'docs/screenshots/desktop-packaged.png' });
console.log('URL', page.url());
console.log('DESKTOP', await page.evaluate(() => window.lienzoDesktop));
process.exit(0);
