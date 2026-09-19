import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const schools = new Hono<{ Bindings: Bindings }>();

// Register school
schools.post('/register', async (c) => {
  const { name, email, phone, address } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (name, email, phone, role, class) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, email, phone, 'school', address).run();
  
  return c.json({ success: true, schoolId: result.meta.last_row_id }, 201);
});

// Get school profile
schools.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const school = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  return c.json({ success: true, school });
});

export default schools;
