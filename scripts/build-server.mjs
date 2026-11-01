import { cp, mkdir, rm } from 'node:fs/promises';

await rm('server-dist', { recursive: true, force: true });
await mkdir('server-dist', { recursive: true });
await cp('server/collab.mjs', 'server-dist/collab.mjs');
await cp('node_modules/ws', 'server-dist/node_modules/ws', { recursive: true });
console.log('server-dist/collab.mjs + ws copied');
