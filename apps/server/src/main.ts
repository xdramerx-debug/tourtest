import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { ScoreAction, Tournament, Player } from '@csl/core';
import { Projection } from '@csl/sync';
import { buildFixtureTournament } from '@csl/testing';
import { ActionJournal } from './store';

const PORT = Number(process.env.PORT ?? 8787);
const HEARTBEAT_MS = 15_000;
// Контроль частоты (NFR §6): мягкий лимит на пост actions с одного IP.
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 120;
const hits = new Map<string, { n: number; at: number }>();

interface Room {
  tournament: Tournament;
  projection: Projection;
  seq: number;
  clients: Set<ServerResponse>;
  serverTs: number;
}

const journal = new ActionJournal();
const rooms = new Map<string, Room>();

/** Демо-профиль: турнир создаётся по запросу (детерминированный фикстурный состав). */
function roomFor(tid: string): Room {
  let room = rooms.get(tid);
  if (room) return room;
  const tournament = buildFixtureTournament({
    players: Number(process.env.CSL_PLAYERS ?? 48), format: 'stroke', rounds: 1, flights: 4, seed: 11,
  });
  tournament.id = tid;
  tournament.status = 'live';
  const projection = new Projection();
  let seq = 0;
  for (const { action, serverTs } of journal.all(tid)) {
    projection.apply(action, serverTs);
    seq += 1;
  }
  room = { tournament, projection, seq, clients: new Set(), serverTs: Date.now() };
  rooms.set(tid, room);
  return room;
}

function send(res: ServerResponse, code: number, body: unknown, headers: Record<string, string> = {}) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    ...headers,
  });
  res.end(data);
}

async function body(res: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of res) chunks.push(c as Buffer);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

function push(room: Room, event: string, data: unknown, id: number) {
  const payload = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of room.clients) {
    try { c.write(payload); } catch { room.clients.delete(c); }
  }
}

function rateOk(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > RATE_WINDOW_MS) { hits.set(ip, { n: 1, at: now }); return true; }
  h.n += 1;
  return h.n <= RATE_MAX;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const ip = req.socket.remoteAddress ?? 'anon';
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (url.pathname === '/healthz') return send(res, 200, { ok: true, rooms: rooms.size, ts: Date.now() });
  if (!rateOk(ip)) return send(res, 429, { ok: false, error: 'rate_limited' });

  const m = url.pathname.match(/^\/api\/t\/([\w-]+)\/(snapshot|stream|actions|join|audit)$/);
  if (!m) return send(res, 404, { ok: false, error: 'not_found' });
  const [, tid, ep] = m as unknown as [string, string, string];
  const room = roomFor(tid);

  if (ep === 'snapshot' && req.method === 'GET') {
    return send(res, 200, {
      tournament: room.tournament,
      projection: room.projection.snapshot(),
      seq: room.seq,
    });
  }

  if (ep === 'join' && req.method === 'POST') {
    const b = (await body(req)) as { name?: string; code?: string } | null;
    if (!b?.name || b.name.trim().length < 2) return send(res, 422, { ok: false, error: 'invalid_name' });
    const pid = `s-${randomUUID().slice(0, 8)}`;
    const player: Player = { id: pid, name: b.name.trim(), hi: 18 };
    room.tournament.players[pid] = player;
    room.tournament.entries.push({ playerId: pid, teeSetKey: 'mens', status: 'active' });
    return send(res, 200, { ok: true, playerId: pid, joinCode: room.tournament.joinCode });
  }

  if (ep === 'audit' && req.method === 'GET') {
    return send(res, 200, { audit: room.projection.audit.slice(-200) });
  }

  if (ep === 'actions' && req.method === 'POST') {
    const b = (await body(req)) as { batch?: ScoreAction[] } | null;
    if (!b?.batch?.length) return send(res, 422, { ok: false, error: 'empty_batch' });
    if (b.batch.length > 50) return send(res, 422, { ok: false, error: 'batch_too_large' });
    const applied: string[] = [];
    const accepted: ScoreAction[] = [];
    for (const action of b.batch) {
      const serverTs = Date.now();
      const r = journal.append(tid, action, serverTs);
      const audit = room.projection.apply(action, serverTs);
      if (audit.result !== 'duplicate') {
        room.seq += 1;
        applied.push(action.actionId);
        accepted.push(action);
      } else {
        applied.push(action.actionId); // идемпотентно-позитивный ответ (ARCHITECTURE §9)
      }
    }
    if (accepted.length) {
      push(room, 'message', { kind: 'delta', events: accepted, seq: room.seq, serverTs: Date.now() }, room.seq);
    }
    if (applied.length) {
      push(room, 'message', { kind: 'ack', actionIds: applied, seq: room.seq, serverTs: Date.now() }, room.seq);
    }
    return send(res, 200, { ok: true, applied });
  }

  if (ep === 'stream' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
      'x-accel-buffering': 'no',
    });
    res.write(`retry: 2000\n\n`);
    room.clients.add(res);
    // докачка с Last-Event-ID (контроль seq, ARCHITECTURE §6.4)
    const lastEventId = Number(req.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? 0);
    if (lastEventId < room.seq) {
      res.write(`id: ${room.seq}\nevent: message\ndata: ${JSON.stringify({
        kind: 'snapshot', tournament: room.tournament, projection: room.projection.snapshot(), seq: room.seq, serverTs: Date.now(),
      })}\n\n`);
    }
    const hb = setInterval(() => {
      try {
        res.write(`id: ${room.seq}\nevent: message\ndata: ${JSON.stringify({ kind: 'heartbeat', seq: room.seq, serverTs: Date.now() })}\n\n`);
      } catch { clearInterval(hb); }
    }, HEARTBEAT_MS);
    req.on('close', () => { clearInterval(hb); room.clients.delete(res); });
    return;
  }

  return send(res, 405, { ok: false, error: 'method_not_allowed' });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[csl-server] :${PORT} (sqlite: ${process.env.CSL_DB ?? 'csl-server.db'})`);
  });
}

export { server, roomFor };
export type { Room };
