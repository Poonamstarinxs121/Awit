import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { pool } from '../db/index.js';
import type { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'squidjob-dev-secret-change-in-production';

const SUPPORTED_CHANNELS = new Set(['tasks', 'activity', 'agents', 'notifications', 'standups']);

interface AuthenticatedSocket extends WebSocket {
  tenantId: string;
  userId: string;
  subscriptions: Set<string>;
  isAlive: boolean;
}

let wss: WebSocketServer;
let heartbeatInterval: ReturnType<typeof setInterval>;

function authenticateConnection(req: IncomingMessage): JwtPayload | null {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function broadcastToTenant(tenantId: string, channel: string, data: unknown) {
  if (!wss) return;
  for (const client of wss.clients) {
    const authClient = client as AuthenticatedSocket;
    if (
      authClient.tenantId === tenantId &&
      authClient.subscriptions.has(channel) &&
      authClient.readyState === WebSocket.OPEN
    ) {
      authClient.send(JSON.stringify({ type: 'event', channel, data }));
    }
  }
}

async function setupPgListener() {
  const notifyClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await notifyClient.connect();
    await notifyClient.query('LISTEN squidjob_events');
    notifyClient.on('notification', (msg) => {
      if (msg.channel === 'squidjob_events' && msg.payload) {
        try {
          const event = JSON.parse(msg.payload);
          broadcastToTenant(event.tenantId, event.channel, event.data);
        } catch (err) {
          console.error('Failed to parse PG notification payload:', err);
        }
      }
    });
    notifyClient.on('error', (err) => {
      console.error('PG LISTEN client error:', err);
    });
    console.log('PG LISTEN connected for squidjob_events');
  } catch (err) {
    console.error('Failed to setup PG LISTEN:', err);
  }
}

export function initWebSocket(server: import('http').Server): void {
  wss = new WebSocketServer({ server, path: '/v1/realtime' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const payload = authenticateConnection(req);
    if (!payload) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const socket = ws as AuthenticatedSocket;
    socket.tenantId = payload.tenantId;
    socket.userId = payload.userId;
    socket.subscriptions = new Set();
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && SUPPORTED_CHANNELS.has(msg.channel)) {
          socket.subscriptions.add(msg.channel);
          socket.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        } else if (msg.type === 'unsubscribe') {
          socket.subscriptions.delete(msg.channel);
          socket.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
        }
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    socket.send(JSON.stringify({ type: 'connected', userId: payload.userId }));
  });

  heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      const authClient = client as AuthenticatedSocket;
      if (!authClient.isAlive) {
        authClient.terminate();
        continue;
      }
      authClient.isAlive = false;
      authClient.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  setupPgListener();

  console.log('WebSocket server initialized on /v1/realtime');
}

export function broadcastEvent(tenantId: string, channel: string, data: unknown): void {
  broadcastToTenant(tenantId, channel, data);
}

export async function emitDatabaseEvent(tenantId: string, channel: string, data: unknown): Promise<void> {
  await pool.query("SELECT pg_notify('squidjob_events', $1)", [
    JSON.stringify({ tenantId, channel, data }),
  ]);
}
