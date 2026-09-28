import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../utils/password';
import { validate } from '../middleware/validation';
import { registerUserSchema, loginUserSchema } from '../validators/schemas';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  validatedData?: any;
};

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Simple JWT token generation (for development - use proper JWT library in production)
function generateToken(userId: number, email: string, role: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ userId, email, role, exp: Date.now() + 3600000 }));
  const signature = btoa(`${header}.${payload}.secret`);
  return `${header}.${payload}.${signature}`;
}

// Register new user
auth.post('/register', validate(registerUserSchema), async (c) => {
  const data = c.get('validatedData') as z.infer<typeof registerUserSchema>;
  const { name, email, phone, password, role, class: studentClass, adminCode } = data;
  
  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existingUser) {
    return c.json({ 
      success: false, 
      message: 'Email already registered. Please use a different email or login.' 
    }, 409);
  }
  
  // Admin registration requires admin code
  if (role === 'admin') {
    if (adminCode !== 'ADMIN_SECRET_2026') {
      return c.json({ success: false, message: 'Invalid admin code' }, 403);
    }
  }
  
  // Students and teachers require class
  if ((role === 'student' || role === 'teacher') && !studentClass) {
    return c.json({ success: false, message: 'Class is required for students and teachers' }, 400);
  }
  
  try {
    const passwordHash = await hashPassword(password);
    
    const result = await c.env.DB.prepare(
      'INSERT INTO users (name, email, phone, password_hash, role, "class") VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(name, email, phone ?? null, passwordHash, role || 'student', studentClass ?? null).run();
    
    const userId = result.meta.last_row_id;
    const token = generateToken(userId, email, role || 'student');
    
    return c.json({ 
      success: true, 
      userId, 
      token, 
      user: { id: userId, name, email, role: role || 'student', class: studentClass } 
    }, 201);
  } catch (error: any) {
    console.error('Registration error:', error);
    return c.json({ success: false, message: error.message || 'Registration failed' }, 400);
  }
});

// Login user
auth.post('/login', validate(loginUserSchema), async (c) => {
  const data = c.get('validatedData') as z.infer<typeof loginUserSchema>;
  const { email, password } = data;
  
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, phone, role, class, password_hash, created_at FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (!user) {
    return c.json({ success: false, message: 'Invalid credentials' }, 401);
  }
  
  const isValid = await verifyPassword(password, user.password_hash as string);
  
  if (!isValid) {
    return c.json({ success: false, message: 'Invalid credentials' }, 401);
  }
  
  const token = generateToken(user.id as number, user.email as string, user.role as string);
  
  const { password_hash, ...userWithoutPassword } = user;
  
  // Return user data with role for frontend routing
  return c.json({ 
    success: true, 
    token, 
    user: {
      ...userWithoutPassword,
      redirectPath: getRedirectPath(user.role as string)
    }
  });
});

// Helper function to determine redirect path based on role
function getRedirectPath(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'teacher':
      return '/teacher/dashboard';
    case 'school':
      return '/school/dashboard';
    default:
      return '/dashboard';
  }
}

// Get current user
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  
  // Simple token parsing (for development)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.userId;
    
    const user = await c.env.DB.prepare(
      'SELECT id, name, email, phone, role, class, created_at FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!user) {
      return c.json({ success: false, message: 'User not found' }, 404);
    }
    
    return c.json({ success: true, user });
  } catch (error) {
    return c.json({ success: false, message: 'Invalid token' }, 401);
  }
});

// Logout (client-side token removal)
auth.post('/logout', async (c) => {
  return c.json({ success: true, message: 'Logged out successfully' });
});

export default auth;
