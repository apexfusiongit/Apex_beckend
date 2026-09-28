import { Context, Next } from 'hono';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  exp: number;
}

export interface AuthContext extends Context {
  get(key: 'userId'): number;
  get(key: 'userEmail'): string;
  get(key: 'userRole'): string;
  get(key: string): any;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Parse JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }
    
    const payload = JSON.parse(atob(parts[1])) as JWTPayload;
    
    // Check token expiration
    if (payload.exp && payload.exp < Date.now()) {
      return c.json({ success: false, error: 'Token expired' }, 401);
    }
    
    // Set user context
    c.set('userId', payload.userId);
    c.set('userEmail', payload.email);
    c.set('userRole', payload.role);
    
    await next();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (c: AuthContext, next: Next) => {
    const userRole = c.get('userRole');
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    
    await next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireTeacher = requireRole(['admin', 'teacher']);
export const requireStudent = requireRole(['admin', 'teacher', 'student']);
export const requireSchool = requireRole(['admin', 'school']);
