import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
};

const lessons = new Hono<{ Bindings: Bindings }>();

// Get lesson by ID
lessons.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const lesson = await c.env.DB.prepare(
    'SELECT l.*, c.title as course_title FROM lessons l LEFT JOIN courses c ON l.course_id = c.id WHERE l.id = ?'
  ).bind(id).first();
  
  if (!lesson) {
    return c.json({ success: false, message: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, lesson });
});

// Create lesson (admin only)
lessons.post('/', async (c) => {
  const { courseId, title, description, videoKey, thumbnail, duration, orderNo } = await c.req.json();
  
  if (!courseId || !title || !videoKey || !orderNo) {
    return c.json({ success: false, message: 'Course ID, title, video key, and order number are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO lessons (course_id, title, description, video_key, thumbnail, duration, order_no, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(courseId, title, description, videoKey, thumbnail, duration, orderNo, 'active').run();
  
  return c.json({ success: true, lessonId: result.meta.last_row_id }, 201);
});

// Update lesson (admin only)
lessons.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, videoKey, thumbnail, duration, orderNo, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE lessons SET title = ?, description = ?, video_key = ?, thumbnail = ?, duration = ?, order_no = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, videoKey, thumbnail, duration, orderNo, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, message: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson updated' });
});

// Delete lesson (admin only)
lessons.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare(
    'DELETE FROM lessons WHERE id = ?'
  ).bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, message: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson deleted' });
});

// Get video URL from R2
lessons.get('/:id/video', async (c) => {
  const id = c.req.param('id');
  
  const lesson = await c.env.DB.prepare(
    'SELECT video_key FROM lessons WHERE id = ?'
  ).bind(id).first();
  
  if (!lesson) {
    return c.json({ success: false, message: 'Lesson not found' }, 404);
  }
  
  try {
    const object = await c.env.STORAGE.get(lesson.video_key as string);
    
    if (!object) {
      return c.json({ success: false, message: 'Video not found' }, 404);
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'video/mp4',
      },
    });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to retrieve video' }, 500);
  }
});

export default lessons;
