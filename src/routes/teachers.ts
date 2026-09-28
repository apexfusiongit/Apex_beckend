import { Hono } from 'hono';
import { authMiddleware, requireTeacher } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
};

const teachers = new Hono<{ Bindings: Bindings }>();

// Apply authentication and teacher role to all teacher routes
teachers.use('*', authMiddleware, requireTeacher);

// Helper function to verify teacher is assigned to a course
async function verifyTeacherAssignment(db: D1Database, teacherId: number, courseId: number): Promise<boolean> {
  const assignment = await db.prepare(
    'SELECT * FROM teacher_courses WHERE teacher_id = ? AND course_id = ?'
  ).bind(teacherId, courseId).first();
  
  return !!assignment;
}

// Dashboard
teachers.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  
  // Get teacher's assigned courses count
  const assignedCourses = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM teacher_courses WHERE teacher_id = ?'
  ).bind(userId).first();
  
  // Get total students in assigned courses
  const totalStudents = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT e.user_id) as count 
     FROM teacher_courses tc 
     LEFT JOIN enrollments e ON tc.course_id = e.course_id 
     WHERE tc.teacher_id = ?`
  ).bind(userId).first();
  
  // Get recent live classes
  const liveClasses = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM live_classes WHERE teacher_id = ? AND status = ?'
  ).bind(userId, 'scheduled').first();
  
  return c.json({ 
    success: true, 
    analytics: {
      assignedCourses: assignedCourses?.count || 0,
      totalStudents: totalStudents?.count || 0,
      scheduledLiveClasses: liveClasses?.count || 0,
    }
  });
});

// ============ COURSES ============

// Get assigned courses
teachers.get('/courses', async (c) => {
  const userId = c.get('userId');
  
  const courses = await c.env.DB.prepare(
    `SELECT c.*, s.name as subject_name, cl.name as class_name 
     FROM teacher_courses tc 
     LEFT JOIN courses c ON tc.course_id = c.id 
     LEFT JOIN subjects s ON c.subject_id = s.id 
     LEFT JOIN classes cl ON c.class = cl.id 
     WHERE tc.teacher_id = ? 
     ORDER BY c.created_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, courses: courses.results });
});

// Get assigned course by ID
teachers.get('/courses/:id', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('id');
  
  // Verify assignment
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, parseInt(courseId));
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const course = await c.env.DB.prepare(
    `SELECT c.*, s.name as subject_name, cl.name as class_name 
     FROM courses c 
     LEFT JOIN subjects s ON c.subject_id = s.id 
     LEFT JOIN classes cl ON c.class = cl.id 
     WHERE c.id = ?`
  ).bind(courseId).first();
  
  if (!course) {
    return c.json({ success: false, error: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, course });
});

// ============ CHAPTERS ============

// Get chapters for assigned course
teachers.get('/courses/:courseId/chapters', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('courseId');
  
  // Verify assignment
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, parseInt(courseId));
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const chapters = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE course_id = ? ORDER BY order_index'
  ).bind(courseId).all();
  
  return c.json({ success: true, chapters: chapters.results });
});

// Create chapter for assigned course
teachers.post('/courses/:courseId/chapters', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('courseId');
  const { title, description, orderIndex } = await c.req.json();
  
  // Verify assignment
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, parseInt(courseId));
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  if (!title || !orderIndex) {
    return c.json({ success: false, error: 'Title and order index are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO chapters (course_id, title, description, order_index) VALUES (?, ?, ?, ?)'
  ).bind(courseId, title, description, orderIndex).run();
  
  return c.json({ success: true, chapterId: result.meta.last_row_id }, 201);
});

// Update chapter
teachers.put('/chapters/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, description, orderIndex, status } = await c.req.json();
  
  // Verify teacher owns the course this chapter belongs to
  const chapter = await c.env.DB.prepare(
    'SELECT course_id FROM chapters WHERE id = ?'
  ).bind(id).first();
  
  if (!chapter) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, chapter.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'UPDATE chapters SET title = ?, description = ?, order_index = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, orderIndex, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Chapter updated' });
});

// Delete chapter
teachers.delete('/chapters/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  // Verify teacher owns the course this chapter belongs to
  const chapter = await c.env.DB.prepare(
    'SELECT course_id FROM chapters WHERE id = ?'
  ).bind(id).first();
  
  if (!chapter) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, chapter.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const result = await c.env.DB.prepare('DELETE FROM chapters WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Chapter deleted' });
});

// ============ LESSONS ============

// Get lessons for chapter
teachers.get('/chapters/:chapterId/lessons', async (c) => {
  const userId = c.get('userId');
  const chapterId = c.req.param('chapterId');
  
  // Verify teacher owns the course this chapter belongs to
  const chapter = await c.env.DB.prepare(
    'SELECT course_id FROM chapters WHERE id = ?'
  ).bind(chapterId).first();
  
  if (!chapter) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, chapter.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const lessons = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_no'
  ).bind(chapterId).all();
  
  return c.json({ success: true, lessons: lessons.results });
});

// Create lesson
teachers.post('/chapters/:chapterId/lessons', async (c) => {
  const userId = c.get('userId');
  const chapterId = c.req.param('chapterId');
  const { title, description, videoKey, thumbnail, duration, orderNo } = await c.req.json();
  
  // Verify teacher owns the course this chapter belongs to
  const chapter = await c.env.DB.prepare(
    'SELECT course_id FROM chapters WHERE id = ?'
  ).bind(chapterId).first();
  
  if (!chapter) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, chapter.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  if (!title || !videoKey || !orderNo) {
    return c.json({ success: false, error: 'Title, video key, and order number are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO lessons (chapter_id, title, description, video_key, thumbnail, duration, order_no, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(chapterId, title, description, videoKey, thumbnail, duration, orderNo, 'active').run();
  
  return c.json({ success: true, lessonId: result.meta.last_row_id }, 201);
});

// Update lesson
teachers.put('/lessons/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, description, videoKey, thumbnail, duration, orderNo, status } = await c.req.json();
  
  // Verify teacher owns the course this lesson belongs to
  const lesson = await c.env.DB.prepare(
    'SELECT l.chapter_id, ch.course_id FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.id = ?'
  ).bind(id).first();
  
  if (!lesson) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, lesson.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'UPDATE lessons SET title = ?, description = ?, video_key = ?, thumbnail = ?, duration = ?, order_no = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, videoKey, thumbnail, duration, orderNo, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson updated' });
});

// Delete lesson
teachers.delete('/lessons/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  // Verify teacher owns the course this lesson belongs to
  const lesson = await c.env.DB.prepare(
    'SELECT l.chapter_id, ch.course_id FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.id = ?'
  ).bind(id).first();
  
  if (!lesson) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, lesson.course_id as number);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  const result = await c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson deleted' });
});

// ============ STUDENTS ============

// Get students in assigned courses
teachers.get('/students', async (c) => {
  const userId = c.get('userId');
  
  const students = await c.env.DB.prepare(
    `SELECT DISTINCT u.id, u.name, u.email, u.class, e.enrolled_at 
     FROM teacher_courses tc 
     LEFT JOIN enrollments e ON tc.course_id = e.course_id 
     LEFT JOIN users u ON e.user_id = u.id 
     WHERE tc.teacher_id = ? 
     ORDER BY u.name`
  ).bind(userId).all();
  
  return c.json({ success: true, students: students.results });
});

// Get student progress
teachers.get('/students/:studentId/progress', async (c) => {
  const userId = c.get('userId');
  const studentId = c.req.param('studentId');
  
  // Verify student is enrolled in teacher's assigned courses
  const enrollment = await c.env.DB.prepare(
    `SELECT e.* 
     FROM enrollments e 
     LEFT JOIN teacher_courses tc ON e.course_id = tc.course_id 
     WHERE e.user_id = ? AND tc.teacher_id = ?`
  ).bind(studentId, userId).first();
  
  if (!enrollment) {
    return c.json({ success: false, error: 'Student not enrolled in your courses' }, 403);
  }
  
  const progress = await c.env.DB.prepare(
    `SELECT p.*, l.title as lesson_title, l.course_id 
     FROM progress p 
     LEFT JOIN lessons l ON p.lesson_id = l.id 
     WHERE p.user_id = ? 
     ORDER BY p.updated_at DESC`
  ).bind(studentId).all();
  
  return c.json({ success: true, progress: progress.results });
});

// ============ TESTS ============

// Get tests for assigned courses
teachers.get('/tests', async (c) => {
  const userId = c.get('userId');
  
  const tests = await c.env.DB.prepare(
    `SELECT t.*, c.title as course_title 
     FROM tests t 
     LEFT JOIN teacher_courses tc ON t.course_id = tc.course_id 
     LEFT JOIN courses c ON t.course_id = c.id 
     WHERE tc.teacher_id = ? 
     ORDER BY t.created_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, tests: tests.results });
});

// Create test for assigned course
teachers.post('/tests', async (c) => {
  const userId = c.get('userId');
  const { courseId, title, description, duration, totalMarks } = await c.req.json();
  
  // Verify assignment
  const isAssigned = await verifyTeacherAssignment(c.env.DB, userId, courseId);
  if (!isAssigned) {
    return c.json({ success: false, error: 'Not assigned to this course' }, 403);
  }
  
  if (!courseId || !title || !totalMarks) {
    return c.json({ success: false, error: 'Course ID, title, and total marks are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO tests (course_id, title, description, duration, total_marks, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(courseId, title, description, duration, totalMarks, 'active').run();
  
  return c.json({ success: true, testId: result.meta.last_row_id }, 201);
});

// ============ LIVE CLASSES ============

// Get live classes for teacher
teachers.get('/live-classes', async (c) => {
  const userId = c.get('userId');
  
  const classes = await c.env.DB.prepare(
    'SELECT * FROM live_classes WHERE teacher_id = ? ORDER BY start_time DESC'
  ).bind(userId).all();
  
  return c.json({ success: true, classes: classes.results });
});

// Create live class
teachers.post('/live-classes', async (c) => {
  const userId = c.get('userId');
  const { title, subject, startTime, endTime, joinUrl } = await c.req.json();
  
  if (!title || !subject || !startTime || !joinUrl) {
    return c.json({ success: false, error: 'Title, subject, start time, and join URL are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO live_classes (title, subject, teacher_id, start_time, end_time, join_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, subject, userId, startTime, endTime, joinUrl, 'scheduled').run();
  
  return c.json({ success: true, classId: result.meta.last_row_id }, 201);
});

// Update live class
teachers.put('/live-classes/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { title, subject, startTime, endTime, joinUrl, status } = await c.req.json();
  
  // Verify ownership
  const liveClass = await c.env.DB.prepare(
    'SELECT teacher_id FROM live_classes WHERE id = ?'
  ).bind(id).first();
  
  if (!liveClass || liveClass.teacher_id !== userId) {
    return c.json({ success: false, error: 'Live class not found or not owned by you' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'UPDATE live_classes SET title = ?, subject = ?, start_time = ?, end_time = ?, join_url = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, subject, startTime, endTime, joinUrl, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Live class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Live class updated' });
});

// Delete live class
teachers.delete('/live-classes/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  // Verify ownership
  const liveClass = await c.env.DB.prepare(
    'SELECT teacher_id FROM live_classes WHERE id = ?'
  ).bind(id).first();
  
  if (!liveClass || liveClass.teacher_id !== userId) {
    return c.json({ success: false, error: 'Live class not found or not owned by you' }, 403);
  }
  
  const result = await c.env.DB.prepare('DELETE FROM live_classes WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Live class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Live class deleted' });
});

export default teachers;
