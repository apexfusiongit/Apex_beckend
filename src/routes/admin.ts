import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const admin = new Hono<{ Bindings: Bindings }>();

// Get all users
admin.get('/users', async (c) => {
  const users = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class, created_at FROM users ORDER BY created_at DESC'
  ).all();
  
  return c.json({ success: true, users: users.results });
});

// Get all courses
admin.get('/courses', async (c) => {
  const courses = await c.env.DB.prepare(
    'SELECT c.*, s.name as subject_name FROM courses c LEFT JOIN subjects s ON c.subject_id = s.id ORDER BY c.created_at DESC'
  ).all();
  
  return c.json({ success: true, courses: courses.results });
});

// Get all tests
admin.get('/tests', async (c) => {
  const tests = await c.env.DB.prepare(
    'SELECT * FROM tests ORDER BY created_at DESC'
  ).all();
  
  return c.json({ success: true, tests: tests.results });
});

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

// Get basic analytics
admin.get('/analytics', async (c) => {
  const totalUsers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
  const totalCourses = await c.env.DB.prepare('SELECT COUNT(*) as count FROM courses').first();
  const totalTests = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tests').first();
  const totalPayments = await c.env.DB.prepare('SELECT COUNT(*) as count FROM payments WHERE status = ?').bind('completed').first();
  
  return c.json({ 
    success: true, 
    analytics: {
      totalUsers: totalUsers?.count || 0,
      totalCourses: totalCourses?.count || 0,
      totalTests: totalTests?.count || 0,
      totalPayments: totalPayments?.count || 0,
    }
  });
});

export default admin;
