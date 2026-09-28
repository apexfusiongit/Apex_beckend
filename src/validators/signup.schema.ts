import { z } from 'zod';

export const marketingSignupSchema = z.object({
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  email: z.string().email(),
  phoneNumber: z.string().regex(/^[0-9+\-\s()]{10,20}$/).optional().nullable(),
  password: z.string().min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['Student', 'Parent', 'Teacher'], { error: 'Role is required' }),
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')
    .optional()
    .nullable(),
  gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  institutionName: z.string().max(200).optional().nullable(),
  gradeOrSubject: z.string().max(200).optional().nullable(),
  marketingPreferences: z.object({
    optInEmail: z.boolean().default(false),
    optInSMS: z.boolean().default(false),
    optInPush: z.boolean().default(false),
    preferredContentType: z.enum(['Courses', 'Events', 'Discounts', 'Newsletters']).optional().nullable()
  }).optional(),
  referralSource: z.string().max(200).optional().nullable(),
  deviceType: z.string().max(50).optional().nullable()
});
