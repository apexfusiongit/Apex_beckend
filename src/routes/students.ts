import { Hono } from 'hono';
import { authMiddleware, requireStudent } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
};

const students = new Hono<{ Bindings: Bindings }>();

// Apply authentication and student role to all student routes
students.use('*', authMiddleware, requireStudent);

// Helper function to verify student is enrolled in a course
async function verifyEnrollment(db: D1Database, userId: number, courseId: number): Promise<boolean> {
  const enrollment = await db.prepare(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?'
  ).bind(userId, courseId).first();
  
  return !!enrollment;
}

// Dashboard
students.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  
  // Get enrolled courses count
  const enrolledCourses = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM enrollments WHERE user_id = ?'
  ).bind(userId).first();
  
  // Get completed lessons count
  const completedLessons = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM progress WHERE user_id = ? AND completed = 1'
  ).bind(userId).first();
  
  // Get test attempts count
  const testAttempts = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM attempts WHERE user_id = ?'
  ).bind(userId).first();
  
  // Get active subscription
  const subscription = await c.env.DB.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? AND end_date > datetime("now")'
  ).bind(userId, 'active').first();
  
  return c.json({ 
    success: true, 
    analytics: {
      enrolledCourses: enrolledCourses?.count || 0,
      completedLessons: completedLessons?.count || 0,
      testAttempts: testAttempts?.count || 0,
      hasActiveSubscription: !!subscription,
      subscriptionEnd: subscription?.end_date || null,
    }
  });
});

// ============ COURSES ============

// Get enrolled courses
students.get('/courses', async (c) => {
  const userId = c.get('userId');
  
  const courses = await c.env.DB.prepare(
    `SELECT c.*, s.name as subject_name, cl.name as class_name, e.enrolled_at 
     FROM enrollments e 
     LEFT JOIN courses c ON e.course_id = c.id 
     LEFT JOIN subjects s ON c.subject_id = s.id 
     LEFT JOIN classes cl ON c.class = cl.id 
     WHERE e.user_id = ? 
     ORDER BY e.enrolled_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, courses: courses.results });
});

// Get enrolled course by ID
students.get('/courses/:id', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('id');
  
  // Verify enrollment
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, parseInt(courseId));
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
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

// Enroll in course
students.post('/courses/:id/enroll', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('id');
  
  // Check if already enrolled
  const existingEnrollment = await c.env.DB.prepare(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?'
  ).bind(userId, courseId).first();
  
  if (existingEnrollment) {
    return c.json({ success: false, error: 'Already enrolled in this course' }, 400);
  }
  
  // Check if course exists
  const course = await c.env.DB.prepare(
    'SELECT id, is_free FROM courses WHERE id = ?'
  ).bind(courseId).first();
  
  if (!course) {
    return c.json({ success: false, error: 'Course not found' }, 404);
  }
  
  // If not free, check for active subscription
  if (course.is_free === 0) {
    const subscription = await c.env.DB.prepare(
      'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? AND end_date > datetime("now")'
    ).bind(userId, 'active').first();
    
    if (!subscription) {
      return c.json({ success: false, error: 'Active subscription required for this course' }, 402);
    }
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO enrollments (user_id, course_id, status) VALUES (?, ?, ?)'
  ).bind(userId, courseId, 'active').run();
  
  return c.json({ success: true, enrollmentId: result.meta.last_row_id }, 201);
});

// ============ CHAPTERS ============

// Get chapters for enrolled course
students.get('/courses/:courseId/chapters', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('courseId');
  
  // Verify enrollment
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, parseInt(courseId));
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const chapters = await c.env.DB.prepare(
    'SELECT * FROM chapters WHERE course_id = ? ORDER BY order_index'
  ).bind(courseId).all();
  
  return c.json({ success: true, chapters: chapters.results });
});

// ============ LESSONS ============

// Get lessons for chapter
students.get('/chapters/:chapterId/lessons', async (c) => {
  const userId = c.get('userId');
  const chapterId = c.req.param('chapterId');
  
  // Verify enrollment in the course this chapter belongs to
  const chapter = await c.env.DB.prepare(
    'SELECT course_id FROM chapters WHERE id = ?'
  ).bind(chapterId).first();
  
  if (!chapter) {
    return c.json({ success: false, error: 'Chapter not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, chapter.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const lessons = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE chapter_id = ? ORDER BY order_no'
  ).bind(chapterId).all();
  
  return c.json({ success: true, lessons: lessons.results });
});

// Get lesson by ID
students.get('/lessons/:id', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  
  // Verify enrollment in the course this lesson belongs to
  const lesson = await c.env.DB.prepare(
    'SELECT l.chapter_id, ch.course_id FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.id = ?'
  ).bind(lessonId).first();
  
  if (!lesson) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, lesson.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const lessonDetails = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE id = ?'
  ).bind(lessonId).first();
  
  return c.json({ success: true, lesson: lessonDetails });
});

// ============ PROGRESS ============

// Get progress for enrolled courses
students.get('/progress', async (c) => {
  const userId = c.get('userId');
  
  const progress = await c.env.DB.prepare(
    `SELECT p.*, l.title as lesson_title, l.course_id, c.title as course_title 
     FROM progress p 
     LEFT JOIN lessons l ON p.lesson_id = l.id 
     LEFT JOIN courses c ON l.course_id = c.id 
     WHERE p.user_id = ? 
     ORDER BY p.updated_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, progress: progress.results });
});

// Get progress for specific course
students.get('/courses/:courseId/progress', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('courseId');
  
  // Verify enrollment
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, parseInt(courseId));
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const progress = await c.env.DB.prepare(
    `SELECT p.*, l.title as lesson_title, l.chapter_id 
     FROM progress p 
     LEFT JOIN lessons l ON p.lesson_id = l.id 
     WHERE p.user_id = ? AND l.course_id = ? 
     ORDER BY l.order_no`
  ).bind(userId, courseId).all();
  
  return c.json({ success: true, progress: progress.results });
});

// Update lesson progress
students.put('/lessons/:lessonId/progress', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('lessonId');
  const { progressPercent, completed, lastPosition } = await c.req.json();
  
  // Verify enrollment in the course this lesson belongs to
  const lesson = await c.env.DB.prepare(
    'SELECT l.chapter_id, ch.course_id FROM lessons l LEFT JOIN chapters ch ON l.chapter_id = ch.id WHERE l.id = ?'
  ).bind(lessonId).first();
  
  if (!lesson) {
    return c.json({ success: false, error: 'Lesson not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, lesson.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    `INSERT INTO progress (user_id, lesson_id, progress_percent, completed, last_position, last_accessed_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, datetime("now"), datetime("now")) 
     ON CONFLICT(user_id, lesson_id) 
     DO UPDATE SET progress_percent = ?, completed = ?, last_position = ?, last_accessed_at = datetime("now"), updated_at = datetime("now")`
  ).bind(userId, lessonId, progressPercent || 0, completed || 0, lastPosition || 0, progressPercent || 0, completed || 0, lastPosition || 0).run();
  
  return c.json({ success: true, message: 'Progress updated' });
});

// ============ TESTS ============

// Get tests for enrolled courses
students.get('/tests', async (c) => {
  const userId = c.get('userId');
  
  const tests = await c.env.DB.prepare(
    `SELECT t.*, c.title as course_title, e.enrolled_at 
     FROM tests t 
     LEFT JOIN courses c ON t.course_id = c.id 
     LEFT JOIN enrollments e ON t.course_id = e.course_id 
     WHERE e.user_id = ? 
     ORDER BY t.created_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, tests: tests.results });
});

// Get test by ID (without answers)
students.get('/tests/:id', async (c) => {
  const userId = c.get('userId');
  const testId = c.req.param('id');
  
  // Verify enrollment in the course this test belongs to
  const test = await c.env.DB.prepare(
    'SELECT course_id FROM tests WHERE id = ?'
  ).bind(testId).first();
  
  if (!test) {
    return c.json({ success: false, error: 'Test not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, test.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const testDetails = await c.env.DB.prepare(
    `SELECT t.*, c.title as course_title 
     FROM tests t 
     LEFT JOIN courses c ON t.course_id = c.id 
     WHERE t.id = ?`
  ).bind(testId).first();
  
  // Get questions without correct answers
  const questions = await c.env.DB.prepare(
    'SELECT id, question, option_a, option_b, option_c, option_d, marks, order_no FROM questions WHERE test_id = ? ORDER BY order_no'
  ).bind(testId).all();
  
  return c.json({ success: true, test: testDetails, questions: questions.results });
});

// Get user's test attempts
students.get('/tests/:testId/attempts', async (c) => {
  const userId = c.get('userId');
  const testId = c.req.param('testId');
  
  // Verify enrollment
  const test = await c.env.DB.prepare(
    'SELECT course_id FROM tests WHERE id = ?'
  ).bind(testId).first();
  
  if (!test) {
    return c.json({ success: false, error: 'Test not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, test.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const attempts = await c.env.DB.prepare(
    'SELECT * FROM attempts WHERE user_id = ? AND test_id = ? ORDER BY started_at DESC'
  ).bind(userId, testId).all();
  
  return c.json({ success: true, attempts: attempts.results });
});

// Start test attempt
students.post('/tests/:testId/attempts', async (c) => {
  const userId = c.get('userId');
  const testId = c.req.param('testId');
  
  // Verify enrollment
  const test = await c.env.DB.prepare(
    'SELECT course_id FROM tests WHERE id = ?'
  ).bind(testId).first();
  
  if (!test) {
    return c.json({ success: false, error: 'Test not found' }, 404);
  }
  
  const isEnrolled = await verifyEnrollment(c.env.DB, userId, test.course_id as number);
  if (!isEnrolled) {
    return c.json({ success: false, error: 'Not enrolled in this course' }, 403);
  }
  
  const result = await c.env.DB.prepare(
    'INSERT INTO attempts (user_id, test_id, score, total_marks) VALUES (?, ?, 0, 0)'
  ).bind(userId, testId).run();
  
  return c.json({ success: true, attemptId: result.meta.last_row_id }, 201);
});

// Submit test attempt
students.put('/attempts/:id', async (c) => {
  const userId = c.get('userId');
  const attemptId = c.req.param('id');
  const { answers } = await c.req.json();
  
  // Verify attempt belongs to user
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, userId).first();
  
  if (!attempt) {
    return c.json({ success: false, error: 'Attempt not found' }, 404);
  }
  
  if (attempt.completed_at) {
    return c.json({ success: false, error: 'Attempt already completed' }, 400);
  }
  
  // Get test questions
  const questions = await c.env.DB.prepare(
    'SELECT * FROM questions WHERE test_id = ?'
  ).bind(attempt.test_id).all();
  
  let score = 0;
  let totalMarks = 0;
  
  for (const question of questions.results) {
    const userAnswer = answers.find((a: any) => a.questionId === question.id);
    if (userAnswer) {
      const isCorrect = userAnswer.selectedAnswer === question.correct_answer;
      if (isCorrect) {
        score += question.marks;
      }
      
      // Save attempt answer
      await c.env.DB.prepare(
        'INSERT INTO attempt_answers (attempt_id, question_id, selected_answer, is_correct, marks) VALUES (?, ?, ?, ?, ?)'
      ).bind(attemptId, question.id, userAnswer.selectedAnswer, isCorrect ? 1 : 0, isCorrect ? question.marks : 0).run();
    }
    
    totalMarks += question.marks;
  }
  
  // Update attempt
  await c.env.DB.prepare(
    'UPDATE attempts SET score = ?, total_marks = ?, completed_at = datetime("now") WHERE id = ?'
  ).bind(score, totalMarks, attemptId).run();
  
  return c.json({ success: true, score, totalMarks });
});

// Get attempt results with correct answers
students.get('/attempts/:id', async (c) => {
  const userId = c.get('userId');
  const attemptId = c.req.param('id');
  
  // Verify attempt belongs to user
  const attempt = await c.env.DB.prepare(
    'SELECT * FROM attempts WHERE id = ? AND user_id = ?'
  ).bind(attemptId, userId).first();
  
  if (!attempt) {
    return c.json({ success: false, error: 'Attempt not found' }, 404);
  }
  
  // Get attempt answers with correct answers
  const answers = await c.env.DB.prepare(
    `SELECT aa.*, q.question, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer 
     FROM attempt_answers aa 
     LEFT JOIN questions q ON aa.question_id = q.id 
     WHERE aa.attempt_id = ?`
  ).bind(attemptId).all();
  
  return c.json({ success: true, attempt, answers: answers.results });
});

// ============ LIVE CLASSES ============

// Get live classes for enrolled courses
students.get('/live-classes', async (c) => {
  const userId = c.get('userId');
  
  const classes = await c.env.DB.prepare(
    `SELECT lc.*, c.title as course_title 
     FROM live_classes lc 
     LEFT JOIN courses c ON lc.subject = c.title 
     LEFT JOIN enrollments e ON c.id = e.course_id 
     WHERE e.user_id = ? AND lc.status = ? 
     ORDER BY lc.start_time ASC`
  ).bind(userId, 'scheduled').all();
  
  return c.json({ success: true, classes: classes.results });
});

// ============ SUBSCRIPTIONS ============

// Get active subscription
students.get('/subscription', async (c) => {
  const userId = c.get('userId');
  
  const subscription = await c.env.DB.prepare(
    'SELECT * FROM subscriptions WHERE user_id = ? AND status = ? AND end_date > datetime("now") ORDER BY end_date DESC LIMIT 1'
  ).bind(userId, 'active').first();
  
  return c.json({ success: true, subscription });
});

// ============ PAYMENTS ============

// Get user payments
students.get('/payments', async (c) => {
  const userId = c.get('userId');
  
  const payments = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all();
  
  return c.json({ success: true, payments: payments.results });
});

// ============ REFERRALS ============

// Get user referrals
students.get('/referrals', async (c) => {
  const userId = c.get('userId');
  
  const referrals = await c.env.DB.prepare(
    `SELECT r.*, u.name as referred_user_name 
     FROM referrals r 
     LEFT JOIN users u ON r.referred_user_id = u.id 
     WHERE r.referrer_id = ? 
     ORDER BY r.created_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, referrals: referrals.results });
});

// Generate referral code
students.post('/referrals/generate', async (c) => {
  const userId = c.get('userId');
  
  // Check if user already has a referral code
  const existingReferral = await c.env.DB.prepare(
    'SELECT * FROM referrals WHERE referrer_id = ?'
  ).bind(userId).first();
  
  if (existingReferral) {
    return c.json({ success: true, referralCode: existingReferral.referral_code });
  }
  
  // Generate unique referral code
  const referralCode = `REF${userId}${Date.now().toString(36).toUpperCase()}`;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO referrals (referrer_id, referral_code, status) VALUES (?, ?, ?)'
  ).bind(userId, referralCode, 'pending').run();
  
  return c.json({ success: true, referralCode, referralId: result.meta.last_row_id }, 201);
});

// ============ NOTIFICATIONS ============

// Get user notifications
students.get('/notifications', async (c) => {
  const userId = c.get('userId');
  
  const notifications = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(userId).all();
  
  return c.json({ success: true, notifications: notifications.results });
});

// Mark notification as read
students.put('/notifications/:id/read', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  
  // Verify notification belongs to user
  const notification = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();
  
  if (!notification) {
    return c.json({ success: false, error: 'Notification not found' }, 404);
  }
  
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ?'
  ).bind(id).run();
  
  return c.json({ success: true, message: 'Notification marked as read' });
});

// Mark all notifications as read
students.put('/notifications/read-all', async (c) => {
  const userId = c.get('userId');
  
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?'
  ).bind(userId).run();
  
  return c.json({ success: true, message: 'All notifications marked as read' });
});

export default students;
