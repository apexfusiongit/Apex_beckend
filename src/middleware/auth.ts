import type { Context, Next } from 'hono';
import { verifyToken } from '../utils/token';

type AuthBindings = { DB: D1Database; JWT_SECRET?: string };
type AuthVariables = { userId: number; userEmail: string; userRole: string };
type AuthApp = Context<{ Bindings: AuthBindings; Variables: AuthVariables }>;

export const authMiddleware = async (c: AuthApp, next: Next) => {
  const secret = c.env.JWT_SECRET;
  if (!secret) return c.json({ success: false, message: 'Authentication is not configured.' }, 503);

  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Authentication required.' }, 401);
  }

  const payload = await verifyToken(authorization.slice(7), secret);
  const userId = Number(payload?.sub);
  if (!payload || !Number.isSafeInteger(userId) || userId < 1) {
    return c.json({ success: false, message: 'Invalid or expired token.' }, 401);
  }

  // Read current identity and role from D1 so stale or forged client role claims
  // never grant access after a role change or account suspension.
  const user = await c.env.DB.prepare(
    'SELECT id, email, role, status FROM users WHERE id = ?'
  ).bind(userId).first<{ id: number; email: string; role: string; status: string }>();

  if (!user || user.status.toLowerCase() !== 'active') {
    return c.json({ success: false, message: 'Account is unavailable.' }, 401);
  }

  c.set('userId', user.id);
  c.set('userEmail', user.email);
  c.set('userRole', user.role);
  await next();
};

export const requireRole = (...roles: string[]) => async (c: AuthApp, next: Next) => {
  const role = c.get('userRole').toLowerCase();
  if (!roles.some((allowed) => allowed.toLowerCase() === role)) {
    return c.json({ success: false, message: 'You do not have permission to perform this action.' }, 403);
  }
  await next();
};

export const requireAdmin = requireRole('admin');
export const requireTeacher = requireRole('teacher');
export const requireStudent = requireRole('student');
