import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const subjects = new Hono<{ Bindings: Bindings }>();

// Get all subjects
subjects.get('/', async (c) => {
  const subjects = await c.env.DB.prepare(
    'SELECT * FROM subjects ORDER BY class, name'
  ).all();
  
  return c.json({ success: true, subjects: subjects.results });
});

// Get subjects by class
subjects.get('/class/:class', async (c) => {
  const studentClass = c.req.param('class');
  
  const subjects = await c.env.DB.prepare(
    'SELECT * FROM subjects WHERE class = ? ORDER BY name'
  ).bind(studentClass).all();
  
  return c.json({ success: true, subjects: subjects.results });
});

// Create subject (admin only)
subjects.post('/', async (c) => {
  const { name, class: studentClass } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO subjects (name, class) VALUES (?, ?)'
  ).bind(name, studentClass).run();
  
  return c.json({ success: true, subjectId: result.meta.last_row_id }, 201);
});

export default subjects;
