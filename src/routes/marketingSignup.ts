import { Hono } from 'hono';
import { z } from 'zod';
import { hashPassword } from '../utils/password';
import { validate } from '../middleware/validation';
import { marketingSignupSchema } from '../validators/signup.schema';

type Bindings = { DB: D1Database };
type Variables = { validatedData?: unknown };

const marketingSignup = new Hono<{ Bindings: Bindings; Variables: Variables }>();

marketingSignup.post('/', validate(marketingSignupSchema), async (c) => {
  const data = c.get('validatedData') as z.infer<typeof marketingSignupSchema>;
  const normalizedEmail = data.email.trim().toLowerCase();
  console.log('Signup received', { email: normalizedEmail });
  const preferences = data.marketingPreferences ?? {
    optInEmail: false,
    optInSMS: false,
    optInPush: false,
    preferredContentType: null
  };
  const deviceType = data.deviceType ?? detectDeviceType(c.req.header('User-Agent'));
  const referralSource = data.referralSource?.trim() || 'Organic';

  try {
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (existingUser) {
      console.log('Duplicate signup email', { email: normalizedEmail });
      return c.json({ success: false, message: 'An account with this email already exists.' }, 409);
    }

    const passwordHash = await hashPassword(data.password);
    const userLookup = c.env.DB.prepare('SELECT id FROM users WHERE email = ?');

    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO users (name, email, phone, password_hash, role, class, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(`${data.firstName} ${data.lastName}`, normalizedEmail, data.phoneNumber ?? null, passwordHash, data.role.toLowerCase(), data.gradeOrSubject ?? null, 'active'),
      c.env.DB.prepare(
        `INSERT INTO profiles (user_id, dob, gender, location, institution_name, grade_or_subject)
         VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?, ?)`
      ).bind(normalizedEmail, data.dob ?? null, data.gender ?? null, data.location ?? null, data.institutionName ?? null, data.gradeOrSubject ?? null),
      c.env.DB.prepare(
        `INSERT INTO marketing_preferences (user_id, opt_in_email, opt_in_sms, opt_in_push, preferred_content_type)
         VALUES ((SELECT id FROM users WHERE email = ?), ?, ?, ?, ?)`
      ).bind(normalizedEmail, preferences.optInEmail ? 1 : 0, preferences.optInSMS ? 1 : 0, preferences.optInPush ? 1 : 0, preferences.preferredContentType ?? null),
      c.env.DB.prepare(
        `INSERT INTO signup_activity (user_id, action_type, device_type, referral_source)
         VALUES ((SELECT id FROM users WHERE email = ?), 'Signup', ?, ?)`
      ).bind(normalizedEmail, deviceType, referralSource)
    ]);

    const user = await userLookup.bind(normalizedEmail).first<{ id: number }>();
    if (!user) throw new Error('Signup user was not created');

    return c.json({
      success: true,
      message: "You've registered successfully! Our team will get in touch with you shortly.",
      data: { userId: user.id }
    }, 201);
  } catch (error) {
    console.error('Signup failed:', error instanceof Error ? error.message : 'unknown error');
    return c.json({ success: false, message: 'Unable to complete registration. Please try again.' }, 500);
  }
});

// Helper function to detect device type from user agent
function detectDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'Desktop';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile';
  }
  
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet';
  }
  
  if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
    return 'Desktop';
  }
  
  return 'Desktop';
}

export default marketingSignup;
