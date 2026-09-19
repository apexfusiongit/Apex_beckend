import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const teachers = new Hono<{ Bindings: Bindings }>();

// Get teacher dashboard
teachers.get('/dashboard/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'teacher').first();
  
  if (!user) {
    return c.json({ success: false, error: 'Teacher not found' }, 404);
  }
  
  return c.json({ success: true, user });
});

// Get teacher courses
teachers.get('/courses/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const courses = await c.env.DB.prepare(
    'SELECT * FROM courses WHERE teacher_id = ?'
  ).bind(userId).all();
  
  return c.json({ success: true, courses: courses.results });
});

export default teachers;
