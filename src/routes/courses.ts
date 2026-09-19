import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const courses = new Hono<{ Bindings: Bindings }>();

// Get all courses with optional filters
courses.get('/', async (c) => {
  const classFilter = c.req.query('class');
  const subjectFilter = c.req.query('subject');
  
  let query = 'SELECT c.*, s.name as subject_name FROM courses c LEFT JOIN subjects s ON c.subject_id = s.id WHERE c.status = ?';
  const params: any[] = ['active'];
  
  if (classFilter) {
    query += ' AND c.class = ?';
    params.push(classFilter);
  }
  
  if (subjectFilter) {
    query += ' AND s.name = ?';
    params.push(subjectFilter);
  }
  
  query += ' ORDER BY c.created_at DESC';
  
  const courses = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({ success: true, courses: courses.results });
});

// Get course by ID
courses.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const course = await c.env.DB.prepare(
    'SELECT c.*, s.name as subject_name FROM courses c LEFT JOIN subjects s ON c.subject_id = s.id WHERE c.id = ?'
  ).bind(id).first();
  
  if (!course) {
    return c.json({ success: false, message: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, course });
});

// Get lessons for a course
courses.get('/:id/lessons', async (c) => {
  const id = c.req.param('id');
  
  const lessons = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE course_id = ? AND status = ? ORDER BY order_no'
  ).bind(id, 'active').all();
  
  return c.json({ success: true, lessons: lessons.results });
});

// Enroll in a course
courses.post('/:id/enroll', async (c) => {
  const id = c.req.param('id');
  const { userId } = await c.req.json();
  
  if (!userId) {
    return c.json({ success: false, message: 'User ID is required' }, 400);
  }
  
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO enrollments (user_id, course_id, status) VALUES (?, ?, ?)'
    ).bind(userId, id, 'active').run();
    
    return c.json({ success: true, enrollmentId: result.meta.last_row_id }, 201);
  } catch (error) {
    return c.json({ success: false, message: 'Already enrolled' }, 400);
  }
});

// Create course (admin only)
courses.post('/', async (c) => {
  const { title, description, subjectId, class: studentClass, thumbnail } = await c.req.json();
  
  if (!title || !subjectId || !studentClass) {
    return c.json({ success: false, message: 'Title, subject ID, and class are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO courses (title, description, subject_id, class, thumbnail, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(title, description, subjectId, studentClass, thumbnail, 'active').run();
  
  return c.json({ success: true, courseId: result.meta.last_row_id }, 201);
});

// Update course (admin only)
courses.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, thumbnail, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE courses SET title = ?, description = ?, thumbnail = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, thumbnail, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, message: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Course updated' });
});

// Delete course (admin only)
courses.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare(
    'DELETE FROM courses WHERE id = ?'
  ).bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, message: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Course deleted' });
});

export default courses;
