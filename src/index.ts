import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { logRequestPerformance, LogLevel } from './utils/logger';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
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
    origin: (origin) => allowedOrigins.includes(origin) ? origin : ''
  })(c, next);
});

// Enhanced logging middleware with performance tracking
app.use('*', async (c, next) => {
  const startTime = Date.now();
  await next();
  const duration = Date.now() - startTime;
  logRequestPerformance(
    c.req.method,
    c.req.path,
    c.res.status,
    duration,
    {
      environment: c.env.ENVIRONMENT,
      userAgent: c.req.header('user-agent'),
    }
  );
});

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

app.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ success: true, service: 'apex-fusion-api', database: 'connected', environment: c.env.ENVIRONMENT, timestamp: new Date().toISOString() });
  } catch {
    return c.json({ success: false, service: 'apex-fusion-api', database: 'disconnected', environment: c.env.ENVIRONMENT, timestamp: new Date().toISOString() }, 503);
  }
});

// R2 Storage health check (admin only)
app.get('/api/admin/r2/health', async (c) => {
  try {
    // Try to list objects in the bucket (limit to 1 for quick check)
    const listed = await c.env.STORAGE.list({ limit: 1 });
    return c.json({
      success: true,
      storage: 'connected',
      bucket: 'apex-fusion-storage',
      environment: c.env.ENVIRONMENT,
      objectCount: listed.objects.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      success: false,
      storage: 'disconnected',
      error: error instanceof Error ? error.message : 'unknown error',
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

import marketingSignup from './routes/marketingSignup';
import auth from './routes/auth';
import admin from './routes/admin';
import videos from './routes/videos';
import catalog from './routes/catalog';
import payments from './routes/payments';
app.route('/api/signup', marketingSignup);
app.route('/api/v1/signup', marketingSignup);
app.route('/api/auth', auth);
app.route('/api/v1/auth', auth);
app.route('/api/admin', admin);
app.route('/api/v1/admin', admin);
app.route('/api/videos', videos);
app.route('/api/payments', payments);
app.route('/api', catalog);

export default app;
