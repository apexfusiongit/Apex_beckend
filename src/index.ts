import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/', (c) => {
  return c.json({ 
    message: 'Apex Fusion API',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT 
  });
});

// Auth routes
import authRoutes from './routes/auth';
app.route('/api/auth', authRoutes);

// Subject routes
import subjectRoutes from './routes/subjects';
app.route('/api/subjects', subjectRoutes);

// Course routes
import courseRoutes from './routes/courses';
app.route('/api/courses', courseRoutes);

// Lesson routes
import lessonRoutes from './routes/lessons';
app.route('/api/lessons', lessonRoutes);

// Progress routes
import progressRoutes from './routes/progress';
app.route('/api/progress', progressRoutes);

// Test routes
import testRoutes from './routes/tests';
app.route('/api/tests', testRoutes);

// AI routes
import aiRoutes from './routes/ai';
app.route('/api/ai', aiRoutes);

// Payment routes
import paymentRoutes from './routes/payments';
app.route('/api/payments', paymentRoutes);

// Subscription routes
import subscriptionRoutes from './routes/subscriptions';
app.route('/api/subscriptions', subscriptionRoutes);

// Referral routes
import referralRoutes from './routes/referrals';
app.route('/api/referrals', referralRoutes);

// Live classes routes
import liveClassRoutes from './routes/liveClasses';
app.route('/api/live-classes', liveClassRoutes);

// Teacher routes
import teacherRoutes from './routes/teachers';
app.route('/api/teachers', teacherRoutes);

// School routes
import schoolRoutes from './routes/schools';
app.route('/api/schools', schoolRoutes);

// Lead routes
import leadRoutes from './routes/leads';
app.route('/api/leads', leadRoutes);

// Admin routes
import adminRoutes from './routes/admin';
app.route('/api/admin', adminRoutes);

// User routes
import userRoutes from './routes/users';
app.route('/api/users', userRoutes);

export default app;
