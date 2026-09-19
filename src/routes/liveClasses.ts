import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const liveClasses = new Hono<{ Bindings: Bindings }>();

// Get all live classes
liveClasses.get('/', async (c) => {
  const classes = await c.env.DB.prepare(
    'SELECT * FROM live_classes WHERE status = ? ORDER BY start_time ASC'
  ).bind('scheduled').all();
  
  return c.json({ success: true, classes: classes.results });
});

// Get live class by ID
liveClasses.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const liveClass = await c.env.DB.prepare(
    'SELECT * FROM live_classes WHERE id = ?'
  ).bind(id).first();
  
  if (!liveClass) {
    return c.json({ success: false, error: 'Live class not found' }, 404);
  }
  
  return c.json({ success: true, class: liveClass });
});

// Create live class (admin/teacher)
liveClasses.post('/', async (c) => {
  const { title, subject, teacherId, startTime, endTime, joinUrl } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO live_classes (title, subject, teacher_id, start_time, end_time, join_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, subject, teacherId, startTime, endTime, joinUrl, 'scheduled').run();
  
  return c.json({ success: true, classId: result.meta.last_row_id }, 201);
});

export default liveClasses;
