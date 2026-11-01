import http from 'node:http';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const MAX_BOARD_BYTES = 24 * 1024 * 1024;
const MAX_CLIENTS_PER_ROOM = 40;

function now() {
  return Date.now();
}

export function lanAddresses(port) {
  const result = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        result.push(`http://${entry.address}:${port}`);
      }
    }
  }
  return [...new Set(result)];
}

function send(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // The close event will clean up the socket.
  }
}

function broadcast(room, payload, except = null) {
  for (const client of room.clients) {
    if (client === except) continue;
    send(client, payload);
  }
}

function peersFor(room, socket) {
  return [...room.clients]
    .filter((client) => client !== socket)
    .map((client) => ({
      id: client.meta.id,
      name: client.meta.name,
      color: client.meta.color,
      lastSeen: now(),
    }));
}

function broadcastPeers(room) {
  for (const client of room.clients) {
    send(client, { type: 'peers', peers: peersFor(room, client) });
  }
}

function isBoard(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.items) &&
    Array.isArray(value.comments)
  );
}

function sanitizeBoardId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{4,80}$/.test(id) ? id : null;
}

function applyOps(board, ops) {
  let items = [...board.items];
  let comments = [...board.comments];
  let name = board.name;
  let background = board.background;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.kind === 'upsert' && op.item && typeof op.item.id === 'string') {
      const index = items.findIndex((item) => item.id === op.item.id);
      if (index >= 0) items[index] = op.item;
      else items.push(op.item);
    } else if (op.kind === 'delete' && typeof op.id === 'string') {
      items = items.filter((item) => item.id !== op.id);
      items = items.filter(
        (item) =>
          !(
            item.type === 'connector' &&
            (item.from?.itemId === op.id || item.to?.itemId === op.id)
          ),
      );
    } else if (op.kind === 'meta') {
      if (typeof op.name === 'string' && op.name.trim()) name = op.name;
      if (['dots', 'grid', 'plain'].includes(op.background)) background = op.background;
    } else if (op.kind === 'comments' && Array.isArray(op.comments)) {
      comments = op.comments;
    }
  }
  return { ...board, items, comments, name, background, updatedAt: now() };
}

async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, data, 'utf8');
  await fs.rename(temporary, file);
}

export async function startCollabServer({
  port = 8787,
  staticDir,
  dataDir,
  host = '0.0.0.0',
  version = '0.1.0-alpha.1',
} = {}) {
  const rooms = new Map();
  const emptyTimers = new Map();

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const lan = lanAddresses(port);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, cors);
      response.end();
      return;
    }
    if (pathname === '/api/health' || pathname === '/api/info') {
      response.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          status: 'ok',
          app: 'lienzo',
          version,
          port,
          lan,
          rooms: rooms.size,
          uptime: process.uptime(),
        }),
      );
      return;
    }
    if (pathname === '/api/boards') {
      response.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify(
          [...rooms.values()].map((room) => ({
            id: room.board.id,
            name: room.board.name,
            items: room.board.items.length,
            updatedAt: room.board.updatedAt,
            clients: room.clients.size,
          })),
        ),
      );
      return;
    }
    const boardMatch = pathname.match(/^\/api\/boards\/([A-Za-z0-9_-]+)$/);
    if (boardMatch) {
      const room = rooms.get(boardMatch[1]);
      let board = room?.board ?? null;
      if (!board && dataDir) {
        try {
          const raw = await fs.readFile(path.join(dataDir, `${boardMatch[1]}.json`), 'utf8');
          const parsed = JSON.parse(raw);
          if (isBoard(parsed)) board = parsed;
        } catch {
          // No persisted board for this id.
        }
      }
      response.writeHead(board ? 200 : 404, {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(board ?? { error: 'not_found' }));
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }

    if (!staticDir || !existsSync(staticDir)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        '<!doctype html><html lang="es"><meta charset="utf-8"><title>Lienzo</title><body style="font-family:system-ui;background:#F4F1E8;color:#16211E;padding:48px"><h1>Lienzo · servidor de sala</h1><p>La sala está activa en el puerto ' +
          port +
          '.</p><p>Genera la app con <code>npm run build</code> y recarga esta página, o abre el servidor de desarrollo de Vite.</p></body></html>',
      );
      return;
    }

    let filePath = path.join(staticDir, pathname);
    const resolved = path.resolve(filePath);
    const root = path.resolve(staticDir);
    if (!resolved.startsWith(root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    try {
      const stat = await fs.stat(resolved);
      if (stat.isDirectory()) filePath = path.join(resolved, 'index.html');
    } catch {
      filePath = path.join(root, 'index.html');
    }
    try {
      const data = await fs.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      response.writeHead(200, {
        'Content-Type': MIME[extension] ?? 'application/octet-stream',
        'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_BOARD_BYTES });

  const persist = (room) => {
    if (room.saveTimer) clearTimeout(room.saveTimer);
    room.saveTimer = setTimeout(async () => {
      room.saveTimer = null;
      if (!dataDir) return;
      try {
        const file = path.join(dataDir, `${room.board.id}.json`);
        await atomicWrite(file, JSON.stringify(room.board));
      } catch (error) {
        console.error('[lienzo] no se pudo guardar el tablero:', error.message);
      }
    }, 500);
  };

  const getOrCreateRoom = async (boardId, snapshot) => {
    const existing = rooms.get(boardId);
    if (existing) return existing;
    let board = snapshot;
    if (!board && dataDir) {
      try {
        const raw = await fs.readFile(path.join(dataDir, `${boardId}.json`), 'utf8');
        const parsed = JSON.parse(raw);
        if (isBoard(parsed)) board = parsed;
      } catch {
        // No persisted board yet.
      }
    }
    if (!board) {
      board = {
        id: boardId,
        name: 'Tablero compartido',
        createdAt: now(),
        updatedAt: now(),
        items: [],
        comments: [],
        background: 'dots',
      };
    }
    const room = {
      board,
      clients: new Set(),
      saveTimer: null,
      emptyTimer: null,
    };
    rooms.set(boardId, room);
    if (emptyTimers.has(boardId)) {
      clearTimeout(emptyTimers.get(boardId));
      emptyTimers.delete(boardId);
    }
    return room;
  };

  wss.on('connection', (socket, request) => {
    socket.isAlive = true;
    socket.meta = null;
    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('error', () => {
      // Ignore socket-level errors; close handles cleanup.
    });

    socket.on('message', async (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        send(socket, { type: 'error', message: 'Mensaje inválido.' });
        return;
      }
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'join') {
        if (socket.meta) return;
        const boardId = sanitizeBoardId(message.boardId);
        if (!boardId) {
          send(socket, { type: 'error', message: 'Tablero inválido.' });
          socket.close();
          return;
        }
        const snapshot =
          isBoard(message.snapshot) && message.snapshot.id === boardId
            ? message.snapshot
            : null;
        const room = await getOrCreateRoom(boardId, snapshot);
        if (room.clients.size >= MAX_CLIENTS_PER_ROOM) {
          send(socket, { type: 'error', message: 'La sala está llena.' });
          socket.close();
          return;
        }
        if (snapshot && room.clients.size === 0 && room.board.items.length === 0) {
          room.board = { ...snapshot, updatedAt: now() };
          persist(room);
        }
        if (room.emptyTimer) {
          clearTimeout(room.emptyTimer);
          room.emptyTimer = null;
        }
        const user = message.user && typeof message.user === 'object' ? message.user : {};
        socket.meta = {
          id: typeof user.id === 'string' ? user.id.slice(0, 64) : `guest-${now()}`,
          name: typeof user.name === 'string' ? user.name.slice(0, 60) : 'Invitado',
          color: typeof user.color === 'string' ? user.color.slice(0, 24) : '#0E5B4F',
          boardId,
        };
        room.clients.add(socket);
        send(socket, {
          type: 'welcome',
          board: room.board,
          peers: peersFor(room, socket),
        });
        broadcast(
          room,
          {
            type: 'joined',
            peer: {
              id: socket.meta.id,
              name: socket.meta.name,
              color: socket.meta.color,
              lastSeen: now(),
            },
          },
          socket,
        );
        console.log(
          `[lienzo] ${socket.meta.name} entró en "${room.board.name}" (${room.clients.size} en sala)`,
        );
        return;
      }

      if (!socket.meta) return;
      const room = rooms.get(socket.meta.boardId);
      if (!room) return;

      if (message.type === 'ops') {
        if (!Array.isArray(message.ops)) return;
        room.board = applyOps(room.board, message.ops);
        broadcast(room, { type: 'ops', ops: message.ops, from: socket.meta.id }, socket);
        persist(room);
        return;
      }
      if (message.type === 'cursor') {
        if (typeof message.x !== 'number' || typeof message.y !== 'number') return;
        broadcast(
          room,
          {
            type: 'cursor',
            id: socket.meta.id,
            x: message.x,
            y: message.y,
          },
          socket,
        );
        return;
      }
      if (message.type === 'profile') {
        if (typeof message.name === 'string' && message.name.trim()) {
          socket.meta.name = message.name.slice(0, 60);
        }
        if (typeof message.color === 'string') socket.meta.color = message.color.slice(0, 24);
        broadcastPeers(room);
        return;
      }
      if (message.type === 'ping') {
        send(socket, { type: 'pong' });
      }
    });

    socket.on('close', () => {
      if (!socket.meta) return;
      const room = rooms.get(socket.meta.boardId);
      if (!room) return;
      room.clients.delete(socket);
      broadcast(room, { type: 'left', peerId: socket.meta.id });
      console.log(
        `[lienzo] ${socket.meta.name} salió de "${room.board.name}" (${room.clients.size} en sala)`,
      );
      if (room.clients.size === 0) {
        persist(room);
        room.emptyTimer = setTimeout(() => {
          if (room.clients.size === 0) {
            rooms.delete(room.board.id);
            emptyTimers.delete(room.board.id);
          }
        }, 15 * 60 * 1000);
        emptyTimers.set(room.board.id, room.emptyTimer);
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        socket.terminate();
      }
    }
  }, 30000);

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('error', onError);
      wss.removeListener('error', onError);
      reject(error);
    };
    server.once('error', onError);
    wss.once('error', onError);
    server.listen(port, host, () => {
      server.removeListener('error', onError);
      wss.removeListener('error', onError);
      resolve();
    });
  }).catch((error) => {
    clearInterval(heartbeat);
    try {
      wss.close();
    } catch {
      // The WebSocket server may never have started.
    }
    try {
      server.close();
    } catch {
      // The HTTP server may never have started.
    }
    throw error;
  });

  wss.on('error', (error) => {
    console.error('[lienzo] error de WebSocket:', error.message);
  });

  const actualPort = server.address().port;
  return {
    server,
    wss,
    port: actualPort,
    lan: lanAddresses(actualPort),
    version,
    rooms,
    close: async () => {
      clearInterval(heartbeat);
      for (const room of rooms.values()) {
        if (room.saveTimer) clearTimeout(room.saveTimer);
        if (dataDir) {
          try {
            await atomicWrite(
              path.join(dataDir, `${room.board.id}.json`),
              JSON.stringify(room.board),
            );
          } catch {
            // Best effort on shutdown.
          }
        }
      }
      for (const client of wss.clients) client.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export const currentFile = fileURLToPath(import.meta.url);
