# Apex Fusion Backend Deployment Guide

This guide covers deploying the Apex Fusion backend to Cloudflare Workers.

## Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers enabled
- Wrangler CLI installed: `npm install -g wrangler`
- D1 database created
- R2 bucket created (for video storage)
- KV namespace created (for caching)

## Environment Variables

Configure the following environment variables in your Cloudflare Workers dashboard or `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "production"
PAYMENT_SECRET = "your_payment_gateway_secret"
PAYMENT_WEBHOOK_SECRET = "your_webhook_secret"
ADMIN_CODE = "your_admin_registration_code"

[[d1_databases]]
binding = "DB"
database_name = "apex_fusion_db"
database_id = "your_database_id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex_fusion_videos"

[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"
```

## Database Setup

### 1. Create D1 Database

```bash
wrangler d1 create apex_fusion_db
```

Note the database ID and add it to `wrangler.toml`.

### 2. Run Migrations

```bash
# Apply all migrations
wrangler d1 execute apex_fusion_db --file=./migrations/0001_users.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0002_subjects.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0003_courses.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0004_lessons.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0005_enrollments.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0006_progress.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0007_tests.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0008_questions.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0009_attempts.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0010_subscriptions.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0011_payments.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0012_referrals.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0013_ai.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0014_live_classes.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0015_classes.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0016_chapters.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0017_course_materials.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0018_video_assets.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0019_teacher_courses.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0020_notifications.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0021_audit_logs.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0022_sessions.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0023_devices.sql
wrangler d1 execute apex_fusion_db --file=./migrations/0024_attempt_answers.sql
```

### 3. Create R2 Bucket

```bash
wrangler r2 bucket create apex_fusion_videos
```

### 4. Create KV Namespace

```bash
wrangler kv namespace create CACHE
```

Note the KV namespace ID and add it to `wrangler.toml`.

## Build and Deploy

### 1. Install Dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy to Cloudflare Workers

```bash
wrangler deploy
```

This will deploy your worker to Cloudflare and make it accessible at the URL provided.

## Configuration

### wrangler.toml

Create or update `wrangler.toml` in your project root:

```toml
name = "apex-fusion-backend"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"
PAYMENT_SECRET = "your_payment_gateway_secret"
PAYMENT_WEBHOOK_SECRET = "your_webhook_secret"
ADMIN_CODE = "your_admin_registration_code"

[[d1_databases]]
binding = "DB"
database_name = "apex_fusion_db"
database_id = "your_database_id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex_fusion_videos"

[[kv_namespaces]]
binding = "CACHE"
id = "your_kv_namespace_id"
```

## Payment Gateway Integration

### Razorpay Integration

1. Create a Razorpay account
2. Get API keys from Razorpay dashboard
3. Set `PAYMENT_SECRET` to your Razorpay key secret
4. Configure webhook URL in Razorpay dashboard: `https://your-worker-url/api/payments/webhook`
5. Set `PAYMENT_WEBHOOK_SECRET` to your Razorpay webhook secret

### Stripe Integration (Alternative)

1. Create a Stripe account
2. Get API keys from Stripe dashboard
3. Set `PAYMENT_SECRET` to your Stripe secret key
4. Configure webhook endpoint in Stripe dashboard
5. Set `PAYMENT_WEBHOOK_SECRET` to your Stripe webhook signing secret

## Video Upload to R2

### Upload Videos

Use the Cloudflare R2 API or Wrangler CLI to upload videos:

```bash
# Using Wrangler
wrangler r2 object put apex_fusion_videos/videos/lesson1.mp4 --file=./local_videos/lesson1.mp4
```

Or use the R2 API in your application:

```typescript
await c.env.STORAGE.put('videos/lesson1.mp4', videoData);
```

### Access Videos

Videos are accessed via the `/api/lessons/:id/video` endpoint, which requires:
- Valid JWT authentication
- User enrollment in the course containing the lesson

## Monitoring and Logging

### Cloudflare Dashboard

Monitor your worker through the Cloudflare dashboard:
- View logs in real-time
- Monitor request metrics
- Check error rates
- View analytics

### Local Development

For local development with Wrangler:

```bash
wrangler dev
```

This starts a local development server at `http://localhost:8787`.

## Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **API Keys**: Rotate payment gateway secrets regularly
3. **CORS**: Configure CORS settings in `src/index.ts` for your frontend domain
4. **Rate Limiting**: Implement rate limiting for sensitive endpoints
5. **Input Validation**: Validate all user inputs
6. **SQL Injection**: Use parameterized queries (already implemented)

## Scaling

Cloudflare Workers automatically scale based on traffic:
- No server management required
- Global edge network
- Automatic scaling
- DDoS protection included

## Troubleshooting

### Database Connection Issues

- Verify D1 database ID in `wrangler.toml`
- Check database migrations are applied
- Test database connectivity via Wrangler CLI

### R2 Access Issues

- Verify R2 bucket binding in `wrangler.toml`
- Check bucket permissions
- Verify video keys match uploaded files

### Authentication Failures

- Verify JWT token generation
- Check token expiration settings
- Ensure middleware is applied correctly

### Payment Webhook Issues

- Verify webhook URL is accessible
- Check webhook signature verification
- Test with payment gateway sandbox

## Rollback

To rollback to a previous version:

```bash
# View deployment history
wrangler deployments list

# Rollback to specific version
wrangler rollback <deployment-id>
```

## Production Checklist

Before deploying to production:

- [ ] All database migrations applied
- [ ] Environment variables configured
- [ ] Payment gateway configured and tested
- [ ] R2 bucket created and accessible
- [ ] KV namespace created
- [ ] CORS configured for frontend domain
- [ ] Admin code set and secured
- [ ] Health check endpoint responding
- [ ] Authentication flow tested
- [ ] Payment flow tested in sandbox
- [ ] Video upload and access tested
- [ ] Error monitoring configured
- [ ] Logging configured
- [ ] Rate limiting configured
- [ ] SSL/TLS enabled (automatic with Cloudflare)

## Support

For issues or questions:
- Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
- D1 documentation: https://developers.cloudflare.com/d1/
- R2 documentation: https://developers.cloudflare.com/r2/
- Hono documentation: https://hono.dev/
