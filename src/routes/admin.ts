import { Hono } from 'hono';
import { authMiddleware, requireAdmin, AuthContext } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
};

const admin = new Hono<{ Bindings: Bindings }>();

type AdminContext = AuthContext & { env: Bindings };

// Apply authentication and admin role to all admin routes
admin.use('*', authMiddleware, requireAdmin);

// Dashboard
admin.get('/dashboard', async (c) => {
  const totalUsers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const totalCourses = await c.env.DB.prepare('SELECT COUNT(*) as count FROM courses').first();
  const totalTests = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tests').first();
  const totalPayments = await c.env.DB.prepare('SELECT COUNT(*) as count FROM payments WHERE status = ?').bind('completed').first();
  const activeSubscriptions = await c.env.DB.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE status = ?').bind('active').first();
  
  return c.json({ 
    success: true, 
    analytics: {
      totalUsers: totalUsers?.count || 0,
      totalCourses: totalCourses?.count || 0,
      totalTests: totalTests?.count || 0,
      totalPayments: totalPayments?.count || 0,
      activeSubscriptions: activeSubscriptions?.count || 0,
    }
  });
});

// ============ USERS ============

// Get all users
admin.get('/users', async (c) => {
  const role = c.req.query('role');
  
  let query = 'SELECT id, name, email, phone, role, class, status, created_at FROM users';
  // @ts-ignore
  const params = [];
  
  if (role) {
    query += ' WHERE role = ?';
    // @ts-ignore
    params.push(role);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const users = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({ success: true, users: users.results });
});

// Get user by ID
admin.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class, status, created_at FROM users WHERE id = ?'
  ).bind(id).first();
  
  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  return c.json({ success: true, user });
});

// Update user
admin.put('/users/:id', async (c: AdminContext) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  const { name, email, phone, role, class: studentClass, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE users SET name = ?, email = ?, phone = ?, role = ?, "class" = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, email, phone, role, studentClass, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  return c.json({ success: true, message: 'User updated' });
});

// Delete user
admin.delete('/users/:id', async (c: AdminContext) => {
  const id = c.req.param('id');
  const userId = c.get('userId');
  
  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }
  
  return c.json({ success: true, message: 'User deleted' });
});

// ============ CLASSES ============

// Get all classes
admin.get('/classes', async (c) => {
  const classes = await c.env.DB.prepare(
    'SELECT * FROM classes ORDER BY name'
  ).all();
  
  return c.json({ success: true, classes: classes.results });
});

// Create class
admin.post('/classes', async (c) => {
  const { name, description } = await c.req.json();
  
  if (!name) {
    return c.json({ success: false, error: 'Name is required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO classes (name, description) VALUES (?, ?)'
  ).bind(name, description).run();
  
  return c.json({ success: true, classId: result.meta.last_row_id }, 201);
});

// Update class
admin.put('/classes/:id', async (c) => {
  const id = c.req.param('id');
  const { name, description, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE classes SET name = ?, description = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, description, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Class updated' });
});

// Delete class
admin.delete('/classes/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Class deleted' });
});

// ============ SUBJECTS ============

// Get all subjects
admin.get('/subjects', async (c) => {
  const classId = c.req.query('classId');
  
  let query = 'SELECT s.*, c.name as class_name FROM subjects s LEFT JOIN classes c ON s.class_id = c.id';
  // @ts-ignore
  const params = [];
  
  if (classId) {
    query += ' WHERE s.class_id = ?';
    // @ts-ignore
    params.push(classId);
  }
  
  query += ' ORDER BY s.name';
  
  const subjects = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({ success: true, subjects: subjects.results });
});

// Create subject
admin.post('/subjects', async (c) => {
  const { name, classId, description } = await c.req.json();
  
  if (!name || !classId) {
    return c.json({ success: false, error: 'Name and class ID are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO subjects (name, class_id, description) VALUES (?, ?, ?)'
  ).bind(name, classId, description).run();
  
  return c.json({ success: true, subjectId: result.meta.last_row_id }, 201);
});

// Update subject
admin.put('/subjects/:id', async (c) => {
  const id = c.req.param('id');
  const { name, classId, description, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE subjects SET name = ?, class_id = ?, description = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, classId, description, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Subject not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Subject updated' });
});

// Delete subject
admin.delete('/subjects/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM subjects WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Subject not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Subject deleted' });
});

// ============ COURSES ============

// Get all courses
admin.get('/courses', async (c) => {
  const courses = await c.env.DB.prepare(
    'SELECT c.*, s.name as subject_name, cl.name as class_name, t.name as teacher_name FROM courses c LEFT JOIN subjects s ON c.subject_id = s.id LEFT JOIN classes cl ON c.class = cl.id LEFT JOIN users t ON c.teacher_id = t.id ORDER BY c.created_at DESC'
  ).all();
  
  return c.json({ success: true, courses: courses.results });
});

// Create course
admin.post('/courses', async (c: AdminContext) => {
  const { title, description, subjectId, class: studentClass, thumbnail, price, isFree, teacherId } = await c.req.json();
  
  if (!title || !subjectId || !studentClass) {
    return c.json({ success: false, error: 'Title, subject ID, and class are required' }, 400);
  }
  
  const userId = c.get('userId');
  
  const result = await c.env.DB.prepare(
    'INSERT INTO courses (title, description, subject_id, class, thumbnail, price, is_free, teacher_id, created_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, description, subjectId, studentClass, thumbnail, price ?? 0, isFree ?? 1, teacherId, userId, 'active').run();
  
  return c.json({ success: true, courseId: result.meta.last_row_id }, 201);
});

// Update course
admin.put('/courses/:id', async (c: AdminContext) => {
  const id = c.req.param('id');
  const { title, description, thumbnail, price, isFree, teacherId, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE courses SET title = ?, description = ?, thumbnail = ?, price = ?, is_free = ?, teacher_id = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, thumbnail, price, isFree, teacherId, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Course updated' });
});

// Delete course
admin.delete('/courses/:id', async (c: AdminContext) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM courses WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Course not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Course deleted' });
});

// ============ CHAPTERS ============

// Get chapters for a course
admin.get('/courses/:courseId/chapters', async (c) => {
  const courseId = c.req.param('courseId');
  
  const chapters = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE course_id = ? ORDER BY order_index'
  ).bind(courseId).all();
  
  return c.json({ success: true, chapters: chapters.results });
});

// Create chapter
admin.post('/courses/:courseId/chapters', async (c) => {
  const courseId = c.req.param('courseId');
  const { title, description, orderIndex } = await c.req.json();
  
  if (!title || !orderIndex) {
    return c.json({ success: false, error: 'Title and order index are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO chapters (course_id, title, description, order_index) VALUES (?, ?, ?, ?)'
  ).bind(courseId, title, description, orderIndex).run();
  
  return c.json({ success: true, chapterId: result.meta.last_row_id }, 201);
});

// Update chapter
admin.put('/chapters/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, orderIndex, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE chapters SET title = ?, description = ?, order_index = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, orderIndex, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Chapter updated' });
});

// Delete chapter
admin.delete('/chapters/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM chapters WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Chapter deleted' });
});

// ============ LESSONS ============

// Get lessons for a chapter
admin.get('/chapters/:chapterId/lessons', async (c) => {
  const chapterId = c.req.param('chapterId');
  
  const lessons = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_no'
  ).bind(chapterId).all();
  
  return c.json({ success: true, lessons: lessons.results });
});

// Create lesson
admin.post('/chapters/:chapterId/lessons', async (c) => {
  const chapterId = c.req.param('chapterId');
  const { title, description, videoKey, thumbnail, duration, orderNo } = await c.req.json();
  
  if (!title || !videoKey || !orderNo) {
    return c.json({ success: false, error: 'Title, video key, and order number are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO lessons (chapter_id, title, description, video_key, thumbnail, duration, order_no, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(chapterId, title, description, videoKey, thumbnail, duration, orderNo, 'active').run();
  
  return c.json({ success: true, lessonId: result.meta.last_row_id }, 201);
});

// Update lesson
admin.put('/lessons/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, videoKey, thumbnail, duration, orderNo, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE lessons SET title = ?, description = ?, video_key = ?, thumbnail = ?, duration = ?, order_no = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, videoKey, thumbnail, duration, orderNo, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson updated' });
});

// Delete lesson
admin.delete('/lessons/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Lesson deleted' });
});

// ============ TESTS ============

// Get all tests
admin.get('/tests', async (c) => {
  const courseId = c.req.query('courseId');
  
  let query = 'SELECT t.*, c.title as course_title FROM tests t LEFT JOIN courses c ON t.course_id = c.id';
  // @ts-ignore
  const params = [];
  
  if (courseId) {
    query += ' WHERE t.course_id = ?';
    // @ts-ignore
    params.push(courseId);
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  const tests = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({ success: true, tests: tests.results });
});

// Create test
admin.post('/tests', async (c) => {
  const { courseId, title, description, duration, totalMarks } = await c.req.json();
  
  if (!courseId || !title || !totalMarks) {
    return c.json({ success: false, error: 'Course ID, title, and total marks are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO tests (course_id, title, description, duration, total_marks, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(courseId, title, description, duration, totalMarks, 'active').run();
  
  return c.json({ success: true, testId: result.meta.last_row_id }, 201);
});

// Update test
admin.put('/tests/:id', async (c) => {
  const id = c.req.param('id');
  const { title, description, duration, totalMarks, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE tests SET title = ?, description = ?, duration = ?, total_marks = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, description, duration, totalMarks, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Test not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Test updated' });
});

// Delete test
admin.delete('/tests/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM tests WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Test not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Test deleted' });
});

// ============ QUESTIONS ============

// Get questions for a test
admin.get('/tests/:testId/questions', async (c) => {
  const testId = c.req.param('testId');
  
  const questions = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE test_id = ? ORDER BY order_no'
  ).bind(testId).all();
  
  return c.json({ success: true, questions: questions.results });
});

// Create question
admin.post('/tests/:testId/questions', async (c) => {
  const testId = c.req.param('testId');
  const { question, optionA, optionB, optionC, optionD, correctAnswer, marks, orderNo } = await c.req.json();
  
  if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer || !orderNo) {
    return c.json({ success: false, error: 'All fields are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, marks, order_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(testId, question, optionA, optionB, optionC, optionD, correctAnswer, marks || 1, orderNo).run();
  
  return c.json({ success: true, questionId: result.meta.last_row_id }, 201);
});

// Update question
admin.put('/questions/:id', async (c) => {
  const id = c.req.param('id');
  const { question, optionA, optionB, optionC, optionD, correctAnswer, marks, orderNo } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE questions SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?, marks = ?, order_no = ? WHERE id = ?'
  ).bind(question, optionA, optionB, optionC, optionD, correctAnswer, marks, orderNo, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Question not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Question updated' });
});

// Delete question
admin.delete('/questions/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Question not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Question deleted' });
});

// ============ PAYMENTS ============

// Get all payments
admin.get('/payments', async (c) => {
  const payments = await c.env.DB.prepare(
    'SELECT p.*, u.name as user_name FROM payments p LEFT JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC'
  ).all();
  
  return c.json({ success: true, payments: payments.results });
});

// Get all referrals
admin.get('/referrals', async (c) => {
  const referrals = await c.env.DB.prepare(
    `SELECT r.*, ref.name as referrer_name, refu.name as referred_user_name 
     FROM referrals r 
     LEFT JOIN users ref ON r.referrer_id = ref.id 
     LEFT JOIN users refu ON r.referred_user_id = refu.id 
     ORDER BY r.created_at DESC`
  ).all();
  
  return c.json({ success: true, referrals: referrals.results });
});

// ============ LIVE CLASSES ============

// Get all live classes
admin.get('/live-classes', async (c) => {
  const classes = await c.env.DB.prepare(
    'SELECT lc.*, u.name as teacher_name FROM live_classes lc LEFT JOIN users u ON lc.teacher_id = u.id ORDER BY lc.start_time DESC'
  ).all();
  
  return c.json({ success: true, classes: classes.results });
});

// Create live class
admin.post('/live-classes', async (c) => {
  const { title, subject, teacherId, startTime, endTime, joinUrl } = await c.req.json();
  
  if (!title || !subject || !startTime || !joinUrl) {
    return c.json({ success: false, error: 'Title, subject, start time, and join URL are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO live_classes (title, subject, teacher_id, start_time, end_time, join_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(title, subject, teacherId, startTime, endTime, joinUrl, 'scheduled').run();
  
  return c.json({ success: true, classId: result.meta.last_row_id }, 201);
});

// Update live class
admin.put('/live-classes/:id', async (c) => {
  const id = c.req.param('id');
  const { title, subject, teacherId, startTime, endTime, joinUrl, status } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE live_classes SET title = ?, subject = ?, teacher_id = ?, start_time = ?, end_time = ?, join_url = ?, status = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(title, subject, teacherId, startTime, endTime, joinUrl, status, id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Live class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Live class updated' });
});

// Delete live class
admin.delete('/live-classes/:id', async (c) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM live_classes WHERE id = ?').bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Live class not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Live class deleted' });
});

// ============ TEACHER ASSIGNMENTS ============

// Assign teacher to course
admin.post('/teacher-courses', async (c: AdminContext) => {
  const { teacherId, courseId } = await c.req.json();
  
  if (!teacherId || !courseId) {
    return c.json({ success: false, error: 'Teacher ID and course ID are required' }, 400);
  }
  
  const userId = c.get('userId');
  
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO teacher_courses (teacher_id, course_id, assigned_by) VALUES (?, ?, ?)'
    ).bind(teacherId, courseId, userId).run();
    
    return c.json({ success: true, assignmentId: result.meta.last_row_id }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Assignment already exists' }, 400);
  }
});

// Remove teacher assignment
admin.delete('/teacher-courses/:id', async (c: AdminContext) => {
  const id = c.req.param('id');
  
  const result = await c.env.DB.prepare('DELETE FROM teacher_courses WHERE id = ?').bind(id).run();
  
  // @ts-ignore
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Assignment not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Assignment removed' });
});

// ============ AUDIT LOGS ============

// Get audit logs
admin.get('/audit-logs', async (c) => {
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  
  const logs = await c.env.DB.prepare(
    'SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();
  
  return c.json({ success: true, logs: logs.results });
});

export default admin;
