import { chromium } from 'playwright-core';
import fs from 'node:fs';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const errors = [];

async function newPage({ width, height, theme, mobile = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
    locale: 'es-ES',
  });
  await context.addInitScript(({ theme }) => {
    localStorage.setItem('tiza:theme-mode', theme);
    localStorage.setItem('lienzo:user-name', 'Ismael');
  }, { theme });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`);
  });
  return page;
}

async function openBoard(page) {
  await page.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
  await page.waitForSelector('.dashboard');
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Abrir tablero/i }).first().click();
  await page.waitForSelector('.board-shell');
  await page.waitForTimeout(1800);
  try {
    await page.locator('.toast').waitFor({ state: 'detached', timeout: 3000 });
  } catch {}
}

const desktop = await newPage({ width: 1440, height: 900, theme: 'dark' });
await desktop.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
await desktop.waitForSelector('.dashboard');
await desktop.waitForTimeout(900);
await desktop.screenshot({ path: 'docs/screenshots/dashboard.png' });
await fs.copyFileSync('docs/screenshots/dashboard.png', 'docs/screenshots/portada.png');

await desktop.getByRole('button', { name: /Abrir tablero/i }).first().click();
await desktop.waitForSelector('.board-shell');
await desktop.waitForTimeout(1800);
try {
  await desktop.locator('.toast').waitFor({ state: 'detached', timeout: 3000 });
} catch {}
await desktop.screenshot({ path: 'docs/screenshots/board.png' });

await desktop.locator('.toolbar button[aria-label="Plantillas"]').click();
await desktop.waitForSelector('.modal');
await desktop.waitForTimeout(700);
await desktop.screenshot({ path: 'docs/screenshots/templates.png' });
await desktop.locator('.modal-head .icon-btn').click();
await desktop.waitForTimeout(300);

await desktop.getByRole('button', { name: 'Presentar' }).click();
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: 'docs/screenshots/presentation.png' });
await desktop.keyboard.press('Escape');
await desktop.waitForTimeout(400);

await desktop.locator('.topbar-right > .btn-primary').click();
await desktop.waitForSelector('.share-qr img');
await desktop.waitForTimeout(600);
await desktop.screenshot({ path: 'docs/screenshots/share.png' });
await desktop.locator('.modal-head .icon-btn').click();
await desktop.waitForTimeout(300);

const day = await newPage({ width: 1440, height: 900, theme: 'light' });
await day.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
await day.waitForSelector('.dashboard');
await day.waitForTimeout(900);
await day.screenshot({ path: 'docs/screenshots/dashboard-day.png' });
await day.getByRole('button', { name: /Abrir tablero/i }).first().click();
await day.waitForSelector('.board-shell');
await day.waitForTimeout(1800);
try {
  await day.locator('.toast').waitFor({ state: 'detached', timeout: 3000 });
} catch {}
await day.screenshot({ path: 'docs/screenshots/board-day.png' });

const mobile = await newPage({ width: 390, height: 844, theme: 'dark', mobile: true });
await mobile.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
await mobile.waitForSelector('.dashboard');
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: 'docs/screenshots/dashboard-mobile.png' });
await mobile.getByRole('button', { name: /Abrir tablero/i }).first().click();
await mobile.waitForSelector('.board-shell');
await mobile.waitForTimeout(1600);
try {
  await mobile.locator('.toast').waitFor({ state: 'detached', timeout: 7000 });
} catch {}
await mobile.waitForTimeout(300);
await mobile.screenshot({ path: 'docs/screenshots/board-mobile.png' });
await mobile.locator('.mobile-more').click();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: 'docs/screenshots/board-mobile-tools.png' });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
