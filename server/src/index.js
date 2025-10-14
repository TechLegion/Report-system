import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import hodRouter from './routes/hod.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

const app = express();

// CORS: allow same-origin in production and known dev origins; no credentials needed
const allowedOrigins = [
  config.clientOrigin,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin or curl
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: false
}));
app.use(express.json());

// Static serving for uploaded files
app.use('/uploads', express.static(config.uploadDir));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/hod', hodRouter);

// Serve frontend (index.html, style.css, main.js) at root
app.use('/', express.static(projectRoot, { index: 'index.html' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

