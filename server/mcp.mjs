#!/usr/bin/env node
/**
 * Servidor MCP local de tiza.
 *
 * Expone herramientas para que un agente lea y dibuje en la pizarra
 * a través de la sala LAN (HTTP + WebSocket). Protocolo: JSON-RPC 2.0
 * por stdio, una línea por mensaje, compatible con MCP.
 *
 *   node server/mcp.mjs
 *   TIZA_SERVER=http://127.0.0.1:8787 node server/mcp.mjs
 */

import readline from 'node:readline';

const SERVER = (process.env.TIZA_SERVER ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const VERSION = '2.0.0';

const COLORS = {
  yellow: '#F6E27A',
  green: '#BFE3C0',
  blue: '#BFD8EA',
  pink: '#F2C4C4',
  sand: '#EADFC8',
};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${SERVER}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(data?.error ?? `HTTP ${response.status}`);
  }
  return data;
}

function stickyItem(args) {
  const color = COLORS[String(args.color ?? 'yellow')] ?? String(args.color ?? COLORS.yellow);
  return {
    id: uid('mcp-sticky'),
    type: 'sticky',
    x: Number(args.x ?? 120),
    y: Number(args.y ?? 120),
    w: Number(args.w ?? 240),
    h: Number(args.h ?? 140),
    text: String(args.text ?? 'Nota del agente'),
    fill: color,
    textColor: '#16211E',
    fontSize: Number(args.fontSize ?? 16),
    author: 'MCP',
    updatedAt: Date.now(),
  };
}

function textItem(args) {
  return {
    id: uid('mcp-text'),
    type: 'text',
    x: Number(args.x ?? 120),
    y: Number(args.y ?? 120),
    w: Number(args.w ?? 360),
    h: Number(args.h ?? 60),
    text: String(args.text ?? 'Texto del agente'),
    fontSize: Number(args.fontSize ?? 26),
    color: String(args.color ?? '#16211E'),
    align: 'left',
    fontWeight: 500,
    fontFamily: 'sans',
    author: 'MCP',
    updatedAt: Date.now(),
  };
}

function frameItem(args) {
  return {
    id: uid('mcp-frame'),
    type: 'frame',
    x: Number(args.x ?? 80),
    y: Number(args.y ?? 80),
    w: Number(args.w ?? 480),
    h: Number(args.h ?? 320),
    title: String(args.title ?? 'Sección del agente'),
    fill: '#FBFAF4',
    author: 'MCP',
    updatedAt: Date.now(),
  };
}

async function draw(boardId, item) {
  return request(`/api/boards/${encodeURIComponent(boardId)}/ops`, {
    method: 'POST',
    body: JSON.stringify({ ops: [{ kind: 'upsert', item }] }),
  });
}

const TOOLS = [
  {
    name: 'tiza_list_boards',
    description: 'Lista las pizarras activas o persistidas en la sala LAN de tiza.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tiza_read_board',
    description: 'Lee una pizarra completa por su id, incluidos objetos y comentarios.',
    inputSchema: {
      type: 'object',
      properties: { boardId: { type: 'string', description: 'Id de la pizarra' } },
      required: ['boardId'],
      additionalProperties: false,
    },
  },
  {
    name: 'tiza_add_sticky',
    description: 'Dibuja una nota adhesiva en la pizarra por la LAN.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
        color: { type: 'string', description: 'yellow, green, blue, pink, sand o un hex' },
      },
      required: ['boardId', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'tiza_add_text',
    description: 'Dibuja un texto suelto en la pizarra.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        fontSize: { type: 'number' },
        color: { type: 'string' },
      },
      required: ['boardId', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'tiza_add_frame',
    description: 'Dibuja un marco o sección con título.',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string' },
        title: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' },
      },
      required: ['boardId', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'tiza_board_text',
    description: 'Extrae el texto legible de una pizarra para resumir o analizar.',
    inputSchema: {
      type: 'object',
      properties: { boardId: { type: 'string' } },
      required: ['boardId'],
      additionalProperties: false,
    },
  },
];

function boardText(board) {
  return (board.items ?? [])
    .map((item) => {
      if (item.type === 'sticky' || item.type === 'text' || item.type === 'shape') {
        return item.text ?? '';
      }
      if (item.type === 'frame') return `# ${item.title ?? ''}`;
      if (item.type === 'markdown' || item.type === 'code') return item.text ?? '';
      if (item.type === 'flashcard') return `P: ${item.front ?? ''}\nR: ${item.back ?? ''}`;
      if (item.type === 'file') return item.name ?? '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

async function callTool(name, args) {
  if (name === 'tiza_list_boards') {
    return request('/api/boards');
  }
  if (name === 'tiza_read_board') {
    return request(`/api/boards/${encodeURIComponent(String(args.boardId))}`);
  }
  if (name === 'tiza_board_text') {
    const board = await request(`/api/boards/${encodeURIComponent(String(args.boardId))}`);
    return { boardId: board.id, name: board.name, text: boardText(board) };
  }
  if (name === 'tiza_add_sticky') {
    const item = stickyItem(args);
    await draw(String(args.boardId), item);
    return { ok: true, boardId: args.boardId, itemId: item.id, type: item.type };
  }
  if (name === 'tiza_add_text') {
    const item = textItem(args);
    await draw(String(args.boardId), item);
    return { ok: true, boardId: args.boardId, itemId: item.id, type: item.type };
  }
  if (name === 'tiza_add_frame') {
    const item = frameItem(args);
    await draw(String(args.boardId), item);
    return { ok: true, boardId: args.boardId, itemId: item.id, type: item.type };
  }
  throw new Error(`Herramienta desconocida: ${name}`);
}

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    fail(null, -32700, 'JSON inválido');
    return;
  }
  const id = message.id ?? null;
  const isNotification = !('id' in message);
  const method = message.method;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: 'tiza-mcp', version: VERSION },
    });
    return;
  }
  if (method === 'notifications/initialized' || isNotification) return;
  if (method === 'ping') {
    reply(id, {});
    return;
  }
  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === 'resources/list') {
    reply(id, { resources: [] });
    return;
  }
  if (method === 'tools/call') {
    const name = message.params?.name;
    const args = message.params?.arguments ?? {};
    callTool(name, args)
      .then((result) => {
        reply(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        });
      })
      .catch((error) => {
        reply(id, {
          content: [{ type: 'text', text: error.message ?? 'Error de tiza MCP' }],
          isError: true,
        });
      });
    return;
  }
  fail(id, -32601, `Método no soportado: ${method}`);
});

process.stderr.write(`[tiza-mcp] escuchando en ${SERVER}\n`);
