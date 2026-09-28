import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../utils/password';
import { validate } from '../middleware/validation';
import { registerUserSchema, loginUserSchema } from '../validators/schemas';

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_CODE?: string;
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
    if (adminCode !== (c.env.ADMIN_CODE ?? 'ADMIN_SECRET_2026')) {
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
    'SELECT id, first_name, last_name, email, phone_number, role, password_hash, status FROM users WHERE email = ?'
  ).bind(email).first<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    role: string;
    password_hash: string;
    status: string;
  }>();

  if (!user || user.status !== 'Active' || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ success: false, message: 'Invalid email or password' }, 401);
  }
  
  const token = generateToken(user.id as number, user.email as string, user.role as string);
  
  const { password_hash, ...userWithoutPassword } = user;
  
  // Return user data with role for frontend routing
  return c.json({ 
    success: true, 
    token, 
    user: {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      phone: user.phone_number,
      role: user.role
    },
  });
});

export default auth;
