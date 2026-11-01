import { chromium } from 'playwright-core';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const errors = [];
const wait = (page, ms) => page.waitForTimeout(ms);
async function toastGone(page) {
  try { await page.locator('.toast').waitFor({ state: 'detached', timeout: 6000 }); } catch {}
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' });
await desktop.addInitScript(() => localStorage.setItem('lienzo:user-name', 'Ismael'));
const page = await desktop.newPage();
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE ${m.text()}`); });

await page.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
await page.waitForSelector('.dashboard');
await wait(page, 1200);
await page.screenshot({ path: 'docs/screenshots/dashboard.png' });

await page.getByRole('button', { name: /Abrir tablero/i }).first().click();
await page.waitForSelector('.board-shell');
await wait(page, 4300);
await toastGone(page);
await page.screenshot({ path: 'docs/screenshots/board.png' });

// A curated note in the empty top-right area.
await page.locator('.toolbar button[aria-label="Nota adhesiva"]').click();
const box = await page.locator('.canvas-surface').boundingBox();
await page.mouse.click(box.x + 1030, box.y + 285);
await wait(page, 350);
await page.keyboard.type('Probar la sala desde el móvil', { delay: 10 });
await page.keyboard.press('Control+Enter');
await wait(page, 900);
await page.locator('.inspector-head .icon-btn').click();
await page.keyboard.press('Escape');
await wait(page, 500);
await page.screenshot({ path: 'docs/screenshots/board-edit.png' });

// Presentation with a clean toast state.
await page.getByRole('button', { name: 'Presentar' }).click();
await wait(page, 900);
await page.screenshot({ path: 'docs/screenshots/presentation.png' });
await page.keyboard.press('Escape');
await wait(page, 500);

// Share / QR.
await page.locator('.topbar-right .btn-primary').click();
await page.waitForSelector('.share-qr img');
await wait(page, 500);
const shareLink = await page.locator('.share-link-value input').inputValue();
await page.screenshot({ path: 'docs/screenshots/share.png' });
await page.locator('.modal-head .icon-btn').click();
await wait(page, 400);

// Templates.
await page.locator('.toolbar button[aria-label="Plantillas"]').click();
await page.waitForSelector('.modal');
await wait(page, 900);
await page.screenshot({ path: 'docs/screenshots/templates.png' });
await page.locator('.modal-head .icon-btn').click();
await wait(page, 300);

// Mobile joins the shared board and adds a note.
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
await mobile.addInitScript(() => localStorage.setItem('lienzo:user-name', 'Móvil de Ismael'));
const mobilePage = await mobile.newPage();
mobilePage.on('pageerror', (e) => errors.push(`MOBILE PAGEERROR ${e.message}`));
mobilePage.on('console', (m) => { if (m.type() === 'error') errors.push(`MOBILE CONSOLE ${m.text()}`); });
await mobilePage.goto(shareLink, { waitUntil: 'networkidle' });
await mobilePage.waitForSelector('.board-shell');
await wait(mobilePage, 3800);
await toastGone(mobilePage);
await mobilePage.locator('.mobile-dock button[aria-label="Nota"]').click();
await mobilePage.touchscreen.tap(210, 330);
await wait(mobilePage, 350);
await mobilePage.keyboard.type('Hola desde el móvil', { delay: 10 });
await mobilePage.keyboard.press('Control+Enter');
await wait(mobilePage, 900);
if (await mobilePage.locator('.inspector-head .icon-btn').count()) {
  await mobilePage.locator('.inspector-head .icon-btn').click();
}
await mobilePage.keyboard.press('Escape');
await wait(mobilePage, 1600);
await mobilePage.screenshot({ path: 'docs/screenshots/board-mobile.png' });
await mobilePage.locator('.mobile-more').click();
await wait(mobilePage, 400);
await mobilePage.screenshot({ path: 'docs/screenshots/board-mobile-tools.png' });
await mobilePage.locator('.mobile-more').click();

// Desktop collaboration view.
await wait(page, 1200);
await toastGone(page);
await page.keyboard.press('Escape');
await wait(page, 500);
await page.screenshot({ path: 'docs/screenshots/collaboration.png' });

console.log('shareLink', shareLink);
console.log('desktop presence', await page.locator('.presence').getAttribute('title'));
console.log('errors', errors.length ? errors : 'none');
await browser.close();
