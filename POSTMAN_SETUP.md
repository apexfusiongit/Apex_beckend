# Postman Setup Guide for Apex Fusion R2 Bucket Interactions

This guide provides step-by-step instructions for setting up Postman to interact with the Apex Fusion backend and R2 storage bucket.

## Prerequisites

1. Cloudflare Account with R2 bucket "apex-fusion-storage" created
2. Cloudflare Workers deployed backend
3. Postman installed (https://www.postman.com/downloads/)

## Step 1: Generate Cloudflare R2 API Credentials

### 1.1 Navigate to Cloudflare Dashboard
- Go to https://dash.cloudflare.com/
- Select your account
- Navigate to **R2** under **Storage & Databases**

### 1.2 Create R2 API Token
- Click on **API Tokens** in the left sidebar
- Click **Create Token**
- Select **Edit Cloudflare R2** template (or create custom with R2 permissions)
- Configure permissions:
  - **Account**: Your Cloudflare Account ID
  - **Zone Permissions**: Not needed
  - **R2 Permissions**: Full access or Edit access
- Set TTL (Time To Live) - recommended: 1 year
- Click **Continue to summary** then **Create Token**

### 1.3 Save Credentials
**IMPORTANT**: Save these credentials immediately - they won't be shown again!
- **Access Key ID**: Your R2 access key
- **Secret Access Key**: Your R2 secret key
- **Account ID**: Your Cloudflare Account ID (from dashboard URL)

---

## Step 2: Set Up Postman Environment

### 2.1 Create New Environment
1. Open Postman
2. Click on **Environments** in the left sidebar
3. Click **+** to create new environment
4. Name it: `Apex Fusion Production` (or `Apex Fusion Local` for development)

### 2.2 Add Environment Variables
Add the following variables to your environment:

| Variable Name | Initial Value | Description |
|--------------|---------------|-------------|
| `base_url` | `https://apex-fusion.admin-apexfusion.workers.dev` | Your deployed backend URL |
| `r2_endpoint` | `https://<account-id>.r2.cloudflarestorage.com` | R2 S3-compatible endpoint |
| `access_key_id` | `{your-access-key-id}` | Cloudflare R2 Access Key |
| `secret_access_key` | `{your-secret-access-key}` | Cloudflare R2 Secret Key |
| `bucket_name` | `apex-fusion-storage` | Your R2 bucket name |
| `jwt_token` | `{{empty}}` | Will be set after login |

### 2.3 Set Environment as Active
- Click on the environment name
- Click the eye icon to view variables
- Click the dropdown at top-right and select your environment

---

## Step 3: Create Postman Collection

### 3.1 Create New Collection
1. Click **Collections** in left sidebar
2. Click **+ New Collection**
3. Name it: `Apex Fusion API`
4. Add description: "API endpoints for Apex Fusion learning platform"

### 3.2 Configure Collection Settings
- In collection settings, add:
  - **Variable**: `base_url` with value `{{base_url}}`
  - **Authorization**: Inherit from parent (none at collection level)

---

## Step 4: API Endpoints Setup

### 4.1 Authentication Endpoints

#### POST - Login
- **Name**: `Login`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/auth/login`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
  ```json
  {
    "email": "admin@example.com",
    "password": "your-password"
  }
  ```
- **Tests** (to automatically save token):
  ```javascript
  if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.success && jsonData.data?.token) {
      pm.environment.set("jwt_token", jsonData.data.token);
      console.log("Token saved successfully");
    }
  }
  ```

#### POST - Register
- **Name**: `Register`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/auth/register`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
  ```json
  {
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe",
    "role": "student"
  }
  ```

---

### 4.2 Course Management Endpoints

#### POST - Create Course
- **Name**: `Create Course`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/videos/courses`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}
  ```
- **Body** (raw JSON):
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

#### GET - List Courses
- **Name**: `List Courses`
- **Method**: `GET`
- **URL**: `{{base_url}}/api/videos/courses`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  ```

#### POST - Assign Teacher to Course
- **Name**: `Assign Teacher to Course`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/videos/courses/{{courseId}}/assign-teacher`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}
  ```
- **Body** (raw JSON):
  ```json
  {
    "email": "teacher@example.com"
  }
  ```

---

### 4.3 Lesson Management Endpoints

#### POST - Create Lesson
- **Name**: `Create Lesson`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/videos/courses/{{courseId}}/lessons`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer {{jwt_token}}
  ```
- **Body** (raw JSON):
  ```json
  {
    "title": "Newton's Laws of Motion",
    "description": "Understanding the three laws of motion"
  }
  ```

#### GET - List Lessons
- **Name**: `List Lessons`
- **Method**: `GET`
- **URL**: `{{base_url}}/api/videos/courses/{{courseId}}/lessons`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  ```

---

### 4.4 Video Upload Endpoint (R2 Integration)

#### POST - Upload Video
- **Name**: `Upload Video to R2`
- **Method**: `POST`
- **URL**: `{{base_url}}/api/videos/upload`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  ```
- **Body Type**: `form-data`
- **Form Data Fields**:
  | Key | Type | Value | Description |
  |-----|------|-------|-------------|
  | `lessonId` | Text | `{{lessonId}}` | ID of the lesson to attach video to |
  | `file` | File | [Select video file] | Video file (MP4, WebM, MOV, max 100MB) |
  | `isDemo` | Text | `false` | Set to `true` for demo/free videos |

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "lessonId": 456,
    "r2Key": "courses/class-10/introduction-to-physics/lesson-456/abc123def456.mp4",
    "fileName": "lesson1.mp4",
    "fileSize": 52428800,
    "mimeType": "video/mp4"
  }
}
```

---

### 4.5 Video Management Endpoints

#### GET - List Videos
- **Name**: `List Videos`
- **Method**: `GET`
- **URL**: `{{base_url}}/api/videos`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  ```

#### GET - Stream Video
- **Name**: `Stream Video`
- **Method**: `GET`
- **URL**: `{{base_url}}/api/videos/{{videoId}}`
- **Authorization**: `Bearer {{jwt_token}}` (required for non-demo videos)
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  Range: bytes=0- (optional, for range requests)
  ```

#### DELETE - Delete Video
- **Name**: `Delete Video`
- **Method**: `DELETE`
- **URL**: `{{base_url}}/api/videos/{{videoId}}`
- **Authorization**: `Bearer {{jwt_token}}`
- **Headers**:
  ```
  Authorization: Bearer {{jwt_token}}
  ```

---

### 4.6 Direct R2 S3-Compatible API (Optional)

If you want to interact directly with R2 using S3-compatible API:

#### PUT - Upload Direct to R2
- **Name**: `Direct R2 Upload`
- **Method**: `PUT`
- **URL**: `{{r2_endpoint}}/{{bucket_name}}/{{objectKey}}`
- **Authorization**: AWS Signature V4 (requires Pre-request Script)
- **Headers**:
  ```
  Content-Type: video/mp4
  ```
- **Body**: Binary (video file)

**Note**: Direct R2 access requires AWS Signature V4 authentication, which is complex to set up in Postman. Recommended to use the backend API endpoints instead.

---

## Step 5: Testing Workflow

### Complete Workflow Example:

1. **Login**
   - Send POST request to `/api/auth/login`
   - Token is automatically saved to environment

2. **Create Course**
   - Send POST request to `/api/videos/courses`
   - Note the returned `courseId`

3. **Create Lesson**
   - Update URL with `{{courseId}}`
   - Send POST request to `/api/videos/courses/{{courseId}}/lessons`
   - Note the returned `lessonId`

4. **Upload Video**
   - Update `lessonId` in form-data
   - Select video file
   - Send POST request to `/api/videos/upload`
   - Note the returned `videoId` and `r2Key`

5. **List Videos**
   - Send GET request to `/api/videos`
   - Verify your video appears in the list

6. **Stream Video**
   - Update URL with `{{videoId}}`
   - Send GET request to `/api/videos/{{videoId}}`
   - Video should stream back

---

## Step 6: Postman Collection Export

To share the collection:

1. Click the **...** menu on your collection
2. Select **Export**
3. Choose **Collection v2.1** format
4. Save as `apex-fusion-api.postman_collection.json`

To export environment:

1. Click the **...** menu on your environment
2. Select **Export**
3. Save as `apex-fusion-env.postman_environment.json`

---

## Troubleshooting

### Common Issues:

1. **401 Unauthorized**
   - Check that `jwt_token` is set in environment
   - Verify token hasn't expired
   - Re-run Login request to refresh token

2. **403 Forbidden**
   - Verify user has correct role (admin/teacher)
   - Check teacher assignment to course

3. **413 Payload Too Large**
   - Video file exceeds 100MB limit
   - Compress video or split into smaller files

4. **415 Unsupported Media Type**
   - Ensure video is MP4, WebM, or MOV format
   - Check MIME type matches file extension

5. **R2 Upload Fails**
   - Verify R2 bucket exists in Cloudflare
   - Check R2 credentials are correct
   - Ensure bucket binding is configured in wrangler.toml

---

## Environment Variables Reference

### Production Environment:
```
base_url: https://apex-fusion.admin-apexfusion.workers.dev
r2_endpoint: https://<account-id>.r2.cloudflarestorage.com
bucket_name: apex-fusion-storage
```

### Local Development Environment:
```
base_url: http://localhost:8787
r2_endpoint: http://localhost:8787 (uses local R2 simulation)
bucket_name: apex-fusion-storage
```

---

## Security Notes

1. **Never commit** environment files with real credentials
2. Use different tokens for different environments
3. Rotate access keys regularly
4. Limit token permissions to minimum required
5. Use Postman Vault for sensitive data in team environments

---

## Additional Resources

- Cloudflare R2 Documentation: https://developers.cloudflare.com/r2/
- Cloudflare Workers Documentation: https://developers.cloudflare.com/workers/
- Postman Documentation: https://learning.postman.com/
