import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';

import authRoutes from './routes/auth.js';
import ticketRoutes from './routes/tickets.js';
import commentRoutes from './routes/comments.js';
import auditRoutes from './routes/audit.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', commentRoutes);
app.use('/api/tickets', auditRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Frontdesk API',
    company: 'Arvo Systems',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build if it exists
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  console.log(`[Static] Serving frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Start server
async function start() {
  try {
    console.log('[Init] Initializing database...');
    await initDatabase();
    await seedDatabase();

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 Frontdesk Server is running on port ${PORT}`);
      console.log(`🌐 API Endpoint: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('[Fatal] Failed to start Frontdesk server:', err);
    process.exit(1);
  }
}

// Auto-start if directly executed
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  start();
}

export { app, start };
