# Apex Fusion Backend

Student learning platform backend built with Cloudflare Workers, Hono, D1, and R2.

## Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- Wrangler CLI

### Installation

```bash
npm install
```

### Development

```bash
# Local development with simulated D1 and R2
npm run dev:local

# Development with remote resources
npm run dev
```

### Deployment

```bash
# Build TypeScript
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Database Migrations

```bash
# Remote (production)
npm run db:migrate -- --remote

# Local
npm run db:migrate:local
```

## Documentation

- **[BACKEND_SETUP.md](./BACKEND_SETUP.md)** - Complete setup, deployment, and integration guide
- **[POSTMAN_SETUP.md](./POSTMAN_SETUP.md)** - Postman collection setup for API testing
- **[R2_SETUP.md](./R2_SETUP.md)** - R2 storage configuration and usage guide

## API Endpoints

### Base URL
- Production: `https://apex-backend.admin-apexfusion.workers.dev`
- Local: `http://localhost:8787`

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

#### Courses
- `POST /api/videos/courses` - Create course (admin)
- `GET /api/videos/courses` - List courses (admin/teacher)

#### Lessons
- `POST /api/videos/courses/{courseId}/lessons` - Create lesson (admin)
- `GET /api/videos/courses/{courseId}/lessons` - List lessons

#### Videos
- `POST /api/videos/upload` - Upload video to R2 (admin/teacher)
- `GET /api/videos/{id}` - Stream video
- `GET /api/videos` - List videos (admin/teacher)
- `DELETE /api/videos/{id}` - Delete video (admin/teacher)

#### Health
- `GET /` - Health check with database status
- `GET /health` - Simple health check
- `GET /api/admin/r2/health` - R2 storage health check

## Architecture

```
Frontend (React/Vite)
    ↓ HTTPS API
Cloudflare Workers (Hono)
    ↓
├── D1 Database (SQLite)
├── R2 Storage (Video Files)
└── Cloudflare KV (Optional)
```

## Environment Configuration

### Production (wrangler.toml)
- Environment: production
- Database: Remote D1
- Storage: Remote R2
- CORS: Production domain + localhost

### Local (wrangler.local.toml)
- Environment: development
- Database: Local D1 simulation
- Storage: Local R2 simulation
- CORS: localhost only

## Features

- ✅ Multi-role authentication (admin, teacher, student)
- ✅ Video upload and streaming via R2
- ✅ Course and lesson management
- ✅ Subscription-based access control
- ✅ Payment integration (Stripe)
- ✅ Audit logging
- ✅ Structured logging system
- ✅ Health monitoring
- ✅ JWT authentication

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Language**: TypeScript
- **Validation**: Zod

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main entry point
│   ├── middleware/           # Auth, validation
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── utils/                # Utilities (logger, token, etc.)
│   └── validators/           # Request schemas
├── migrations/               # Database migrations
├── scripts/                  # Utility scripts
├── wrangler.toml            # Production config
├── wrangler.local.toml      # Local config
└── package.json
```

## Health Check

```bash
curl https://apex-backend.admin-apexfusion.workers.dev/
```

Expected response:
```json
{
  "status": "healthy",
  "message": "Apex Fusion API",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": "connected"
  },
  "timestamp": "2026-10-06T09:30:24.974Z"
}
```

## Logs

View real-time logs:

```bash
npx wrangler tail
```

## Troubleshooting

See [BACKEND_SETUP.md](./BACKEND_SETUP.md) for detailed troubleshooting guide.

## Version

Current version: 1.0.0
Last deployed: 2026-10-06
