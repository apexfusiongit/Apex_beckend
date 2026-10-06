import { Hono } from 'hono';

type Bindings = { DB: D1Database };
const catalog = new Hono<{ Bindings: Bindings }>();

catalog.get('/courses', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT c.id, c.title, c.description, c.class AS classLevel, s.name AS subject,
            COUNT(l.id) AS lessonCount
     FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN lessons l ON l.course_id = c.id
     WHERE lower(c.status) = 'active'
     GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`
  ).all();
  return c.json({ success: true, data: result.results });
});

export default catalog;
