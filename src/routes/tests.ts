import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const tests = new Hono<{ Bindings: Bindings }>();

// Get all tests
tests.get('/', async (c) => {
  const courseId = c.req.query('courseId');
  
  let query = 'SELECT * FROM tests WHERE status = ?';
  const params: any[] = ['active'];
  
  if (courseId) {
    query += ' AND course_id = ?';
    params.push(courseId);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const tests = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({ success: true, tests: tests.results });
});

// Get test by ID with questions (without answers for students)
tests.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const test = await c.env.DB.prepare(
    'SELECT * FROM tests WHERE id = ?'
  ).bind(id).first();
  
  if (!test) {
    return c.json({ success: false, message: 'Test not found' }, 404);
  }
  
  const questions = await c.env.DB.prepare(
    'SELECT id, test_id, question, option_a, option_b, option_c, option_d, order_no FROM questions WHERE test_id = ? ORDER BY order_no'
  ).bind(id).all();
  
  return c.json({ success: true, test, questions: questions.results });
});

// Start test attempt
tests.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const { userId } = await c.req.json();
  
  if (!userId) {
    return c.json({ success: false, message: 'User ID is required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO attempts (user_id, test_id, score, total_marks, started_at) VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)'
  ).bind(userId, id).run();
  
  return c.json({ success: true, attemptId: result.meta.last_row_id }, 201);
});

// Submit test attempt
tests.post('/:id/submit', async (c) => {
  const id = c.req.param('id');
  const { userId, answers } = await c.req.json();
  
  if (!userId || !answers) {
    return c.json({ success: false, message: 'User ID and answers are required' }, 400);
  }
  
  // Get questions and correct answers
  const questions = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE test_id = ?'
  ).bind(id).all();
  
  let score = 0;
  let totalMarks = 0;
  
  questions.results.forEach((q: any) => {
    totalMarks += q.marks || 1;
    if (answers[q.id] === q.correct_answer) {
      score += q.marks || 1;
    }
  });
  
  const scorePercent = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  
  await c.env.DB.prepare(
    'UPDATE attempts SET score = ?, total_marks = ?, completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND test_id = ? AND completed_at IS NULL'
  ).bind(scorePercent, totalMarks, userId, id).run();
  
  return c.json({ success: true, score: scorePercent, totalMarks, percentage: scorePercent });
});

// Get user attempts
tests.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const attempts = await c.env.DB.prepare(
    'SELECT a.*, t.title as test_title, c.title as course_title FROM attempts a LEFT JOIN tests t ON a.test_id = t.id LEFT JOIN courses c ON t.course_id = c.id WHERE a.user_id = ? ORDER BY a.completed_at DESC'
  ).bind(userId).all();
  
  return c.json({ success: true, attempts: attempts.results });
});

// Get attempt results with correct answers
tests.get('/attempt/:attemptId', async (c) => {
  const attemptId = c.req.param('attemptId');
  
  const attempt = await c.env.DB.prepare(
    'SELECT a.*, t.title as test_title FROM attempts a LEFT JOIN tests t ON a.test_id = t.id WHERE a.id = ?'
  ).bind(attemptId).first();
  
  if (!attempt) {
    return c.json({ success: false, message: 'Attempt not found' }, 404);
  }
  
  const questions = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE test_id = ? ORDER BY order_no'
  ).bind(attempt.test_id).all();
  
  return c.json({ success: true, attempt, questions: questions.results });
});

// Create test (admin only)
tests.post('/', async (c) => {
  const { courseId, title, description, duration, totalMarks } = await c.req.json();
  
  if (!courseId || !title || !totalMarks) {
    return c.json({ success: false, message: 'Course ID, title, and total marks are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO tests (course_id, title, description, duration, total_marks, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(courseId, title, description, duration, totalMarks, 'active').run();
  
  return c.json({ success: true, testId: result.meta.last_row_id }, 201);
});

// Create question (admin only)
tests.post('/:testId/questions', async (c) => {
  const testId = c.req.param('testId');
  const { question, optionA, optionB, optionC, optionD, correctAnswer, marks, orderNo } = await c.req.json();
  
  if (!question || !optionA || !optionB || !optionC || !optionD || !correctAnswer || !orderNo) {
    return c.json({ success: false, message: 'All fields are required' }, 400);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO questions (test_id, question, option_a, option_b, option_c, option_d, correct_answer, marks, order_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(testId, question, optionA, optionB, optionC, optionD, correctAnswer, marks || 1, orderNo).run();
  
  return c.json({ success: true, questionId: result.meta.last_row_id }, 201);
});

export default tests;
