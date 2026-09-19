import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const progress = new Hono<{ Bindings: Bindings }>();

// Get user progress
progress.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const progress = await c.env.DB.prepare(
    `SELECT p.*, l.title as lesson_title, l.course_id 
     FROM progress p 
     LEFT JOIN lessons l ON p.lesson_id = l.id 
     WHERE p.user_id = ?`
  ).bind(userId).all();
  
  return c.json({ success: true, progress: progress.results });
});

// Get progress for a course
progress.get('/course/:courseId/user/:userId', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.req.param('userId');
  
  const progress = await c.env.DB.prepare(
    `SELECT p.*, l.title as lesson_title, l.order_no 
     FROM progress p 
     LEFT JOIN lessons l ON p.lesson_id = l.id 
     WHERE p.user_id = ? AND l.course_id = ? 
     ORDER BY l.order_no`
  ).bind(userId, courseId).all();
  
  return c.json({ success: true, progress: progress.results });
});

// Update progress
progress.post('/', async (c) => {
  const { userId, lessonId, progressPercent, completed } = await c.req.json();
  
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO progress (user_id, lesson_id, progress_percent, completed, updated_at) 
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, lesson_id) 
       DO UPDATE SET progress_percent = ?, completed = ?, updated_at = datetime('now')`
    ).bind(userId, lessonId, progressPercent, completed, progressPercent, completed).run();
    
    return c.json({ success: true, progressId: result.meta.last_row_id });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update progress' }, 400);
  }
});

export default progress;
