# APEX FUSION - Backend

India's First AI-Powered Animated Learning Platform for Classes 8–10

## Technology Stack

- **Cloudflare Workers** - Serverless compute
- **Hono** - Web framework
- **TypeScript** - Type safety
- **Cloudflare D1** - SQLite database
- **Cloudflare R2** - Object storage
- **Wrangler** - CLI tool

## Project Structure

```
src/
├── index.ts              # Main entry point
├── routes/               # API route handlers
│   ├── auth.ts          # Authentication endpoints
│   ├── users.ts         # User management
│   ├── subjects.ts      # Subject management
│   ├── courses.ts       # Course management
│   ├── lessons.ts       # Lesson management
│   ├── progress.ts      # Progress tracking
│   ├── tests.ts         # Test management
│   ├── ai.ts            # AI Coach endpoints
│   ├── payments.ts      # Payment processing
│   ├── subscriptions.ts # Subscription management
│   ├── referrals.ts     # Referral system
│   ├── liveClasses.ts   # Live class management
│   ├── teachers.ts      # Teacher endpoints
│   ├── schools.ts       # School management
│   ├── leads.ts         # Lead management
│   └── admin.ts         # Admin endpoints
├── services/             # Business logic
│   ├── ai.service.ts    # AI service abstraction
│   └── payment.service.ts # Payment service abstraction
├── middleware/           # Middleware
│   └── auth.ts          # Authentication middleware
├── db/                  # Database
│   ├── schema.ts        # Database schema
│   └── queries/         # Database queries
├── types/               # TypeScript types
├── utils/               # Utility functions
└── config/              # Configuration

migrations/              # Database migrations
├── 0001_users.sql
├── 0002_subjects.sql
├── 0003_courses.sql
├── 0004_lessons.sql
├── 0005_enrollments.sql
├── 0006_progress.sql
├── 0007_tests.sql
├── 0008_questions.sql
├── 0009_attempts.sql
├── 0010_subscriptions.sql
├── 0011_payments.sql
├── 0012_referrals.sql
├── 0013_ai.sql
└── 0014_live_classes.sql
```

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env.example` file:

```env
D1_DATABASE_ID=your-database-id-here
R2_BUCKET_NAME=apex-fusion-storage
JWT_SECRET=your-jwt-secret-here
AI_API_KEY=your-ai-api-key-here
PAYMENT_SECRET=your-payment-secret-here
PAYMENT_WEBHOOK_SECRET=your-webhook-secret-here
ENVIRONMENT=development
```

## Cloudflare Setup

### Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed: `npm install -g wrangler`

### Authentication

```bash
wrangler login
```

### D1 Database

Create D1 database:
```bash
wrangler d1 create apex-fusion-db
```

Update `wrangler.toml` with the database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "apex-fusion-db"
database_id = "your-database-id-here"
```

Run migrations:
```bash
# Local development
wrangler d1 execute apex-fusion-db --local --file=./schema.sql

# Production
wrangler d1 execute apex-fusion-db --remote --file=./schema.sql
```

### R2 Storage

Create R2 bucket:
```bash
wrangler r2 bucket create apex-fusion-storage
```

## Development

Start local development server:
```bash
npm run dev
```

The API will be available at `http://localhost:8787`

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Subjects
- `GET /api/subjects` - Get all subjects
- `GET /api/subjects/class/:class` - Get subjects by class
- `POST /api/subjects` - Create subject (admin)

### Courses
- `GET /api/courses` - Get all courses (with filters)
- `GET /api/courses/:id` - Get course by ID
- `GET /api/courses/:id/lessons` - Get lessons for a course
- `POST /api/courses/:id/enroll` - Enroll in a course
- `POST /api/courses` - Create course (admin)
- `PUT /api/courses/:id` - Update course (admin)
- `DELETE /api/courses/:id` - Delete course (admin)

### Lessons
- `GET /api/lessons/:id` - Get lesson by ID
- `POST /api/lessons` - Create lesson (admin)
- `PUT /api/lessons/:id` - Update lesson (admin)
- `DELETE /api/lessons/:id` - Delete lesson (admin)
- `GET /api/lessons/:id/video` - Get video from R2

### Progress
- `GET /api/progress/user/:userId` - Get user progress
- `GET /api/progress/course/:courseId/user/:userId` - Get course progress
- `POST /api/progress` - Update progress

### Tests
- `GET /api/tests` - Get all tests (with filters)
- `GET /api/tests/:id` - Get test by ID
- `POST /api/tests/:id/start` - Start test attempt
- `POST /api/tests/:id/submit` - Submit test attempt
- `GET /api/tests/user/:userId` - Get user attempts
- `GET /api/tests/attempt/:attemptId` - Get attempt results
- `POST /api/tests` - Create test (admin)
- `POST /api/tests/:testId/questions` - Create question (admin)

### AI Coach
- `POST /api/ai/sessions` - Create AI session
- `POST /api/ai/chat` - Chat with AI
- `GET /api/ai/sessions/:id` - Get session history
- `GET /api/ai/user/:userId/sessions` - Get user sessions

### Payments
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/webhook` - Payment webhook
- `GET /api/payments/user/:userId` - Get user payments

### Subscriptions
- `GET /api/subscriptions/user/:userId` - Get user subscription
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/plans` - Get available plans

### Referrals
- `GET /api/referrals/user/:userId` - Get user referrals
- `GET /api/referrals/stats/:userId` - Get referral stats
- `POST /api/referrals/generate` - Generate referral code
- `GET /api/referrals/validate/:code` - Validate referral code

### Live Classes
- `GET /api/live-classes` - Get all live classes
- `GET /api/live-classes/:id` - Get live class by ID
- `POST /api/live-classes` - Create live class (admin)

### Teachers
- `GET /api/teachers/dashboard/:userId` - Get teacher dashboard
- `GET /api/teachers/courses/:userId` - Get teacher courses

### Schools
- `POST /api/schools/register` - Register school
- `GET /api/schools/:userId` - Get school profile

### Leads
- `POST /api/leads` - Create lead
- `GET /api/leads` - Get all leads (admin)

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/courses` - Get all courses
- `GET /api/admin/tests` - Get all tests
- `GET /api/admin/payments` - Get all payments
- `GET /api/admin/referrals` - Get all referrals
- `GET /api/admin/analytics` - Get analytics

### Users
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/:id/enrollments` - Get user enrollments
- `GET /api/users/:id/subscription` - Get user subscription
- `POST /api/users/:id/referrals` - Create referral

## Database Schema

### Core Tables

- **users** - User accounts with authentication
- **subjects** - Subjects by class (8, 9, 10)
- **courses** - Course information and metadata
- **lessons** - Lesson content with video keys
- **enrollments** - Course enrollment tracking
- **progress** - Lesson progress tracking
- **tests** - Test definitions
- **questions** - Test questions with answers
- **attempts** - Student test attempts
- **subscriptions** - Subscription management
- **payments** - Payment history
- **referrals** - Referral tracking
- **ai_sessions** - AI conversation sessions
- **ai_messages** - AI conversation history
- **live_classes** - Live class scheduling
- **leads** - Early access leads

## Security

- Password hashing with SHA-256 (use bcrypt in production)
- JWT token-based authentication
- Role-based access control (student, teacher, school, admin)
- Input validation on all endpoints
- CORS configuration
- Secrets management via Cloudflare secrets

## Architecture

```
Frontend (React + Vite)
    ↓ HTTP/REST API
Cloudflare Worker (Hono)
    ↓
D1 Database (SQLite)
    ↓
R2 Storage (Videos, files)
    ↓
External Services (AI, Payments)
```

## Development Notes

- Never commit secrets or API keys
- Use Cloudflare secrets for production values
- Test all endpoints locally before deployment
- Validate all user inputs
- Implement proper error handling
- Use transactions for multi-step operations
- Monitor API usage and performance

## Production Checklist

- [ ] Set up production D1 database
- [ ] Run all migrations on production database
- [ ] Create production R2 bucket
- [ ] Configure Cloudflare secrets
- [ ] Set up payment gateway integration
- [ ] Configure AI provider API
- [ ] Set up monitoring and logging
- [ ] Configure CORS for production domain
- [ ] Test all API endpoints
- [ ] Verify authentication flow
- [ ] Test payment flow
- [ ] Verify R2 video streaming
- [ ] Set up webhook handlers

## License

MIT
