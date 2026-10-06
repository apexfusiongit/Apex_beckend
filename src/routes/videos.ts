import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth';
import { verifyToken } from '../utils/token';
import { logR2Operation, logEvent, LogLevel } from '../utils/logger';

type Bindings = { DB: D1Database; STORAGE: R2Bucket; JWT_SECRET?: string };
type Variables = { userId: number; userEmail: string; userRole: string };
const videos = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const SUPPORTED_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};
const courseInput = z.object({
  title: z.string().min(5).max(200),
  subject: z.string().min(2).max(100),
  classLevel: z.string().regex(/^(?:Class\s*)?(?:8|9|10)$/i),
  description: z.string().max(2000).optional().default(''),
  teacherEmail: z.string().email().optional().or(z.literal('')),
  status: z.enum(['draft', 'active']).default('draft'),
});
const lessonInput = z.object({ title: z.string().min(2).max(200), description: z.string().max(2000).optional().default('') });

videos.post('/courses', authMiddleware, requireRole('admin'), async (c) => {
  const parsed = courseInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: 'Enter a valid course title, subject, and class (8–10).' }, 400);
  const data = parsed.data;
  const classLevel = data.classLevel.replace(/^class\s*/i, '');
  let teacherId: number | null = null;
  if (data.teacherEmail) {
    const teacher = await c.env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND lower(role) = 'teacher' AND lower(status) = 'active'")
      .bind(data.teacherEmail).first<{ id: number }>();
    if (!teacher) return c.json({ success: false, message: 'An active teacher account with that email was not found.' }, 404);
    teacherId = teacher.id;
  }
  let subject = await c.env.DB.prepare('SELECT id FROM subjects WHERE lower(name) = lower(?) AND class = ?')
    .bind(data.subject.trim(), classLevel).first<{ id: number }>();
  if (!subject) {
    const createdSubject = await c.env.DB.prepare('INSERT INTO subjects (name, class) VALUES (?, ?)')
      .bind(data.subject.trim(), classLevel).run();
    subject = { id: Number(createdSubject.meta.last_row_id) };
  }
  const result = await c.env.DB.prepare(
    'INSERT INTO courses (title, subject_id, class, description, status, teacher_id, is_free, price, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)'
  ).bind(data.title.trim(), subject.id, classLevel, data.description, data.status, teacherId, c.get('userId')).run();
  const courseId = Number(result.meta.last_row_id);
  if (teacherId) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO teacher_courses (teacher_id, course_id, assigned_by) VALUES (?, ?, ?)')
      .bind(teacherId, courseId, c.get('userId')).run();
  }
  await c.env.DB.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)')
    .bind(c.get('userId'), 'course.create', 'course', courseId).run();
  return c.json({ success: true, data: { id: courseId, title: data.title, class: classLevel, status: data.status } }, 201);
});

videos.post('/courses/:courseId/lessons', authMiddleware, requireRole('admin'), async (c) => {
  const courseId = Number(c.req.param('courseId'));
  const parsed = lessonInput.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(courseId) || courseId < 1 || !parsed.success) {
    return c.json({ success: false, message: 'Enter a valid course and lesson title.' }, 400);
  }
  const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(courseId).first();
  if (!course) return c.json({ success: false, message: 'Course not found.' }, 404);
  const order = await c.env.DB.prepare('SELECT COALESCE(MAX(order_no), 0) + 1 AS next_order FROM lessons WHERE course_id = ?')
    .bind(courseId).first<{ next_order: number }>();
  const result = await c.env.DB.prepare(
    'INSERT INTO lessons (course_id, title, description, video_key, order_no, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(courseId, parsed.data.title.trim(), parsed.data.description, '', order?.next_order ?? 1, 'active').run();
  const lessonId = Number(result.meta.last_row_id);
  await c.env.DB.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)')
    .bind(c.get('userId'), 'lesson.create', 'lesson', lessonId).run();
  return c.json({ success: true, data: { id: lessonId, title: parsed.data.title, courseId } }, 201);
});

videos.post('/courses/:courseId/assign-teacher', authMiddleware, requireRole('admin'), async (c) => {
  const courseId = Number(c.req.param('courseId'));
  const body = z.object({ email: z.string().email() }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(courseId) || courseId < 1 || !body.success) {
    return c.json({ success: false, message: 'Enter a valid course and teacher email.' }, 400);
  }
  const teacher = await c.env.DB.prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND lower(role) = 'teacher' AND lower(status) = 'active'")
    .bind(body.data.email).first<{ id: number }>();
  if (!teacher) return c.json({ success: false, message: 'An active teacher account with that email was not found.' }, 404);
  const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(courseId).first();
  if (!course) return c.json({ success: false, message: 'Course not found.' }, 404);
  await c.env.DB.prepare('INSERT OR IGNORE INTO teacher_courses (teacher_id, course_id, assigned_by) VALUES (?, ?, ?)')
    .bind(teacher.id, courseId, c.get('userId')).run();
  await c.env.DB.prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)')
    .bind(c.get('userId'), 'teacher.assign_course', 'course', courseId, JSON.stringify({ teacherId: teacher.id })).run();
  return c.json({ success: true });
});

videos.post('/upload', authMiddleware, requireRole('admin', 'teacher'), async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ success: false, message: 'A multipart video upload is required.' }, 400);
  const lessonId = Number(form.get('lessonId'));
  const file = form.get('file');
  if (!Number.isSafeInteger(lessonId) || lessonId < 1 || !(file instanceof File)) {
    return c.json({ success: false, message: 'A valid lesson and video file are required.' }, 400);
  }
  if (file.size < 1 || file.size > MAX_VIDEO_SIZE) {
    return c.json({ success: false, message: 'Video size must be between 1 byte and 100 MB.' }, 413);
  }
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const mimeType = SUPPORTED_TYPES[extension];
  if (!mimeType || file.type !== mimeType) {
    return c.json({ success: false, message: 'Supported formats are MP4, WebM, and QuickTime video.' }, 415);
  }

  const lesson = await c.env.DB.prepare(
    `SELECT l.id, l.course_id, c.class, c.title AS course_title
     FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ?`
  ).bind(lessonId).first<{ id: number; course_id: number; class: string; course_title: string }>();
  if (!lesson) return c.json({ success: false, message: 'Lesson not found.' }, 404);

  const userId = c.get('userId');
  if (c.get('userRole').toLowerCase() === 'teacher') {
    const assignment = await c.env.DB.prepare(
      'SELECT 1 FROM courses c LEFT JOIN teacher_courses tc ON tc.course_id = c.id AND tc.teacher_id = ? WHERE c.id = ? AND (c.teacher_id = ? OR tc.teacher_id IS NOT NULL)'
    ).bind(userId, lesson.course_id, userId).first();
    if (!assignment) return c.json({ success: false, message: 'You are not assigned to this course.' }, 403);
  }

  const safeCourse = lesson.course_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'course';
  const key = `courses/class-${String(lesson.class).replace(/[^a-zA-Z0-9-]/g, '-')}/${safeCourse}/lesson-${lessonId}/${crypto.randomUUID()}${extension}`;
  try {
    logEvent(LogLevel.INFO, 'Starting video upload to R2', {
      userId,
      lessonId,
      courseId: lesson.course_id,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    });
    await c.env.STORAGE.put(key, file.stream(), {
      httpMetadata: { contentType: mimeType, cacheControl: 'private, max-age=0' },
      customMetadata: { lessonId: String(lessonId), courseId: String(lesson.course_id), uploadedBy: String(userId) },
    });
    logR2Operation('put', key, { userId, lessonId, fileSize: file.size });
    const result = await c.env.DB.prepare(
      `INSERT INTO video_assets (lesson_id, course_id, uploaded_by, r2_key, file_name, file_size, mime_type, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(lessonId, lesson.course_id, userId, key, file.name.slice(0, 255), file.size, mimeType, form.get('isDemo') === 'true' ? 1 : 0).run();
    // Demo access belongs to each video asset. A lesson can hold multiple uploads,
    // so changing its demo flag here could accidentally make sibling videos public.
    await c.env.DB.prepare('UPDATE lessons SET video_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(key, lessonId).run();
    await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, 'video.upload', 'video', result.meta.last_row_id, JSON.stringify({ lessonId, r2Key: key })).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id, lessonId, r2Key: key, fileName: file.name, fileSize: file.size, mimeType } }, 201);
  } catch (error) {
    await c.env.STORAGE.delete(key).catch(() => undefined);
    logEvent(LogLevel.ERROR, 'Video upload failed', {
      userId,
      lessonId,
      key,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return c.json({ success: false, message: 'Unable to store this video.' }, 500);
  }
});

videos.get('/', authMiddleware, requireRole('admin', 'teacher'), async (c) => {
  const role = c.get('userRole').toLowerCase();
  const userId = c.get('userId');
  const query = role === 'admin'
    ? `SELECT va.id, va.lesson_id, va.course_id, va.file_name, va.file_size, va.mime_type,
              va.is_demo, va.status, va.created_at, l.title AS lesson_title, c.title AS course_title
       FROM video_assets va JOIN lessons l ON l.id = va.lesson_id JOIN courses c ON c.id = va.course_id
       WHERE va.status = 'active' ORDER BY va.created_at DESC LIMIT 100`
    : `SELECT va.id, va.lesson_id, va.course_id, va.file_name, va.file_size, va.mime_type,
              va.is_demo, va.status, va.created_at, l.title AS lesson_title, c.title AS course_title
       FROM video_assets va JOIN lessons l ON l.id = va.lesson_id JOIN courses c ON c.id = va.course_id
       LEFT JOIN teacher_courses tc ON tc.course_id = va.course_id AND tc.teacher_id = ?
       WHERE va.status = 'active' AND (tc.teacher_id = ? OR c.teacher_id = ?) ORDER BY va.created_at DESC LIMIT 100`;
  const result = role === 'admin'
    ? await c.env.DB.prepare(query).all()
    : await c.env.DB.prepare(query).bind(userId, userId, userId).all();
  return c.json({ success: true, data: result.results });
});

videos.get('/courses', authMiddleware, requireRole('admin', 'teacher'), async (c) => {
  const role = c.get('userRole').toLowerCase();
  const query = role === 'admin'
    ? `SELECT id, title, class FROM courses ORDER BY title LIMIT 200`
    : `SELECT DISTINCT c.id, c.title, c.class FROM courses c LEFT JOIN teacher_courses tc ON tc.course_id = c.id AND tc.teacher_id = ?
       WHERE tc.teacher_id = ? OR c.teacher_id = ? ORDER BY c.title LIMIT 200`;
  const result = role === 'admin'
    ? await c.env.DB.prepare(query).all()
    : await c.env.DB.prepare(query).bind(c.get('userId'), c.get('userId'), c.get('userId')).all();
  return c.json({ success: true, data: result.results });
});

videos.get('/courses/:courseId/lessons', authMiddleware, requireRole('admin', 'teacher'), async (c) => {
  const courseId = Number(c.req.param('courseId'));
  if (!Number.isSafeInteger(courseId) || courseId < 1) return c.json({ success: false, message: 'Course not found.' }, 404);
  if (c.get('userRole').toLowerCase() === 'teacher') {
    const assignment = await c.env.DB.prepare(
      'SELECT 1 FROM courses c LEFT JOIN teacher_courses tc ON tc.course_id = c.id AND tc.teacher_id = ? WHERE c.id = ? AND (c.teacher_id = ? OR tc.teacher_id IS NOT NULL)'
    ).bind(c.get('userId'), courseId, c.get('userId')).first();
    if (!assignment) return c.json({ success: false, message: 'You are not assigned to this course.' }, 403);
  }
  const result = await c.env.DB.prepare(
    `SELECT id, title, chapter_id FROM lessons WHERE course_id = ? ORDER BY COALESCE(chapter_id, 0), order_no LIMIT 500`
  ).bind(courseId).all();
  return c.json({ success: true, data: result.results });
});

videos.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ success: false, message: 'Video not found.' }, 404);
  const asset = await c.env.DB.prepare(
    `SELECT va.id, va.lesson_id, va.course_id, va.r2_key, va.mime_type, va.file_size, va.is_demo,
            c.is_demo AS course_is_demo
     FROM video_assets va JOIN lessons l ON l.id = va.lesson_id JOIN courses c ON c.id = va.course_id
     WHERE va.id = ? AND va.status = 'active'`
  ).bind(id).first<{
    id: number; lesson_id: number; course_id: number; r2_key: string; mime_type: string;
    file_size: number; is_demo: number; course_is_demo: number;
  }>();
  if (!asset) return c.json({ success: false, message: 'Video not found.' }, 404);

  const isDemo = asset.is_demo === 1 || asset.course_is_demo === 1;
  if (!isDemo) {
    const secret = c.env.JWT_SECRET;
    const authHeader = c.req.header('Authorization');
    if (!secret || !authHeader?.startsWith('Bearer ')) return c.json({ success: false, message: 'Authentication required.' }, 401);
    const token = await verifyToken(authHeader.slice(7), secret);
    const userId = Number(token?.sub);
    if (!token || !Number.isSafeInteger(userId)) return c.json({ success: false, message: 'Invalid or expired token.' }, 401);
    const user = await c.env.DB.prepare('SELECT role, status FROM users WHERE id = ?').bind(userId).first<{ role: string; status: string }>();
    if (!user || user.status.toLowerCase() !== 'active') return c.json({ success: false, message: 'Account is unavailable.' }, 401);
    if (user.role.toLowerCase() !== 'student') return c.json({ success: false, message: 'Student access required.' }, 403);
    const access = await c.env.DB.prepare(
      `SELECT 1 FROM enrollments e JOIN subscriptions s ON s.user_id = e.user_id
       WHERE e.user_id = ? AND e.course_id = ? AND lower(e.status) = 'active'
         AND lower(s.status) = 'active' AND s.end_date > CURRENT_TIMESTAMP LIMIT 1`
    ).bind(userId, asset.course_id).first();
    if (!access) return c.json({ success: false, message: 'An active subscription and course enrollment are required.' }, 403);
  }

  const range = c.req.header('Range');
  let offset = 0;
  let length = asset.file_size;
  let status: 200 | 206 = 200;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return c.body(null, 416, { 'Content-Range': `bytes */${asset.file_size}` });
    offset = Number(match[1]);
    const end = match[2] ? Number(match[2]) : asset.file_size - 1;
    if (offset >= asset.file_size || end < offset) return c.body(null, 416, { 'Content-Range': `bytes */${asset.file_size}` });
    length = Math.min(end, asset.file_size - 1) - offset + 1;
    status = 206;
  }
  const object = await c.env.STORAGE.get(asset.r2_key, range ? { range: { offset, length } } : undefined);
  if (!object) {
    logEvent(LogLevel.ERROR, 'Video file not found in R2', {
      videoId: id,
      r2Key: asset.r2_key,
    });
    return c.json({ success: false, message: 'Video file is unavailable.' }, 404);
  }
  logR2Operation('get', asset.r2_key, { videoId: id, isRangeRequest: !!range });
  const headers = new Headers({
    'Content-Type': asset.mime_type,
    'Content-Length': String(length),
    'Accept-Ranges': 'bytes',
    'Cache-Control': isDemo ? 'public, max-age=3600' : 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (status === 206) headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${asset.file_size}`);
  return new Response(object.body, { status, headers });
});

videos.delete('/:id', authMiddleware, requireRole('admin', 'teacher'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ success: false, message: 'Video not found.' }, 404);
  const video = await c.env.DB.prepare('SELECT id, course_id, r2_key FROM video_assets WHERE id = ? AND status = ?')
    .bind(id, 'active').first<{ id: number; course_id: number; r2_key: string }>();
  if (!video) return c.json({ success: false, message: 'Video not found.' }, 404);
  const userId = c.get('userId');
  if (c.get('userRole').toLowerCase() === 'teacher') {
    const assignment = await c.env.DB.prepare('SELECT 1 FROM courses c LEFT JOIN teacher_courses tc ON tc.course_id = c.id AND tc.teacher_id = ? WHERE c.id = ? AND (c.teacher_id = ? OR tc.teacher_id IS NOT NULL)')
      .bind(userId, video.course_id, userId).first();
    if (!assignment) return c.json({ success: false, message: 'You are not assigned to this course.' }, 403);
  }
  logEvent(LogLevel.INFO, 'Deleting video from R2', {
    userId,
    videoId: id,
    r2Key: video.r2_key,
  });
  await c.env.STORAGE.delete(video.r2_key);
  logR2Operation('delete', video.r2_key, { userId, videoId: id });
  await c.env.DB.prepare("UPDATE video_assets SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, 'video.delete', 'video', id, JSON.stringify({ r2Key: video.r2_key })).run();
  return c.json({ success: true, data: { id } });
});

export default videos;
