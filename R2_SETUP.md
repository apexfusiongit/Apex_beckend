# R2 Storage Setup and Configuration Guide

This document explains how R2 object storage is configured and used in the Apex Fusion backend.

## Overview

Apex Fusion uses Cloudflare R2 for storing video files and other static assets. R2 provides S3-compatible object storage with no egress fees, making it ideal for video streaming applications.

## Configuration

### Wrangler.toml Setup

The R2 bucket is configured in `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "apex-fusion-storage"
```

This creates a binding named `STORAGE` that can be accessed in Cloudflare Workers via `c.env.STORAGE`.

### Environment Bindings

In TypeScript, the binding is defined in the `Bindings` type:

```typescript
type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;  // R2 bucket binding
  ENVIRONMENT: string;
  // ... other bindings
};
```

## R2 Object Structure

### Video Storage Path Pattern

Videos are stored with the following path structure:

```
courses/class-{classLevel}/{courseSlug}/lesson-{lessonId}/{uuid}.{extension}
```

**Example:**
```
courses/class-10/introduction-to-physics/lesson-456/a1b2c3d4-e5f6-7890-abcd-ef1234567890.mp4
```

### Path Components

- **class-{classLevel}**: Groups videos by class level (e.g., class-8, class-9, class-10)
- **{courseSlug}**: URL-safe version of course title (max 60 chars)
- **lesson-{lessonId}**: Groups videos by lesson ID
- **{uuid}**: Unique identifier to prevent filename collisions
- **{extension}**: File extension (.mp4, .webm, .mov)

### Metadata

Each uploaded object includes custom metadata:

```typescript
customMetadata: {
  lessonId: string;      // Associated lesson ID
  courseId: string;      // Associated course ID
  uploadedBy: string;    // User ID who uploaded
}
```

## R2 Operations

### Upload (PUT)

Videos are uploaded via the `/api/videos/upload` endpoint:

```typescript
await c.env.STORAGE.put(key, file.stream(), {
  httpMetadata: {
    contentType: mimeType,
    cacheControl: 'private, max-age=0'
  },
  customMetadata: {
    lessonId: String(lessonId),
    courseId: String(courseId),
    uploadedBy: String(userId)
  },
});
```

**Logging:**
```typescript
logR2Operation('put', key, { userId, lessonId, fileSize: file.size });
```

### Download (GET)

Videos are streamed via the `/api/videos/:id` endpoint:

```typescript
const object = await c.env.STORAGE.get(asset.r2_key, {
  range: { offset, length }  // Optional: for range requests
});
```

**Features:**
- Supports HTTP range requests for video seeking
- Custom cache headers based on demo status
- Authentication required for non-demo videos

**Logging:**
```typescript
logR2Operation('get', asset.r2_key, { videoId: id, isRangeRequest: !!range });
```

### Delete (DELETE)

Videos are deleted via the `/api/videos/:id` endpoint:

```typescript
await c.env.STORAGE.delete(video.r2_key);
```

**Logging:**
```typescript
logR2Operation('delete', video.r2_key, { userId, videoId: id });
```

### List (Optional)

List objects in the bucket (used for health checks):

```typescript
const listed = await c.env.STORAGE.list({ limit: 1 });
```

## Access Control

### Public vs Private Access

- **Demo Videos**: Publicly accessible with `Cache-Control: public, max-age=3600`
- **Premium Videos**: Private with `Cache-Control: private, no-store`
- **Authentication**: Required for non-demo videos via JWT token

### CORS Configuration

CORS is configured in `wrangler.toml`:

```toml
[vars]
CORS_ORIGIN = "https://apex-fusion.admin-apexfusion.workers.dev,http://localhost:5173"
```

## File Size and Type Restrictions

### Supported Formats

- MP4 (video/mp4)
- WebM (video/webm)
- QuickTime (video/quicktime)

### Size Limits

- Maximum: 100 MB per video
- Minimum: 1 byte

### Validation

File type validation is performed in the upload handler:

```typescript
const SUPPORTED_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const mimeType = SUPPORTED_TYPES[extension];
if (!mimeType || file.type !== mimeType) {
  return c.json({ success: false, message: 'Supported formats are MP4, WebM, and QuickTime video.' }, 415);
}
```

## Database Integration

### Video Assets Table

R2 object metadata is stored in the `video_assets` table:

```sql
CREATE TABLE video_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  is_demo INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

### Lesson Reference

The `lessons` table references the primary video:

```sql
ALTER TABLE lessons ADD COLUMN video_key TEXT;
```

## Logging and Monitoring

### R2 Operation Logging

All R2 operations are logged using the `logR2Operation` utility:

```typescript
import { logR2Operation } from '../utils/logger';

logR2Operation('put', key, { userId, lessonId, fileSize });
logR2Operation('get', key, { videoId, isRangeRequest });
logR2Operation('delete', key, { userId, videoId });
```

### Health Check Endpoint

An R2 health check endpoint is available at `/api/admin/r2/health`:

```typescript
app.get('/api/admin/r2/health', async (c) => {
  const listed = await c.env.STORAGE.list({ limit: 1 });
  return c.json({
    success: true,
    storage: 'connected',
    bucket: 'apex-fusion-storage',
    objectCount: listed.objects.length,
  });
});
```

## Error Handling

### Upload Failures

If upload fails, the R2 object is deleted and an error is logged:

```typescript
try {
  await c.env.STORAGE.put(key, file.stream(), options);
  // ... database operations
} catch (error) {
  await c.env.STORAGE.delete(key).catch(() => undefined);
  logEvent(LogLevel.ERROR, 'Video upload failed', { error });
  return c.json({ success: false, message: 'Unable to store this video.' }, 500);
}
```

### Missing Files

If a video file is missing from R2 but exists in the database:

```typescript
const object = await c.env.STORAGE.get(asset.r2_key);
if (!object) {
  logEvent(LogLevel.ERROR, 'Video file not found in R2', { videoId, r2Key });
  return c.json({ success: false, message: 'Video file is unavailable.' }, 404);
}
```

## Security Considerations

1. **Authentication**: All upload/delete operations require JWT authentication
2. **Authorization**: Role-based access control (admin/teacher only)
3. **File Validation**: Strict MIME type and size validation
4. **Path Sanitization**: Course titles are sanitized to prevent path traversal
5. **UUID Filenames**: Prevents filename collisions and enumeration
6. **Private Storage**: Non-demo videos require valid subscription

## Performance Optimization

1. **Streaming**: Videos are streamed directly from R2 without buffering
2. **Range Requests**: Supports HTTP range requests for efficient seeking
3. **Cache Headers**: Appropriate cache headers for demo vs premium content
4. **CDN Integration**: Cloudflare CDN automatically caches R2 content

## Monitoring and Debugging

### Cloudflare Dashboard

Monitor R2 usage at:
https://dash.cloudflare.com/{account-id}/r2

### Metrics to Track

- Total storage usage
- Number of objects
- Upload/download operations
- Error rates
- Average object size

### Log Analysis

Use structured logs to track:
- Upload success/failure rates
- Most accessed videos
- Storage growth over time
- User upload patterns

## Cost Optimization

R2 pricing considerations:

1. **Storage**: Monthly storage cost per GB
2. **Class A Operations**: PUT/COPY/POST (per 1,000 requests)
3. **Class B Operations**: GET/SELECT (per 10,000 requests)
4. **Egress**: Free egress (major advantage over S3)

### Cost-Saving Tips

- Use demo videos for marketing (public cache)
- Implement proper cache headers
- Monitor and clean up unused assets
- Consider video compression before upload

## Troubleshooting

### Common Issues

1. **Upload Fails with 413**
   - File exceeds 100MB limit
   - Solution: Compress video or increase limit

2. **Upload Fails with 415**
   - Unsupported file type
   - Solution: Convert to MP4/WebM/MOV

3. **Video Not Streaming**
   - Missing R2 object
   - Solution: Check logs, re-upload video

4. **CORS Errors**
   - Origin not in allowed list
   - Solution: Update CORS_ORIGIN in wrangler.toml

5. **Authentication Errors**
   - Invalid or expired token
   - Solution: Re-authenticate and get new token

## Future Enhancements

Potential improvements:

1. **Multi-part Upload**: Support for larger files (>100MB)
2. **Video Transcoding**: Automatic format conversion
3. **Thumbnail Generation**: Auto-generate video thumbnails
4. **CDN Pre-warming**: Pre-load popular videos
5. **Analytics**: Detailed video usage analytics
6. **Lifecycle Policies**: Auto-delete old unused assets
