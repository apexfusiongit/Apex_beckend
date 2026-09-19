import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const users = new Hono<{ Bindings: Bindings }>();

// Get user by ID
users.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class, created_at FROM users WHERE id = ?'
  ).bind(id).first();
  
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  return c.json({ success: true, user });
});

// Get user enrollments
users.get('/:id/enrollments', async (c) => {
  const id = c.req.param('id');
  
  const enrollments = await c.env.DB.prepare(
    `SELECT e.*, c.title as course_title, c.class as course_class 
     FROM enrollments e 
     LEFT JOIN courses c ON e.course_id = c.id 
     WHERE e.user_id = ?`
  ).bind(id).all();
  
  return c.json({ success: true, enrollments: enrollments.results });
});

// Get user subscription
users.get('/:id/subscription', async (c) => {
  const id = c.req.param('id');
  
  const subscription = await c.env.DB.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(id, 'active').first();
  
  return c.json({ success: true, subscription });
});

// Create referral
users.post('/:id/referrals', async (c) => {
  const id = c.req.param('id');
  const { code } = await c.req.json();
  
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO referrals (referrer_id, code, status) VALUES (?, ?, ?)'
    ).bind(id, code, 'pending').run();
    
    return c.json({ success: true, referralId: result.meta.last_row_id }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Referral code already exists' }, 400);
  }
});

export default users;
