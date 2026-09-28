import { Hono } from 'hono';
import { authMiddleware, requireSchool } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
};

const schools = new Hono<{ Bindings: Bindings }>();

// Apply authentication and school role to all school routes
schools.use('*', authMiddleware, requireSchool);

// Dashboard
schools.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  
  // Get total students in school (students with same school in class field)
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const totalStudents = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = ? AND "class" = ?'
  ).bind('student', schoolName).first();
  
  const totalTeachers = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = ? AND "class" = ?'
  ).bind('teacher', schoolName).first();
  
  return c.json({ 
    success: true, 
    analytics: {
      totalStudents: totalStudents?.count || 0,
      totalTeachers: totalTeachers?.count || 0,
      schoolName,
    }
  });
});

// Register school
schools.post('/register', async (c) => {
  const { name, email, phone, schoolName, address, adminCode } = await c.req.json();
  
  if (!name || !email || !schoolName) {
    return c.json({ success: false, error: 'Name, email, and school name are required' }, 400);
  }
  
  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existingUser) {
    return c.json({ success: false, error: 'Email already registered' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (name, email, phone, role, "class") VALUES (?, ?, ?, ?, ?)'
  ).bind(name, email, phone, 'school', schoolName).run();
  
  return c.json({ success: true, schoolId: result.meta.last_row_id }, 201);
});

// Get school profile
schools.get('/profile', async (c) => {
  const userId = c.get('userId');
  
  const school = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  return c.json({ success: true, school });
});

// Update school profile
schools.put('/profile', async (c) => {
  const userId = c.get('userId');
  const { name, email, phone, address } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'UPDATE users SET name = ?, email = ?, phone = ?, "class" = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, email, phone, address, userId).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Profile updated' });
});

// ============ STUDENTS ============

// Get school students
schools.get('/students', async (c) => {
  const userId = c.get('userId');
  
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const students = await c.env.DB.prepare(
    'SELECT id, name, email, phone, class, created_at FROM users WHERE role = ? AND "class" = ? ORDER BY created_at DESC'
  ).bind('student', schoolName).all();
  
  return c.json({ success: true, students: students.results });
});

// Add student to school
schools.post('/students', async (c) => {
  const userId = c.get('userId');
  const { name, email, phone, class: studentClass, password } = await c.req.json();
  
  if (!name || !email || !password) {
    return c.json({ success: false, error: 'Name, email, and password are required' }, 400);
  }
  
  // Get school name
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existingUser) {
    return c.json({ success: false, error: 'Email already registered' }, 400);
  }
  
  // Hash password
  const { hashPassword } = await import('../utils/password');
  const passwordHash = await hashPassword(password);
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role, "class") VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, email, phone, passwordHash, 'student', schoolName).run();
  
  return c.json({ success: true, studentId: result.meta.last_row_id }, 201);
});

// Update student
schools.put('/students/:id', async (c) => {
  const userId = c.get('userId');
  const studentId = c.req.param('id');
  const { name, email, phone, class: studentClass } = await c.req.json();
  
  // Verify student belongs to school
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const student = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(studentId, 'student').first();
  
  if (!student || student.class !== schoolName) {
    return c.json({ success: false, error: 'Student not found or not in your school' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'UPDATE users SET name = ?, email = ?, phone = ?, "class" = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, email, phone, studentClass, studentId).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Student not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Student updated' });
});

// Delete student
schools.delete('/students/:id', async (c) => {
  const userId = c.get('userId');
  const studentId = c.req.param('id');
  
  // Verify student belongs to school
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const student = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(studentId, 'student').first();
  
  if (!student || student.class !== schoolName) {
    return c.json({ success: false, error: 'Student not found or not in your school' }, 403);
  }
  
  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(studentId).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Student not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Student deleted' });
});

// ============ TEACHERS ============

// Get school teachers
schools.get('/teachers', async (c) => {
  const userId = c.get('userId');
  
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const teachers = await c.env.DB.prepare(
    'SELECT id, name, email, phone, class, created_at FROM users WHERE role = ? AND "class" = ? ORDER BY created_at DESC'
  ).bind('teacher', schoolName).all();
  
  return c.json({ success: true, teachers: teachers.results });
});

// Add teacher to school
schools.post('/teachers', async (c) => {
  const userId = c.get('userId');
  const { name, email, phone, password } = await c.req.json();
  
  if (!name || !email || !password) {
    return c.json({ success: false, error: 'Name, email, and password are required' }, 400);
  }
  
  // Get school name
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existingUser) {
    return c.json({ success: false, error: 'Email already registered' }, 400);
  }
  
  // Hash password
  const { hashPassword } = await import('../utils/password');
  const passwordHash = await hashPassword(password);
  
  const result = await c.env.DB.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role, "class") VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, email, phone, passwordHash, 'teacher', schoolName).run();
  
  return c.json({ success: true, teacherId: result.meta.last_row_id }, 201);
});

// Update teacher
schools.put('/teachers/:id', async (c) => {
  const userId = c.get('userId');
  const teacherId = c.req.param('id');
  const { name, email, phone } = await c.req.json();
  
  // Verify teacher belongs to school
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const teacher = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(teacherId, 'teacher').first();
  
  if (!teacher || teacher.class !== schoolName) {
    return c.json({ success: false, error: 'Teacher not found or not in your school' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'UPDATE users SET name = ?, email = ?, phone = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(name, email, phone, teacherId).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Teacher not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Teacher updated' });
});

// Delete teacher
schools.delete('/teachers/:id', async (c) => {
  const userId = c.get('userId');
  const teacherId = c.req.param('id');
  
  // Verify teacher belongs to school
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const teacher = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(teacherId, 'teacher').first();
  
  if (!teacher || teacher.class !== schoolName) {
    return c.json({ success: false, error: 'Teacher not found or not in your school' }, 403);
  }
  
  const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(teacherId).run();
  
  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Teacher not found' }, 404);
  }
  
  return c.json({ success: true, message: 'Teacher deleted' });
});

// ============ ANALYTICS ============

// Get school analytics
schools.get('/analytics', async (c) => {
  const userId = c.get('userId');
  
  const school = await c.env.DB.prepare(
    'SELECT class FROM users WHERE id = ? AND role = ?'
  ).bind(userId, 'school').first();
  
  if (!school) {
    return c.json({ success: false, error: 'School not found' }, 404);
  }
  
  const schoolName = school.class as string;
  
  const totalStudents = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = ? AND "class" = ?'
  ).bind('student', schoolName).first();
  
  const totalTeachers = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM users WHERE role = ? AND "class" = ?'
  ).bind('teacher', schoolName).first();
  
  // Get enrollments for school students
  const totalEnrollments = await c.env.DB.prepare(
    `SELECT COUNT(*) as count 
     FROM enrollments e 
     LEFT JOIN users u ON e.user_id = u.id 
     WHERE u.role = ? AND u."class" = ?`
  ).bind('student', schoolName).first();
  
  return c.json({ 
    success: true, 
    analytics: {
      totalStudents: totalStudents?.count || 0,
      totalTeachers: totalTeachers?.count || 0,
      totalEnrollments: totalEnrollments?.count || 0,
      schoolName,
    }
  });
});

export default schools;
