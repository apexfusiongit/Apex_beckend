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
  
  // TODO: Verify JWT token here
  // For now, we'll skip verification for development
  // In production, verify the token and extract user ID
  
  c.set('userId', 1); // Mock user ID for development
  
  await next();
};

export const requireAdmin = async (c: Context, next: Next) => {
  const role = c.get('userRole');
  if (role !== 'admin') {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  await next();
};
