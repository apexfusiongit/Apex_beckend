import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

type Bindings = {
  DB: D1Database;
  ENVIRONMENT: string;
  CORS_ORIGIN?: string;
  JWT_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', (c, next) => {
  const allowedOrigins = (c.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return cors({
    origin: (origin) => allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  })(c, next);
});
app.use('*', logger());

// Health check
app.get('/', async (c) => {
  try {
    const dbResult = await c.env.DB.prepare('SELECT 1 as health').first();
    const dbHealthy = !!dbResult;
    
    return c.json({ 
      status: 'healthy',
      message: 'Apex Fusion API',
      version: '1.0.0',
      environment: c.env.ENVIRONMENT,
      checks: {
        database: dbHealthy ? 'connected' : 'disconnected',
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({ 
      status: 'unhealthy',
      message: 'Apex Fusion API',
      version: '1.0.0',
      environment: c.env.ENVIRONMENT,
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    }, 503);
  }
});

app.get('/health', (c) => c.json({ success: true, message: 'Backend is running' }));

import marketingSignup from './routes/marketingSignup';
import auth from './routes/auth';
import admin from './routes/admin';
app.route('/api/signup', marketingSignup);
app.route('/api/v1/signup', marketingSignup);
app.route('/api/auth', auth);
app.route('/api/v1/auth', auth);
app.route('/api/admin', admin);
app.route('/api/v1/admin', admin);

export default app;
