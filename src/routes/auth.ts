import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../utils/password';
import { createToken } from '../utils/token';
import { authMiddleware } from '../middleware/auth';

type Bindings = { DB: D1Database; JWT_SECRET?: string };
type Variables = { userId: number; userEmail: string; userRole: string };

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const registrationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().max(50).optional().default(''),
  email: z.string().email().max(254),
  phone: z.string().max(30).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  password: z.string().min(8).max(128),
  role: z.enum(['student', 'teacher', 'admin', 'school', 'Student', 'Teacher', 'Admin', 'School']).default('student'),
  class: z.string().max(40).optional().nullable(),
  gradeOrSubject: z.string().max(100).optional().nullable(),
}).refine((value) => Boolean(value.name || value.firstName), { message: 'Name is required.' });
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

function normalizedRole(role: string): string {
  return role.toLowerCase();
}

function splitName(name: string | undefined, firstName: string | undefined, lastName: string): [string, string] {
  if (firstName) return [firstName.trim(), lastName.trim()];
  const pieces = (name ?? '').trim().split(/\s+/);
  return [pieces.shift() ?? '', pieces.join(' ')];
}

auth.post('/register', async (c) => {
  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ success: false, message: 'Authentication is not configured.' }, 503);
  const parsed = registrationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: 'Invalid registration details.', issues: parsed.error.issues }, 400);

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();
  const role = normalizedRole(data.role);
  const [firstName, lastName] = splitName(data.name, data.firstName, data.lastName);
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ success: false, message: 'An account with this email already exists.' }, 409);

  // The public registration endpoint never accepts privileged roles.
  if (role !== 'student' && role !== 'teacher') {
    return c.json({ success: false, message: 'This role cannot be registered publicly.' }, 403);
  }
  try {
    const passwordHash = await hashPassword(data.password);
    const result = await c.env.DB.prepare(
      'INSERT INTO users (name, email, phone, password_hash, role, class, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(`${firstName} ${lastName}`.trim(), email, data.phone ?? data.phoneNumber ?? null, passwordHash, role, data.class ?? data.gradeOrSubject ?? null, 'active').run();
    const id = Number(result.meta.last_row_id);
    const user = { id, name: `${firstName} ${lastName}`.trim(), email, role, class: data.class ?? data.gradeOrSubject ?? undefined };
    const token = await createToken({ sub: String(id), email, role, exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secret);
    return c.json({ success: true, token, user }, 201);
  } catch (error) {
    console.error('Registration failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ success: false, message: 'Unable to complete registration.' }, 500);
  }
});

auth.post('/login', async (c) => {
  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ success: false, message: 'Authentication is not configured.' }, 503);
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: 'Invalid email or password.' }, 400);
  const email = parsed.data.email.trim().toLowerCase();
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, password_hash, status FROM users WHERE email = ?'
  ).bind(email).first<{
    id: number; name: string; email: string; phone: string | null; role: string; password_hash: string; status: string;
  }>();

  let passwordValid = Boolean(user && await verifyPassword(parsed.data.password, user.password_hash ?? ''));
  if (user && !passwordValid) {
    const aliases = await c.env.DB.prepare('SELECT password_hash FROM user_password_aliases WHERE user_id = ? LIMIT 5')
      .bind(user.id).all<{ password_hash: string }>().catch(() => ({ results: [] as { password_hash: string }[] }));
    for (const alias of aliases.results) {
      if (await verifyPassword(parsed.data.password, alias.password_hash)) {
        passwordValid = true;
        break;
      }
    }
  }
  if (!user || user.status.toLowerCase() !== 'active' || !passwordValid) {
    return c.json({ success: false, message: 'Invalid email or password.' }, 401);
  }
  const role = normalizedRole(user.role);
  const token = await createToken({ sub: String(user.id), email: user.email, role, exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secret);
  await c.env.DB.prepare("INSERT INTO signup_activity (user_id, action_type) VALUES (?, 'Login')").bind(user.id).run().catch(() => undefined);
  return c.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role } });
});

auth.get('/me', authMiddleware, async (c) => {
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role FROM users WHERE id = ?'
  ).bind(c.get('userId')).first<{
    id: number; name: string; email: string; phone: string | null; role: string;
  }>();
  if (!user) return c.json({ success: false, message: 'Account not found.' }, 404);
  return c.json({ success: true, user: {
    id: user.id, name: user.name, email: user.email, phone: user.phone, role: normalizedRole(user.role),
  } });
});

auth.post('/logout', authMiddleware, async (c) => {
  await c.env.DB.prepare("INSERT INTO signup_activity (user_id, action_type) VALUES (?, 'Logout')").bind(c.get('userId')).run();
  return c.json({ success: true });
});

export default auth;
