import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { runMigrations } from './db/migrations.js';
import { startHeartbeatService } from './services/heartbeatService.js';
import { startCronScheduler } from './services/cronScheduler.js';
import { initWebSocket } from './services/realtimeService.js';
import { startAllPollers } from './services/telegramService.js';
import { startMachineMonitor } from './services/machineMonitorService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || (isProduction ? '5000' : '3001'), 10);

app.use(cors());
app.use('/v1/billing/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);
app.use('/api', routes);

if (isProduction) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

async function start() {
  const server = http.createServer(app);
  initWebSocket(server);
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SquidJob server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
  });

  // Run migrations in background, don't block startup
  (async () => {
    try {
      await runMigrations();
      console.log('Database migrations completed');
      startHeartbeatService();
      startCronScheduler();
      startAllPollers();
      startMachineMonitor();
    } catch (error) {
      console.error('Migration failed (retrying in 10s):', error);
      setTimeout(() => start(), 10000);
    }
  })();
}

start();

export { app };
