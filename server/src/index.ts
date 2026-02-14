import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { runMigrations } from './db/migrations.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use(errorHandler);

async function start() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`SquidJob server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { app };
