import { chromium } from 'playwright-core';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const errors = [];

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
  locale: 'es-ES',
});
await desktop.addInitScript(() => localStorage.setItem('lienzo:user-name', 'Ismael'));
const page = await desktop.newPage();
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`);
});

const readBoards = async () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('keyval', 'readonly');
          const get = tx.objectStore('keyval').get('lienzo:boards:v1');
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        };
      }),
  );
const currentBoard = async () => {
  const boards = await readBoards();
  const id = (new URL(page.url())).hash.replace('#/b/', '');
  return boards.find((board) => board.id === id);
};
const wait = (ms) => page.waitForTimeout(ms);

await page.goto('http://127.0.0.1:8787', { waitUntil: 'networkidle' });
await page.waitForSelector('.dashboard');
await page.getByRole('button', { name: /Abrir tablero/i }).first().click();
await page.waitForSelector('.board-shell');
await wait(1000);
let board = await currentBoard();
assert.equal(board.items.length, 21, 'welcome board should start with 21 items');
console.log('✓ tablero inicial', board.items.length, 'elementos');

// Add a sticky note.
await page.locator('.toolbar button[aria-label="Nota adhesiva"]').click();
const canvas = page.locator('.canvas-surface');
const box = await canvas.boundingBox();
await page.mouse.click(box.x + 560, box.y + 720);
await wait(350);
await page.keyboard.type('E2E: sincronización en red local', { delay: 8 });
await page.keyboard.press('Control+Enter');
await wait(800);
board = await currentBoard();
assert.ok(board.items.some((item) => item.text === 'E2E: sincronización en red local'));
console.log('✓ nota creada y guardada');

// Undo twice, then redo twice.
await page.keyboard.press('Control+z');
await wait(250);
await page.keyboard.press('Control+z');
await wait(700);
board = await currentBoard();
assert.ok(!board.items.some((item) => item.text === 'E2E: sincronización en red local'));
console.log('✓ deshacer');
await page.keyboard.press('Control+Shift+z');
await wait(250);
await page.keyboard.press('Control+Shift+z');
await wait(700);
board = await currentBoard();
assert.ok(board.items.some((item) => item.text === 'E2E: sincronización en red local'));
console.log('✓ rehacer');

// Add a shape.
await page.locator('.toolbar button[aria-label="Forma"]').click();
await page.mouse.move(box.x + 420, box.y + 660);
await page.mouse.down();
await page.mouse.move(box.x + 640, box.y + 780, { steps: 8 });
await page.mouse.up();
await wait(700);
board = await currentBoard();
assert.ok(board.items.some((item) => item.type === 'shape'));
console.log('✓ forma creada');

// Add a comment.
await page.locator('.toolbar button[aria-label="Comentario"]').click();
await page.mouse.click(box.x + 760, box.y + 250);
await page.waitForSelector('.comment-composer textarea');
await page.locator('.comment-composer textarea').fill('Revisar este bloque antes del viernes.');
await page.getByRole('button', { name: 'Publicar' }).click();
await wait(600);
board = await currentBoard();
assert.equal(board.comments.length, 1);
console.log('✓ comentario creado');

// Presentation.
await page.getByRole('button', { name: 'Presentar' }).click();
await page.waitForSelector('.presentation-bar');
assert.ok(await page.locator('.presentation-bar').isVisible());
await page.keyboard.press('Escape');
await page.waitForSelector('.presentation-bar', { state: 'detached' });
console.log('✓ presentación');

// Share + QR.
await page.locator('.topbar-right .btn-primary').click();
await page.waitForSelector('.share-qr img');
const shareLink = await page.locator('.share-link-value input').inputValue();
assert.ok(shareLink.includes('#/b/'));
await page.screenshot({ path: 'docs/screenshots/share.png' });
await page.locator('.modal-head .icon-btn').click();
await wait(300);
console.log('✓ enlace de sala', shareLink);

// Export PNG download.
await page.locator('button[aria-label="Exportar"]').click();
const downloadPromise = page.waitForEvent('download');
await page.getByRole('menuitem', { name: /Imagen PNG/i }).click();
const download = await downloadPromise;
const downloadPath = await download.path();
const size = downloadPath ? fs.statSync(downloadPath).size : 0;
assert.ok(size > 1000, 'PNG should not be empty');
console.log('✓ PNG exportado', download.suggestedFilename(), size, 'bytes');

// Service worker + manifest.
const pwa = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
  return { registration: Boolean(registration), manifest };
});
assert.ok(pwa.registration && pwa.manifest);
console.log('✓ PWA', pwa);

// Mobile client opens the shared board.
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
await mobile.addInitScript(() => localStorage.setItem('lienzo:user-name', 'Móvil de Ismael'));
const mobilePage = await mobile.newPage();
mobilePage.on('pageerror', (error) => errors.push(`MOBILE PAGEERROR ${error.message}`));
mobilePage.on('console', (message) => {
  if (message.type() === 'error') errors.push(`MOBILE CONSOLE ${message.text()}`);
});
await mobilePage.goto(shareLink, { waitUntil: 'networkidle' });
await mobilePage.waitForSelector('.board-shell');
await wait(1200);
assert.equal(await mobilePage.locator('.board-title-input').inputValue(), 'Bienvenido a Lienzo');
console.log('✓ móvil abrió el tablero compartido');

// Add a note from mobile.
await mobilePage.locator('.mobile-dock button[aria-label="Nota"]').click();
await mobilePage.touchscreen.tap(210, 300);
await mobilePage.waitForTimeout(400);
await mobilePage.keyboard.type('Hola desde el móvil, en tiempo real.', { delay: 8 });
await mobilePage.keyboard.press('Control+Enter');
await wait(1600);

// Desktop receives the mobile note.
const presenceTitle = await page.locator('.presence').getAttribute('title');
assert.ok(presenceTitle && /2 personas/.test(presenceTitle), `presence was ${presenceTitle}`);
board = await currentBoard();
assert.ok(board.items.some((item) => item.text === 'Hola desde el móvil, en tiempo real.'));
console.log('✓ tiempo real entre escritorio y móvil', presenceTitle);

// Server is authoritative for both notes.
const serverBoard = await page.evaluate(async (link) => {
  const id = link.split('#/b/')[1];
  const response = await fetch(`/api/boards/${id}`);
  return response.json();
}, shareLink);
assert.ok(serverBoard.items.some((item) => item.text === 'E2E: sincronización en red local'));
assert.ok(serverBoard.items.some((item) => item.text === 'Hola desde el móvil, en tiempo real.'));
console.log('✓ servidor de sala con ambos cambios');

// Capture collaboration state.
await page.keyboard.press('Escape');
await wait(500);
await page.screenshot({ path: 'docs/screenshots/e2e-collaboration.png' });
await mobilePage.screenshot({ path: 'docs/screenshots/e2e-mobile.png' });

await browser.close();
console.log('ERRORS', errors.length ? errors : 'none');
assert.equal(errors.length, 0, 'there should be no browser errors');
console.log('E2E OK');
