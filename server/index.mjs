import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startCollabServer } from './collab.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(here, '..', 'dist');
const dataDir = process.env.LIENZO_DATA_DIR
  ? path.resolve(process.env.LIENZO_DATA_DIR)
  : path.resolve(here, '..', 'data', 'boards');
const port = Number(process.env.PORT ?? process.env.LIENZO_PORT ?? 8787);

const info = await startCollabServer({
  port,
  staticDir,
  dataDir,
  version: '0.1.0-alpha.1',
});

const local = `http://localhost:${info.port}`;
console.log('');
console.log('  Lienzo · servidor local');
console.log(`  ➜  ${local}`);
for (const url of info.lan) console.log(`  ➜  ${url}   (red local)`);
console.log(`  ➜  Datos: ${dataDir}`);
console.log('');

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  console.log('\n[lienzo] cerrando sala…');
  await info.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
