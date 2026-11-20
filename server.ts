import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { seedDemoData } from './server/db/seed.ts';
import authRoutes from './server/routes/authRoutes.ts';
import patientsRoutes from './server/routes/patientsRoutes.ts';
import appointmentsRoutes from './server/routes/appointmentsRoutes.ts';
import clinicalRoutes from './server/routes/clinicalRoutes.ts';
import billingAndReportsRoutes from './server/routes/billingAndReportsRoutes.ts';

async function startServer() {
  // Initialize SQLite relational database & seed demo clinic records if empty
  seedDemoData();

  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use(cookieParser());

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clarity-dental-dcms' });
  });

  // API Routers
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use('/api/appointments', appointmentsRoutes);
  app.use('/api', clinicalRoutes);
  app.use('/api', billingAndReportsRoutes);

  // API 404 handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClarityDental DCMS running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ClarityDental server:', err);
  process.exit(1);
});
