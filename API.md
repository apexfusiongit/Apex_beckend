# Apex Fusion API Documentation

## Overview

The Apex Fusion API is a RESTful API built with Hono framework for Cloudflare Workers. It supports Admin, Teacher, Student, and School roles with comprehensive features for learning management.

**Base URL:** `https://api.apexfusion.com` (or your deployed URL)

**Authentication:** Bearer JWT token required for protected endpoints

## Table of Contents

- [Authentication](#authentication)
- [Admin APIs](#admin-apis)
- [Teacher APIs](#teacher-apis)
- [Student APIs](#student-apis)
- [School APIs](#school-apis)
- [Courses](#courses)
- [Lessons](#lessons)
- [Tests](#tests)
- [Progress](#progress)
- [Payments](#payments)
- [Subscriptions](#subscriptions)
- [Live Classes](#live-classes)
- [AI Coach](#ai-coach)
- [Referrals](#referrals)

---

## Authentication

### Register User

**POST** `/api/auth/register`

Register a new user (admin, student, teacher, or school).

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "SecurePassword123",
  "role": "student",
  "class": "10th Grade",
  "adminCode": "ADMIN_SECRET" // Required only for admin registration
}
```

**Response (201):**
```json
{
  "success": true,
  "userId": 1,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "class": "10th Grade"
  }
}
```

### Login

**POST** `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "class": "10th Grade",
    "redirectPath": "/student/dashboard"
  }
}
```

### Get Current User

**GET** `/api/auth/me`

Get the currently authenticated user's details.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "student"
  }
}
```

---

## Admin APIs

All Admin APIs require authentication and admin role.

### Dashboard

**GET** `/api/admin/dashboard`

Get admin dashboard analytics.

**Response (200):**
```json
{
  "success": true,
  "analytics": {
    "totalUsers": 150,
    "totalCourses": 25,
    "totalTests": 50,
    "totalPayments": 75,
    "activeSubscriptions": 60
  }
}
```

### Users

**GET** `/api/admin/users?role=student`

Get all users with optional role filter.

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student",
      "class": "10th Grade",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**GET** `/api/admin/users/:id`

Get a specific user by ID.

**PUT** `/api/admin/users/:id`

Update a user.

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "phone": "+1234567890",
  "role": "student",
  "class": "11th Grade",
  "status": "active"
}
```

**DELETE** `/api/admin/users/:id`

Delete a user.

### Classes

**GET** `/api/admin/classes`

Get all classes.

**POST** `/api/admin/classes`

Create a new class.

**Request Body:**
```json
{
  "name": "10th Grade",
  "description": "Class for 10th grade students"
}
```

**PUT** `/api/admin/classes/:id`

Update a class.

**DELETE** `/api/admin/classes/:id`

Delete a class.

### Subjects

**GET** `/api/admin/subjects?classId=1`

Get all subjects with optional class filter.

**POST** `/api/admin/subjects`

Create a new subject.

**Request Body:**
```json
{
  "name": "Mathematics",
  "classId": 1,
  "description": "Advanced mathematics"
}
```

**PUT** `/api/admin/subjects/:id`

Update a subject.

**DELETE** `/api/admin/subjects/:id`

Delete a subject.

### Courses

**GET** `/api/admin/courses`

Get all courses.

**POST** `/api/admin/courses`

Create a new course.

**Request Body:**
```json
{
  "title": "Advanced Mathematics",
  "description": "Complete mathematics course",
  "subjectId": 1,
  "class": "10th Grade",
  "thumbnail": "https://example.com/thumbnail.jpg",
  "price": 299,
  "isFree": 0,
  "teacherId": 5
}
```

**PUT** `/api/admin/courses/:id`

Update a course.

**DELETE** `/api/admin/courses/:id`

Delete a course.

### Chapters

**GET** `/api/admin/courses/:courseId/chapters`

Get chapters for a course.

**POST** `/api/admin/courses/:courseId/chapters`

Create a new chapter.

**Request Body:**
```json
{
  "title": "Chapter 1: Algebra",
  "description": "Introduction to algebra",
  "orderIndex": 1
}
```

**PUT** `/api/admin/chapters/:id`

Update a chapter.

**DELETE** `/api/admin/chapters/:id`

Delete a chapter.

### Lessons

**GET** `/api/admin/chapters/:chapterId/lessons`

Get lessons for a chapter.

**POST** `/api/admin/chapters/:chapterId/lessons`

Create a new lesson.

**Request Body:**
```json
{
  "title": "Lesson 1: Variables",
  "description": "Understanding variables",
  "videoKey": "videos/lesson1.mp4",
  "thumbnail": "https://example.com/thumb.jpg",
  "duration": 1800,
  "orderNo": 1
}
```

**PUT** `/api/admin/lessons/:id`

Update a lesson.

**DELETE** `/api/admin/lessons/:id`

Delete a lesson.

### Tests

**GET** `/api/admin/tests?courseId=1`

Get all tests with optional course filter.

**POST** `/api/admin/tests`

Create a new test.

**Request Body:**
```json
{
  "courseId": 1,
  "title": "Algebra Quiz",
  "description": "Test your algebra knowledge",
  "duration": 30,
  "totalMarks": 100
}
```

**PUT** `/api/admin/tests/:id`

Update a test.

**DELETE** `/api/admin/tests/:id`

Delete a test.

### Questions

**GET** `/api/admin/tests/:testId/questions`

Get questions for a test.

**POST** `/api/admin/tests/:testId/questions`

Create a new question.

**Request Body:**
```json
{
  "question": "What is 2 + 2?",
  "optionA": "3",
  "optionB": "4",
  "optionC": "5",
  "optionD": "6",
  "correctAnswer": "B",
  "marks": 5,
  "orderNo": 1
}
```

**PUT** `/api/admin/questions/:id`

Update a question.

**DELETE** `/api/admin/questions/:id`

Delete a question.

### Payments

**GET** `/api/admin/payments`

Get all payments.

### Referrals

**GET** `/api/admin/referrals`

Get all referrals.

### Live Classes

**GET** `/api/admin/live-classes`

Get all live classes.

**POST** `/api/admin/live-classes`

Create a new live class.

**Request Body:**
```json
{
  "title": "Mathematics Live Session",
  "subject": "Mathematics",
  "teacherId": 5,
  "startTime": "2024-02-01T10:00:00Z",
  "endTime": "2024-02-01T11:00:00Z",
  "joinUrl": "https://zoom.us/j/123456789"
}
```

**PUT** `/api/admin/live-classes/:id`

Update a live class.

**DELETE** `/api/admin/live-classes/:id`

Delete a live class.

### Teacher Assignments

**POST** `/api/admin/teacher-courses`

Assign a teacher to a course.

**Request Body:**
```json
{
  "teacherId": 5,
  "courseId": 1
}
```

**DELETE** `/api/admin/teacher-courses/:id`

Remove a teacher assignment.

### Audit Logs

**GET** `/api/admin/audit-logs?limit=100&offset=0`

Get audit logs with pagination.

---

## Teacher APIs

All Teacher APIs require authentication and teacher/admin role.

### Dashboard

**GET** `/api/teachers/dashboard`

Get teacher dashboard analytics.

**Response (200):**
```json
{
  "success": true,
  "analytics": {
    "assignedCourses": 5,
    "totalStudents": 150,
    "scheduledLiveClasses": 3
  }
}
```

### Courses

**GET** `/api/teachers/courses`

Get assigned courses.

**GET** `/api/teachers/courses/:id`

Get an assigned course by ID.

### Chapters

**GET** `/api/teachers/courses/:courseId/chapters`

Get chapters for an assigned course.

**POST** `/api/teachers/courses/:courseId/chapters`

Create a chapter for an assigned course.

**PUT** `/api/teachers/chapters/:id`

Update a chapter.

**DELETE** `/api/teachers/chapters/:id`

Delete a chapter.

### Lessons

**GET** `/api/teachers/chapters/:chapterId/lessons`

Get lessons for a chapter.

**POST** `/api/teachers/chapters/:chapterId/lessons`

Create a lesson.

**PUT** `/api/teachers/lessons/:id`

Update a lesson.

**DELETE** `/api/teachers/lessons/:id`

Delete a lesson.

### Students

**GET** `/api/teachers/students`

Get students in assigned courses.

**GET** `/api/teachers/students/:studentId/progress`

Get a student's progress.

### Tests

**GET** `/api/teachers/tests`

Get tests for assigned courses.

**POST** `/api/teachers/tests`

Create a test for an assigned course.

### Live Classes

**GET** `/api/teachers/live-classes`

Get live classes for the teacher.

**POST** `/api/teachers/live-classes`

Create a live class.

**PUT** `/api/teachers/live-classes/:id`

Update a live class.

**DELETE** `/api/teachers/live-classes/:id`

Delete a live class.

---

## Student APIs

All Student APIs require authentication and student/teacher/admin role.

### Dashboard

**GET** `/api/students/dashboard`

Get student dashboard analytics.

**Response (200):**
```json
{
  "success": true,
  "analytics": {
    "enrolledCourses": 5,
    "completedLessons": 25,
    "testAttempts": 10,
    "hasActiveSubscription": true,
    "subscriptionEnd": "2024-12-31T23:59:59Z"
  }
}
```

### Courses

**GET** `/api/students/courses`

Get enrolled courses.

**GET** `/api/students/courses/:id`

Get an enrolled course by ID.

**POST** `/api/students/courses/:id/enroll`

Enroll in a course.

### Chapters

**GET** `/api/students/courses/:courseId/chapters`

Get chapters for an enrolled course.

### Lessons

**GET** `/api/students/chapters/:chapterId/lessons`

Get lessons for a chapter.

**GET** `/api/students/lessons/:id`

Get a lesson by ID.

### Progress

**GET** `/api/students/progress`

Get progress for all enrolled courses.

**GET** `/api/students/courses/:courseId/progress`

Get progress for a specific course.

**PUT** `/api/students/lessons/:lessonId/progress`

Update lesson progress.

**Request Body:**
```json
{
  "progressPercent": 75,
  "completed": false,
  "lastPosition": 900
}
```

### Tests

**GET** `/api/students/tests`

Get tests for enrolled courses.

**GET** `/api/students/tests/:id`

Get a test by ID (without correct answers).

**GET** `/api/students/tests/:testId/attempts`

Get user's test attempts.

**POST** `/api/students/tests/:testId/attempts`

Start a test attempt.

**PUT** `/api/students/attempts/:id`

Submit a test attempt.

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": 1,
      "selectedAnswer": "B"
    }
  ]
}
```

**GET** `/api/students/attempts/:id`

Get attempt results with correct answers.

### Live Classes

**GET** `/api/students/live-classes`

Get live classes for enrolled courses.

### Subscriptions

**GET** `/api/students/subscription`

Get active subscription.

### Payments

**GET** `/api/students/payments`

Get user payments.

### Referrals

**GET** `/api/students/referrals`

Get user referrals.

**POST** `/api/students/referrals/generate`

Generate a referral code.

### Notifications

**GET** `/api/students/notifications`

Get user notifications.

**PUT** `/api/students/notifications/:id/read`

Mark notification as read.

**PUT** `/api/students/notifications/read-all`

Mark all notifications as read.

---

## School APIs

All School APIs require authentication and school role.

### Dashboard

**GET** `/api/schools/dashboard`

Get school dashboard analytics.

**Response (200):**
```json
{
  "success": true,
  "analytics": {
    "totalStudents": 200,
    "totalTeachers": 15,
    "schoolName": "ABC High School"
  }
}
```

### Profile

**POST** `/api/schools/register`

Register a new school.

**Request Body:**
```json
{
  "name": "ABC High School",
  "email": "admin@abchigh.com",
  "phone": "+1234567890",
  "schoolName": "ABC High School",
  "address": "123 Main St"
}
```

**GET** `/api/schools/profile`

Get school profile.

**PUT** `/api/schools/profile`

Update school profile.

### Students

**GET** `/api/schools/students`

Get school students.

**POST** `/api/schools/students`

Add a student to school.

**Request Body:**
```json
{
  "name": "Student Name",
  "email": "student@example.com",
  "phone": "+1234567890",
  "class": "10th Grade",
  "password": "SecurePassword123"
}
```

**PUT** `/api/schools/students/:id`

Update a student.

**DELETE** `/api/schools/students/:id`

Delete a student.

### Teachers

**GET** `/api/schools/teachers`

Get school teachers.

**POST** `/api/schools/teachers`

Add a teacher to school.

**Request Body:**
```json
{
  "name": "Teacher Name",
  "email": "teacher@example.com",
  "phone": "+1234567890",
  "password": "SecurePassword123"
}
```

**PUT** `/api/schools/teachers/:id`

Update a teacher.

**DELETE** `/api/schools/teachers/:id`

Delete a teacher.

### Analytics

**GET** `/api/schools/analytics`

Get school analytics.

---

## Courses

**GET** `/api/courses`

Get all courses with optional filters.

**Query Parameters:**
- `subjectId`: Filter by subject
- `class`: Filter by class
- `isFree`: Filter by free courses (0 or 1)

**GET** `/api/courses/:id`

Get a course by ID.

**GET** `/api/courses/:id/lessons`

Get lessons for a course.

**POST** `/api/courses/:id/enroll`

Enroll in a course (requires authentication).

---

## Lessons

**GET** `/api/lessons/:id`

Get a lesson by ID.

**GET** `/api/lessons/:id/video`

Get video URL from R2 (requires authentication and enrollment).

---

## Tests

**GET** `/api/tests`

Get all tests.

**GET** `/api/tests/:id`

Get a test by ID with questions.

**POST** `/api/tests`

Create a test (admin only).

---

## Progress

**GET** `/api/progress`

Get overall progress (requires authentication).

**GET** `/api/progress/:courseId`

Get progress for a specific course (requires authentication).

**POST** `/api/progress`

Update lesson progress (requires authentication).

---

## Payments

**POST** `/api/payments/create-order`

Create a payment order.

**Request Body:**
```json
{
  "userId": 1,
  "amount": 299,
  "planId": 2,
  "currency": "INR"
}
```

**Response (200):**
```json
{
  "success": true,
  "orderId": "order_1234567890_1_abc123",
  "paymentUrl": "https://payment-gateway.example.com/pay?orderId=..."
}
```

**POST** `/api/payments/verify`

Verify payment and activate subscription.

**Request Body:**
```json
{
  "orderId": "order_1234567890_1_abc123",
  "paymentId": "pay_123456",
  "status": "completed"
}
```

**POST** `/api/payments/webhook`

Payment webhook handler (for payment gateway callbacks).

**GET** `/api/payments/user/:userId`

Get user payments.

---

## Subscriptions

**GET** `/api/subscriptions/:userId`

Get user subscription.

**POST** `/api/subscriptions`

Create a new subscription.

**Request Body:**
```json
{
  "userId": 1,
  "planId": 2
}
```

**GET** `/api/subscriptions/plans`

Get available subscription plans.

---

## Live Classes

**GET** `/api/live-classes`

Get all scheduled live classes.

**GET** `/api/live-classes/:id`

Get a live class by ID.

**POST** `/api/live-classes`

Create a live class (admin/teacher only).

---

## AI Coach

**POST** `/api/ai/chat`

Chat with AI tutor.

**Request Body:**
```json
{
  "userId": 1,
  "message": "Explain quadratic equations",
  "sessionId": "session_123"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": "Quadratic equations are polynomial equations of degree 2...",
  "sessionId": "session_123"
}
```

**GET** `/api/ai/sessions/:userId`

Get AI chat sessions for a user.

**GET** `/api/ai/sessions/:sessionId/messages`

Get messages for a session.

---

## Referrals

**GET** `/api/referrals/:userId`

Get user referrals.

**POST** `/api/referrals`

Create a referral.

**Request Body:**
```json
{
  "referrerId": 1,
  "referralCode": "REF123"
}
```

**GET** `/api/referrals/stats/:userId`

Get referral statistics.

**POST** `/api/referrals/generate`

Generate a referral code.

**POST** `/api/referrals/validate`

Validate a referral code.

**Request Body:**
```json
{
  "referralCode": "REF123"
}
```

---

## Health Check

**GET** `/`

Check API health status.

**Response (200):**
```json
{
  "status": "healthy",
  "message": "Apex Fusion API",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": "connected",
    "storage": "available",
    "cache": "available"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid request data"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## Rate Limiting

API requests are rate-limited to prevent abuse. Standard rate limits:
- 100 requests per minute per IP
- 1000 requests per hour per user

---

## Webhook Signatures

Payment webhooks include a signature in the `x-webhook-signature` header for verification. Implement signature verification in production to ensure webhook authenticity.

---

## Pagination

List endpoints support pagination via query parameters:
- `limit`: Number of items per page (default: 50)
- `offset`: Number of items to skip (default: 0)

Example: `/api/admin/audit-logs?limit=100&offset=0`
