import { z } from 'zod';

// ============ USERS ============

export const registerUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid phone number').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['student', 'teacher', 'admin', 'school']).default('student'),
  class: z.string().optional().nullable(),
  adminCode: z.string().optional()
});

export const loginUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^[0-9+\-\s()]{10,20}$/).optional().nullable(),
  role: z.enum(['student', 'teacher', 'admin', 'school']).optional(),
  class: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional()
});

// ============ CLASSES ============

export const createClassSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500).optional().nullable()
});

export const updateClassSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional()
});

// ============ SUBJECTS ============

export const createSubjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  classId: z.number().int().positive('Class ID must be a positive integer'),
  description: z.string().max(500).optional().nullable()
});

export const updateSubjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  classId: z.number().int().positive().optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional()
});

// ============ COURSES ============

export const createCourseSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().max(2000).optional().nullable(),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
  class: z.number().int().positive('Class ID must be a positive integer'),
  thumbnail: z.string().url().optional().nullable(),
  price: z.number().min(0).default(0),
  isFree: z.boolean().default(true),
  teacherId: z.number().int().positive().optional().nullable(),
  status: z.enum(['active', 'inactive', 'draft']).default('active')
});

export const updateCourseSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
  price: z.number().min(0).optional(),
  isFree: z.boolean().optional(),
  teacherId: z.number().int().positive().optional().nullable(),
  status: z.enum(['active', 'inactive', 'draft']).optional()
});

// ============ CHAPTERS ============

export const createChapterSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional().nullable(),
  orderIndex: z.number().int().positive('Order index must be a positive integer'),
  status: z.enum(['active', 'inactive']).default('active')
});

export const updateChapterSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  orderIndex: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

// ============ LESSONS ============

export const createLessonSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(2000).optional().nullable(),
  videoKey: z.string().min(1, 'Video key is required'),
  thumbnail: z.string().url().optional().nullable(),
  duration: z.number().int().min(0).optional().nullable(),
  orderNo: z.number().int().positive('Order number must be a positive integer'),
  status: z.enum(['active', 'inactive']).default('active')
});

export const updateLessonSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  videoKey: z.string().min(1).optional(),
  thumbnail: z.string().url().optional().nullable(),
  duration: z.number().int().min(0).optional().nullable(),
  orderNo: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

// ============ TESTS ============

export const createTestSchema = z.object({
  courseId: z.number().int().positive('Course ID must be a positive integer'),
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().max(1000).optional().nullable(),
  duration: z.number().int().min(1, 'Duration must be at least 1 minute').optional().nullable(),
  totalMarks: z.number().int().positive('Total marks must be a positive integer'),
  status: z.enum(['active', 'inactive']).default('active')
});

export const updateTestSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  duration: z.number().int().min(1).optional().nullable(),
  totalMarks: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

// ============ QUESTIONS ============

export const createQuestionSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters').max(1000),
  optionA: z.string().min(1, 'Option A is required').max(500),
  optionB: z.string().min(1, 'Option B is required').max(500),
  optionC: z.string().min(1, 'Option C is required').max(500),
  optionD: z.string().min(1, 'Option D is required').max(500),
  correctAnswer: z.enum(['A', 'B', 'C', 'D'], 'Correct answer must be A, B, C, or D'),
  marks: z.number().int().positive('Marks must be a positive integer').default(1),
  orderNo: z.number().int().positive('Order number must be a positive integer')
});

export const updateQuestionSchema = z.object({
  question: z.string().min(5).max(1000).optional(),
  optionA: z.string().min(1).max(500).optional(),
  optionB: z.string().min(1).max(500).optional(),
  optionC: z.string().min(1).max(500).optional(),
  optionD: z.string().min(1).max(500).optional(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']).optional(),
  marks: z.number().int().positive().optional(),
  orderNo: z.number().int().positive().optional()
});

// ============ LIVE CLASSES ============

export const createLiveClassSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  subject: z.string().min(2, 'Subject is required').max(100),
  teacherId: z.number().int().positive().optional().nullable(),
  startTime: z.string().datetime('Invalid datetime format for start time'),
  endTime: z.string().datetime('Invalid datetime format for end time').optional().nullable(),
  joinUrl: z.string().url('Invalid URL for join URL'),
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).default('scheduled')
});

export const updateLiveClassSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  subject: z.string().min(2).max(100).optional(),
  teacherId: z.number().int().positive().optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  joinUrl: z.string().url().optional(),
  status: z.enum(['scheduled', 'ongoing', 'completed', 'cancelled']).optional()
});

// ============ ENROLLMENTS ============

export const createEnrollmentSchema = z.object({
  courseId: z.number().int().positive('Course ID must be a positive integer'),
  status: z.enum(['active', 'cancelled', 'completed']).default('active')
});

// ============ PROGRESS ============

export const updateProgressSchema = z.object({
  lessonId: z.number().int().positive('Lesson ID must be a positive integer'),
  progressPercent: z.number().min(0).max(100, 'Progress must be between 0 and 100'),
  completed: z.boolean().default(false),
  videoPosition: z.number().min(0).optional().nullable()
});

// ============ SUBSCRIPTIONS ============

export const createSubscriptionSchema = z.object({
  planId: z.number().int().positive('Plan ID must be a positive integer'),
  startDate: z.string().datetime('Invalid datetime format for start date'),
  endDate: z.string().datetime('Invalid datetime format for end date'),
  status: z.enum(['active', 'expired', 'cancelled']).default('active')
});

// ============ PAYMENTS ============

export const createPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required').max(100),
  paymentId: z.string().max(100).optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending')
});

// ============ REFERRALS ============

export const createReferralSchema = z.object({
  code: z.string().min(5, 'Referral code must be at least 5 characters').max(20)
});

// ============ AI ============

export const createAISessionSchema = z.object({
  title: z.string().min(2).max(200).optional().nullable()
});

export const createAIMessageSchema = z.object({
  sessionId: z.number().int().positive('Session ID must be a positive integer'),
  role: z.enum(['user', 'assistant']),
  message: z.string().min(1, 'Message is required').max(10000)
});

// ============ TEACHER ASSIGNMENTS ============

export const createTeacherAssignmentSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  courseId: z.number().int().positive('Course ID must be a positive integer')
});

// ============ DATE FILTERS ============

export const dateFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

// ============ PAGINATION ============

export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().min(0).default(0)
});
