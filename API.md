# Apex Fusion API

Base URL for local development: `http://localhost:8787`. Production Worker URL: `https://apex-backend.admin-apexfusion.workers.dev`.

Protected requests send `Authorization: Bearer <JWT>`. The Worker verifies the HMAC signature and expiry, then reads the active user and role from D1.

## Available endpoints

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | Checks D1 and reports the environment and timestamp. |
| POST | `/api/signup` | Public | Creates a student, parent, or teacher account and signup metadata. |
| POST | `/api/auth/register` | Public | Creates a student or teacher account; privileged roles are rejected. |
| POST | `/api/auth/login` | Public | Returns a signed JWT and user profile. |
| GET | `/api/auth/me` | JWT | Returns the current D1 identity and role. |
| POST | `/api/auth/logout` | JWT | Records logout activity; clients should discard the token. |
| GET | `/api/admin/dashboard` | Admin | Returns actual user and signup activity counts. |
| POST | `/api/videos/upload` | Admin or assigned teacher | Multipart form fields `lessonId`, `file`, optional `isDemo`. MP4/WebM/QuickTime, up to 100 MB. |
| GET | `/api/videos` | Admin or teacher | Admin sees all active video metadata; teachers only see assigned courses. |
| GET | `/api/videos/courses` | Admin or teacher | Admin sees all courses; teachers see assigned courses. |
| GET | `/api/videos/courses/:courseId/lessons` | Admin or assigned teacher | Lessons available for upload. |
| POST | `/api/videos/courses` | Admin | Creates a draft course in Classes 8–10 and may assign a teacher by email. |
| POST | `/api/videos/courses/:courseId/lessons` | Admin | Creates a lesson in the selected course. |
| POST | `/api/videos/courses/:courseId/assign-teacher` | Admin | Assigns an existing teacher to the course. JSON: `{ "email": "teacher@example.com" }`. |
| GET | `/api/videos/:id` | Public demo; subscribed enrolled student otherwise | Streams the R2 object and supports byte ranges. |
| GET | `/api/payments/config` | Public | Reports whether the configured Razorpay test/live checkout is available. |
| POST | `/api/payments/create-order` | Student | Creates a server-priced ₹300 INR monthly Razorpay order. |
| POST | `/api/payments/verify` | Student | Verifies the Checkout signature and confirms captured amount/status with Razorpay before activating access. |
| POST | `/api/payments/webhook` | Razorpay signed webhook | Validates the raw body with `PAYMENT_WEBHOOK_SECRET`; event ID and payment linkage make delivery idempotent. |
| GET | `/api/payments/history` | Student | Lists the signed-in student's payments. |
| GET | `/api/payments/subscription/status` | Student | Returns current active subscription status. |
| DELETE | `/api/videos/:id` | Admin or assigned teacher | Deletes the R2 object and retires its D1 metadata. |

Errors use `{ "success": false, "message": "..." }`. Checkout stays unavailable until a mode-matched Razorpay key ID and secret are configured. The backend defaults to sandbox mode (`PAYMENT_MODE=test`) and accepts only `rzp_test_` keys in that mode. A verified capture activates one monthly plan and enrolls the student in currently active courses. Configure `/api/payments/webhook` for `payment.captured` and `order.paid`; the server also records signed `payment.failed` events.

## Video upload example

```sh
curl -X POST "$API_URL/api/videos/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "lessonId=1" \
  -F "isDemo=false" \
  -F "file=@lesson.mp4;type=video/mp4"
```

The backend derives the course from the lesson. Teachers must have a matching `teacher_courses` assignment. Students, schools, and anonymous callers cannot upload. Video bytes go to R2; D1 stores metadata.
