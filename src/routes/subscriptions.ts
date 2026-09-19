import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const subscriptions = new Hono<{ Bindings: Bindings }>();

// Get user subscription
subscriptions.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const subscription = await c.env.DB.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(userId, 'active').first();
  
  return c.json({ success: true, subscription });
});

// Create subscription
subscriptions.post('/', async (c) => {
  const { userId, planId, startDate, endDate } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, planId, 'active', startDate, endDate).run();
  
  return c.json({ success: true, subscriptionId: result.meta.last_row_id }, 201);
});

// Get available plans
subscriptions.get('/plans', async (c) => {
  const plans = [
    { id: 1, name: 'Quarterly Pass', price: 300, duration: 'quarter', currency: 'INR' },
    { id: 2, name: 'Annual Merit Pass', price: 1200, duration: 'year', currency: 'INR' },
  ];
  
  return c.json({ success: true, plans });
});

export default subscriptions;
