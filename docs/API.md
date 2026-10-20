# TeamFlow REST API Reference

All requests and responses use the standard TeamFlow envelope.

### Base URL
- Local Development: `http://localhost:5000/api`
- Production: `https://<backend-host>/api`

### Standard Response Envelope

#### Success Response (200 OK / 201 Created)
```json
{
  "data": { ... }
}
```

#### Error Response (4xx / 5xx)
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Project not found or not in your organization",
    "details": [
      {
        "field": "title",
        "message": "Title must be at least 3 characters"
      }
    ]
  }
}
```

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register`
Register a new user and initialize their primary organization.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Sarah Connor",
    "email": "sarah@example.com",
    "password": "Password123!",
    "organizationName": "Acme Corp" // optional, defaults to "<Name>'s Team"
  }
  ```
- **Response (201):** User object and Organization object. Sets `httpOnly` JWT session cookie.

### `POST /api/auth/login`
Authenticate existing user and issue session cookie.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "admin@teamflow.dev",
    "password": "Password123!"
  }
  ```
- **Response (200):** User profile and active organization. Sets `httpOnly` session cookie.

### `POST /api/auth/logout`
Clear authentication cookie.
- **Access:** Authenticated
- **Response (200):** `{ "data": { "message": "Logged out successfully" } }`

### `GET /api/auth/me`
Return currently authenticated user and active organization membership.
- **Access:** Authenticated
- **Response (200):** User, organization, and organization role (`ADMIN`, `PROJECT_MANAGER`, or `MEMBER`).

---

## 2. Organizations (`/api/orgs`)

### `GET /api/orgs/current`
Get details of the current organization.
- **Access:** Authenticated

### `GET /api/orgs/members`
List all members of the current organization with their roles.
- **Access:** Authenticated

### `POST /api/orgs/members`
Add an already registered user to the organization by email.
- **Access:** `ADMIN` or `PROJECT_MANAGER`
- **Request Body:**
  ```json
  {
    "email": "newdev@teamflow.dev",
    "role": "MEMBER" // "ADMIN" | "PROJECT_MANAGER" | "MEMBER"
  }
  ```

### `PATCH /api/orgs/members/:userId/role`
Update an organization member's role.
- **Access:** `ADMIN` (cannot demote the last remaining ADMIN)
- **Request Body:**
  ```json
  {
    "role": "PROJECT_MANAGER"
  }
  ```

### `DELETE /api/orgs/members/:userId`
Remove a member from the organization.
- **Access:** `ADMIN` (cannot remove the last remaining ADMIN)

---

## 3. Projects (`/api/projects`)

### `GET /api/projects`
List all active projects within the user's organization that the user is a member of (or all projects if `ADMIN`).
- **Access:** Authenticated

### `POST /api/projects`
Create a new project.
- **Access:** `ADMIN` or `PROJECT_MANAGER`
- **Request Body:**
  ```json
  {
    "name": "Core Platform",
    "description": "Infrastructure and API platform"
  }
  ```

### `GET /api/projects/:id`
Get single project details, including member list, issue sequence counter, and statistics.
- **Access:** Project member or `ADMIN` (Returns 404 if outside organization)

### `PATCH /api/projects/:id`
Update project name, description, or status (`ACTIVE`, `ARCHIVED`, `COMPLETED`).
- **Access:** Project Owner, `ADMIN`, or `PROJECT_MANAGER`

### `DELETE /api/projects/:id`
Delete project and all associated issues, comments, and attachments.
- **Access:** Project Owner or `ADMIN`

### `POST /api/projects/:id/members`
Add a user to project.
- **Access:** Project Owner, `ADMIN`, or `PROJECT_MANAGER`
- **Request Body:**
  ```json
  {
    "userId": "clx..."
  }
  ```

### `DELETE /api/projects/:id/members/:userId`
Remove a user from project.
- **Access:** Project Owner, `ADMIN`, or `PROJECT_MANAGER`

---

## 4. Issues (`/api/issues`)

### `GET /api/issues`
Filter and search issues across user's permitted projects.
- **Access:** Authenticated
- **Query Parameters:**
  - `search`: Case-insensitive search on `title` and `description`
  - `status`: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`
  - `priority`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - `type`: `TASK`, `BUG`
  - `projectId`: Scoped to specific project
  - `assigneeId`: Filter by assignee
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20)

### `POST /api/issues`
Create a task or visual bug report. Auto-assigns sequential key (`TF-1`, `TF-2`, etc.).
- **Access:** Project member
- **Request Body:**
  ```json
  {
    "projectId": "clx...",
    "title": "Audio playback failure on iOS Safari",
    "description": "Audio buffer fails to initialize without user touch event",
    "type": "BUG", // "TASK" | "BUG"
    "priority": "HIGH", // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    "assigneeId": "clx...", // optional
    "dueDate": "2026-11-01T00:00:00Z", // optional
    "estimatedHours": 4, // optional
    "stepsToReproduce": "1. Open app\n2. Click play", // optional
    "expectedResult": "Audio plays immediately", // optional
    "actualResult": "Promise rejected with NotAllowedError", // optional
    "errorLog": "NotAllowedError: The play method is not allowed..." // optional
  }
  ```

### `GET /api/issues/:id`
Fetch single issue with reporter, assignee, project, attachments, comments, and activity log.
- **Access:** Project member or `ADMIN`

### `PATCH /api/issues/:id`
Update issue title, description, priority, assignee, due date, or diagnostic fields.
- **Access:** Issue Reporter, Assignee, `PROJECT_MANAGER`, or `ADMIN`

### `PATCH /api/issues/:id/status`
Move issue across Kanban workflow stages (`TODO` -> `IN_PROGRESS` -> `IN_REVIEW` -> `DONE`). Automatically sets `resolvedAt` timestamp and writes an audit log.
- **Access:** Issue Reporter, Assignee, `PROJECT_MANAGER`, or `ADMIN`
- **Request Body:**
  ```json
  {
    "status": "DONE"
  }
  ```

### `DELETE /api/issues/:id`
Delete an issue.
- **Access:** Issue Reporter, `PROJECT_MANAGER`, or `ADMIN`

---

## 5. Media Attachments & Streaming (`/api/attachments`)

### `POST /api/issues/:id/attachments`
Upload media file (audio memo, screen recording, or screenshot).
- **Access:** Project member
- **Headers:** `Content-Type: multipart/form-data`
- **Form Data:**
  - `file`: Binary file (Audio: max 25MB WebM/MP4/OGG; Video: max 100MB WebM/MP4; Image: max 5MB PNG/JPEG/WebP)
  - `kind`: `"AUDIO"` | `"VIDEO"` | `"IMAGE"`
  - `durationSeconds`: Optional integer (for audio/video duration)
- **Validation:** Enforces magic-byte sniffing via `file-type`. Spoofed files and SVG files are rejected with `415 Unsupported Media Type`.
- **Response (201):** Attachment metadata record.

### `GET /api/attachments/:id/access`
Generate temporary signed streaming token (HMAC-SHA256, 15-minute expiration).
- **Access:** Project member or `ADMIN`
- **Response (200):**
  ```json
  {
    "accessUrl": "http://localhost:5000/api/attachments/stream?token=eyJhbG...",
    "expiresIn": 900
  }
  ```

### `GET /api/attachments/stream`
Stream media file. Supports HTTP 206 Partial Content (Range requests) for seeking and scrubbing video and audio players.
- **Access:** Valid temporary token in query param (`?token=...`)
- **Headers Handled:** `Range: bytes=0-1048575` -> Returns `206 Partial Content` with `Content-Range: bytes 0-1048575/15234512`.

### `DELETE /api/attachments/:id`
Delete media attachment and remove physical file from storage.
- **Access:** Uploader, `PROJECT_MANAGER`, or `ADMIN`

---

## 6. Comments (`/api/issues/:id/comments` & `/api/comments`)

### `GET /api/issues/:id/comments`
List all comments on an issue in chronological order.
- **Access:** Project member

### `POST /api/issues/:id/comments`
Post a comment on an issue.
- **Access:** Project member
- **Request Body:**
  ```json
  {
    "body": "I reproduced this in Firefox 124. The media element needs an explicit autoplay policy."
  }
  ```

### `DELETE /api/comments/:id`
Delete a comment.
- **Access:** Comment author or `ADMIN`

---

## 7. Dashboard & Activity (`/api/dashboard` & `/api/activity`)

### `GET /api/dashboard`
Get real aggregated project metrics:
- Total projects, active issues count, overdue tasks count, critical bugs count
- Project health breakdown (open vs completed issues, health status: `HEALTHY`, `AT_RISK`, `CRITICAL`)
- Recent activity feed

### `GET /api/activity`
Get paginated audit feed of organization activity (issue creation, status moves, role adjustments, project milestones).

---

## 8. HTTP Status Codes

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded. |
| `201 Created` | Resource created successfully. |
| `204 No Content` | Mutation succeeded with no response body. |
| `206 Partial Content` | Streaming byte range successfully returned. |
| `400 Bad Request` | Missing required fields or failed Zod validation. |
| `401 Unauthorized` | Missing, expired, or invalid JWT cookie. |
| `403 Forbidden` | In-scope resource but insufficient permission. |
| `404 Not Found` | Resource does not exist OR is outside user's organization (scoped for security). |
| `413 Payload Too Large` | File exceeds maximum allowable bytes (Audio: 25MB, Video: 100MB, Image: 5MB). |
| `415 Unsupported Media Type` | File failed magic-byte sniffing (e.g. executable renamed to `.png` or SVG upload). |
| `429 Too Many Requests` | Exceeded rate-limit window. |
| `500 Internal Server Error` | Unexpected server exception. |
