# Apex Fusion Backend - Complete Setup and Integration Guide

This document provides comprehensive information about the Apex Fusion backend setup, deployment, and frontend integration.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Environment Setup](#environment-setup)
4. [Database Configuration](#database-configuration)
5. [R2 Storage Setup](#r2-storage-setup)
6. [Deployment](#deployment)
7. [API Endpoints](#api-endpoints)
8. [Frontend Integration](#frontend-integration)
9. [Authentication](#authentication)
10. [Logging and Monitoring](#logging-and-monitoring)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Apex Fusion is a student learning platform built with:
- **Runtime**: Cloudflare Workers (Edge computing)
- **Framework**: Hono (Fast, lightweight web framework)
- **Database**: Cloudflare D1 (SQLite-based edge database)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Language**: TypeScript

### Key Features

- Video course management and streaming
- Multi-role authentication (admin, teacher, student)
- Subscription-based access control
- Payment integration (Stripe)
- Audit logging
- Real-time health monitoring

---

## Architecture

### Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                     │
│                  http://localhost:5173                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTPS API Calls
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Cloudflare Workers (Hono Backend)                │
│         https://apex-backend.admin-apexfusion.workers.dev    │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Auth Routes  │  │ Video Routes │  │ Admin Routes │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────┬──────────────────┬──────────────────┬───────────┘
           │                  │                  │
┌──────────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────┐
│  D1 Database    │  │   R2 Storage    │  │  Cloudflare KV  │
│  (SQLite)       │  │  (Video Files)  │  │  (Optional)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main entry point
│   ├── middleware/
│   │   ├── auth.ts           # Authentication middleware
│   │   └── validation.ts     # Request validation
│   ├── routes/
│   │   ├── auth.ts           # Login, register, logout
│   │   ├── admin.ts          # Admin operations
│   │   ├── videos.ts         # Video upload/streaming
│   │   ├── catalog.ts        # Course catalog
│   │   ├── payments.ts       # Payment webhooks
│   │   └── marketingSignup.ts
│   ├── services/
│   │   ├── audit.service.ts  # Audit logging
│   │   └── notification.service.ts
│   ├── utils/
│   │   ├── logger.ts         # Logging utilities
│   │   ├── token.ts          # JWT token management
│   │   ├── password.ts       # Password hashing
│   │   └── date.ts           # Date utilities
│   └── validators/
│       ├── login.schema.ts
│       ├── signup.schema.ts
│       └── schemas.ts
├── migrations/
│   ├── 0001_core_baseline.sql
│   ├── 0031_platform_extensions.sql
│   └── 0032_payment_webhooks.sql
├── scripts/
│   ├── run-migrations.js     # Database migration runner
│   └── migrate-marketing-signups.js
├── wrangler.toml             # Production config
├── wrangler.local.toml       # Local development config
├── package.json
├── tsconfig.json
└── POSTMAN_SETUP.md          # Postman collection guide
```

---

## Environment Setup

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Wrangler CLI installed

### Installation

```bash
# Install dependencies
cd backend
npm install

# Install Wrangler globally (if not already installed)
npm install -g wrangler
```

### Authentication

```bash
# Login to Cloudflare
npx wrangler login

# Verify authentication
npx wrangler whoami
```

### Environment Variables

#### Production (wrangler.toml)

```toml
name = "apex-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
CORS_ORIGIN = "https://apex-fusion.admin-apexfusion.workers.dev,http://localhost:5173"
PAYMENT_MODE = "test"

[[d1_databases]]
binding = "DB"
database_name = "apex-fusion-db"
database_id = "071fab92-f25c-4932-a110-11b38579bc38"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex-fusion-storage"
```

#### Local Development (wrangler.local.toml)

```toml
name = "apex-backend-local"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "development"
CORS_ORIGIN = "http://localhost:5173"
PAYMENT_MODE = "test"

[[d1_databases]]
binding = "DB"
database_name = "apex-fusion-db"
database_id = "11111111-1111-4111-8111-111111111114"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex-fusion-storage"
```

### Secrets Management

Set sensitive environment variables:

```bash
# Set JWT secret for production
npx wrangler secret put JWT_SECRET

# Set admin credentials (optional - can be set via database)
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

---

## Database Configuration

### Creating D1 Database

```bash
# Create database (only needed once)
npx wrangler d1 create apex-fusion-db

# Note the database_id from output and add to wrangler.toml
```

### Running Migrations

#### Remote (Production)

```bash
npm run db:migrate -- --remote
```

#### Local Development

```bash
npm run db:migrate -- --local
# or
npm run db:migrate:local
```

### Migration Files

Migrations are stored in `migrations/` directory:

- `0001_core_baseline.sql` - Core tables (users, courses, lessons, etc.)
- `0031_platform_extensions.sql` - Platform extensions
- `0032_payment_webhooks.sql` - Payment webhook tables

### Database Schema

#### Key Tables

- **users** - User accounts and authentication
- **courses** - Course information
- **lessons** - Lesson content
- **video_assets** - Video file metadata
- **enrollments** - Student course enrollments
- **subscriptions** - Subscription plans
- **audit_logs** - Audit trail

#### Running Custom SQL

```bash
# Execute SQL on remote database
npx wrangler d1 execute apex-fusion-db --remote --command="SELECT * FROM users LIMIT 10"

# Execute SQL file
npx wrangler d1 execute apex-fusion-db --remote --file=./custom-query.sql
```

---

## R2 Storage Setup

### Creating R2 Bucket

```bash
# Create R2 bucket (only needed once)
npx wrangler r2 bucket create apex-fusion-storage
```

### R2 Configuration

The R2 bucket is configured in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex-fusion-storage"
```

### R2 Object Structure

Videos are stored with the following path pattern:

```
courses/class-{classLevel}/{courseSlug}/lesson-{lessonId}/{uuid}.{extension}
```

Example:
```
courses/class-10/introduction-to-physics/lesson-456/a1b2c3d4-e5f6-7890-abcd-ef1234567890.mp4
```

### R2 Operations

See [R2_SETUP.md](./R2_SETUP.md) for detailed R2 configuration and usage.

---

## Deployment

### Building the Project

```bash
# TypeScript compilation
npm run build

# Type checking
npm run typecheck
```

### Deploying to Production

```bash
# Deploy to Cloudflare Workers
npm run deploy

# This uses wrangler.toml configuration
```

### Deployment Output

Successful deployment shows:

```
Uploaded apex-backend (8.00 sec)
Deployed apex-backend triggers (3.68 sec)
  https://apex-backend.admin-apexfusion.workers.dev
Current Version ID: 9dd1eae2-469c-41dc-96e7-feb2773c021c
```

### Verifying Deployment

```bash
# Health check
curl https://apex-backend.admin-apexfusion.workers.dev/

# Expected response:
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

### Local Development

```bash
# Start local development server
npm run dev

# Start with local D1 and R2 simulation
npm run dev:local
```

Local server runs at: `http://localhost:8787`

---

## API Endpoints

### Base URL

- **Production**: `https://apex-backend.admin-apexfusion.workers.dev`
- **Local**: `http://localhost:8787`

### Authentication Endpoints

#### POST /api/auth/login
Login and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "role": "student"
    }
  }
}
```

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "name": "Jane Doe",
  "role": "student"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "role": "student"
  }
}
```

### Course Management Endpoints

#### POST /api/videos/courses
Create a new course (Admin only).

**Headers:**
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Introduction to Physics",
  "subject": "Physics",
  "classLevel": "Class 10",
  "description": "Learn the fundamentals of physics",
  "teacherEmail": "teacher@example.com",
  "status": "draft"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Introduction to Physics",
    "class": "10",
    "status": "draft"
  }
}
```

#### GET /api/videos/courses
List all courses (Admin/Teacher).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Introduction to Physics",
      "class": "10"
    }
  ]
}
```

### Lesson Management Endpoints

#### POST /api/videos/courses/{courseId}/lessons
Create a new lesson (Admin only).

**Headers:**
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Newton's Laws of Motion",
  "description": "Understanding the three laws of motion"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Newton's Laws of Motion",
    "courseId": 1
  }
}
```

#### GET /api/videos/courses/{courseId}/lessons
List lessons for a course.

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Newton's Laws of Motion",
      "chapter_id": null
    }
  ]
}
```

### Video Upload Endpoint

#### POST /api/videos/upload
Upload a video to R2 (Admin/Teacher).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Body (form-data):**
- `lessonId`: Lesson ID (text)
- `file`: Video file (file)
- `isDemo`: "true" or "false" (text, optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "lessonId": 1,
    "r2Key": "courses/class-10/introduction-to-physics/lesson-1/abc123.mp4",
    "fileName": "lesson1.mp4",
    "fileSize": 52428800,
    "mimeType": "video/mp4"
  }
}
```

### Video Streaming Endpoint

#### GET /api/videos/{id}
Stream a video.

**Headers:**
```
Authorization: Bearer {jwt_token} (required for non-demo videos)
Range: bytes=0- (optional, for range requests)
```

**Response:**
- Video stream with appropriate headers
- Supports HTTP range requests for seeking

### Video Management Endpoints

#### GET /api/videos
List all videos (Admin/Teacher).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "lesson_id": 1,
      "course_id": 1,
      "file_name": "lesson1.mp4",
      "file_size": 52428800,
      "mime_type": "video/mp4",
      "is_demo": 0,
      "status": "active",
      "created_at": "2026-10-06T09:30:00.000Z",
      "lesson_title": "Newton's Laws of Motion",
      "course_title": "Introduction to Physics"
    }
  ]
}
```

#### DELETE /api/videos/{id}
Delete a video (Admin/Teacher).

**Headers:**
```
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123
  }
}
```

### Health Check Endpoints

#### GET /
Health check with database status.

**Response:**
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

#### GET /health
Simple health check.

**Response:**
```json
{
  "success": true,
  "service": "apex-fusion-api",
  "database": "connected",
  "environment": "production",
  "timestamp": "2026-10-06T09:30:24.974Z"
}
```

#### GET /api/admin/r2/health
R2 storage health check (Admin).

**Response:**
```json
{
  "success": true,
  "storage": "connected",
  "bucket": "apex-fusion-storage",
  "environment": "production",
  "objectCount": 42,
  "timestamp": "2026-10-06T09:30:24.974Z"
}
```

---

## Frontend Integration

### API Base URL Configuration

Create environment configuration in frontend:

#### Frontend .env (Development)
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_APP_URL=http://localhost:5173
```

#### Frontend .env.production
```env
VITE_API_BASE_URL=https://apex-backend.admin-apexfusion.workers.dev
VITE_APP_URL=https://apex-fusion.admin-apexfusion.workers.dev
```

### API Client Setup

Create an API client utility:

```typescript
// src/utils/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = {
  async request(
    endpoint: string,
    options: RequestInit = {}
  ) {
    const token = localStorage.getItem('jwt_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  },

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  },

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};
```

### Authentication Flow

#### Login

```typescript
import { apiClient } from '@/utils/api';

async function login(email: string, password: string) {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email,
      password,
    });

    if (response.success) {
      localStorage.setItem('jwt_token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data.user;
    }
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
```

#### Protected Route Component

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    // Verify token
    apiClient.get('/api/auth/verify')
      .then(() => setIsAuthenticated(true))
      .catch(() => {
        localStorage.removeItem('jwt_token');
        window.location.href = '/login';
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

### Video Upload Integration

#### Upload Component

```typescript
import { useState } from 'react';
import { apiClient } from '@/utils/api';

function VideoUpload({ lessonId }: { lessonId: number }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('lessonId', lessonId.toString());
    formData.append('file', file);
    formData.append('isDemo', 'false');

    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/videos/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log('Upload successful:', result.data);
        setProgress(100);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
        disabled={uploading}
      />
      {uploading && <div>Uploading... {progress}%</div>}
    </div>
  );
}
```

### Video Streaming Integration

#### Video Player Component

```typescript
import { useRef, useEffect } from 'react';

function VideoPlayer({ videoId }: { videoId: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    const videoUrl = `${import.meta.env.VITE_API_BASE_URL}/api/videos/${videoId}`;

    if (videoRef.current) {
      videoRef.current.src = videoUrl;
      // Add token to video requests if needed
      // Note: This may require a different approach for video streaming
    }
  }, [videoId]);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="nodownload"
      style={{ width: '100%', maxWidth: '800px' }}
    />
  );
}
```

**Note:** For video streaming with authentication, you may need to:
1. Use URL parameters with token (less secure)
2. Implement a signed URL system
3. Use cookies for authentication
4. Use a proxy service

### Error Handling

#### Global Error Handler

```typescript
// src/utils/errorHandler.ts
export function handleApiError(error: any) {
  if (error.message === 'Authentication required') {
    localStorage.removeItem('jwt_token');
    window.location.href = '/login';
  } else if (error.message === 'Student access required') {
    alert('This content requires an active subscription');
  } else {
    console.error('API Error:', error);
    alert(error.message || 'An error occurred');
  }
}
```

### CORS Configuration

Ensure your frontend URL is in the CORS_ORIGIN list in `wrangler.toml`:

```toml
[vars]
CORS_ORIGIN = "https://apex-fusion.admin-apexfusion.workers.dev,http://localhost:5173"
```

---

## Authentication

### JWT Token Structure

Tokens are signed using the JWT_SECRET environment variable.

**Token Payload:**
```json
{
  "sub": "1",           // User ID
  "email": "user@example.com",
  "role": "student",
  "iat": 1234567890,    // Issued at
  "exp": 1234571490     // Expiration
}
```

### Token Storage

Store JWT token in localStorage (for development) or httpOnly cookies (for production):

```typescript
// Development
localStorage.setItem('jwt_token', token);

// Production (recommended)
// Use httpOnly cookies set by the backend
```

### Token Refresh

Implement token refresh logic:

```typescript
async function refreshToken() {
  try {
    const response = await apiClient.post('/api/auth/refresh');
    if (response.success) {
      localStorage.setItem('jwt_token', response.data.token);
      return response.data.token;
    }
  } catch (error) {
    localStorage.removeItem('jwt_token');
    window.location.href = '/login';
  }
}
```

---

## Logging and Monitoring

### Structured Logging

The backend uses structured logging via the `logger.ts` utility:

```typescript
import { logEvent, LogLevel, logR2Operation } from '../utils/logger';

// Log event
logEvent(LogLevel.INFO, 'User logged in', {
  userId: 1,
  userEmail: 'user@example.com',
});

// Log R2 operation
logR2Operation('put', 'courses/class-10/lesson-1/video.mp4', {
  userId: 1,
  fileSize: 52428800,
});
```

### Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARN**: Warning messages
- **ERROR**: Error messages

### Monitoring Endpoints

- `GET /` - Health check with database status
- `GET /health` - Simple health check
- `GET /api/admin/r2/health` - R2 storage health check

### Cloudflare Analytics

Monitor your Worker at:
https://dash.cloudflare.com/{account-id}/workers/view/apex-backend

Metrics available:
- Request count
- Error rate
- Response time
- CPU usage
- Memory usage

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom:** Browser console shows CORS error

**Solution:**
- Verify frontend URL is in CORS_ORIGIN
- Check that Authorization header is sent
- Ensure preflight OPTIONS requests are handled

#### 2. Authentication Failures

**Symptom:** 401 Unauthorized errors

**Solution:**
- Verify JWT_SECRET is set in Cloudflare
- Check token expiration
- Ensure token is sent in Authorization header
- Verify user status is 'active'

#### 3. Database Connection Issues

**Symptom:** 503 Service Unavailable with database error

**Solution:**
- Verify D1 database is created
- Check database_id in wrangler.toml
- Run migrations if needed
- Check Cloudflare dashboard for D1 status

#### 4. R2 Upload Failures

**Symptom:** Upload fails with 500 error

**Solution:**
- Verify R2 bucket exists
- Check bucket binding in wrangler.toml
- Ensure file size < 100MB
- Verify file type is supported
- Check R2 credentials

#### 5. Video Streaming Issues

**Symptom:** Video won't play or errors

**Solution:**
- Verify video exists in R2
- Check user has active subscription
- Ensure token is valid
- Verify MIME type is correct
- Check network connectivity

### Debug Mode

Enable detailed logging:

```typescript
// In development, set log level to DEBUG
const logLevel = c.env.ENVIRONMENT === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
```

### Viewing Logs

```bash
# Tail Worker logs in real-time
npx wrangler tail

# Tail with specific filter
npx wrangler tail --format pretty
```

### Database Debugging

```bash
# Query database directly
npx wrangler d1 execute apex-fusion-db --remote --command="SELECT * FROM users"

# View database schema
npx wrangler d1 execute apex-fusion-db --remote --command="SELECT sql FROM sqlite_master WHERE type='table'"
```

---

## Additional Resources

### Documentation

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework Documentation](https://hono.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Postman Setup Guide](./POSTMAN_SETUP.md)
- [R2 Setup Guide](./R2_SETUP.md)

### Support

For issues or questions:
1. Check this documentation
2. Review Cloudflare dashboard logs
3. Check Cloudflare status page
4. Contact support if needed

---

## Changelog

### 2026-10-06
- Added comprehensive logging system
- Enhanced R2 operation logging
- Added R2 health check endpoint
- Deployed to production
- Created documentation

---

## Version

Current backend version: 1.0.0
Deployment date: 2026-10-06
Worker URL: https://apex-backend.admin-apexfusion.workers.dev
