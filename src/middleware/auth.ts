import { Context, Next } from 'hono';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  // TODO: Verify JWT token here
  // For now, we'll skip verification for development
  // In production, verify the token and extract user ID
  
  c.set('userId', 1); // Mock user ID for development
  
  await next();
};

export const adminMiddleware = async (c: Context, next: Next) => {
  const userId = c.get('userId');
  
  // TODO: Check if user has admin role
  // For now, we'll skip this check for development
  
  await next();
};
