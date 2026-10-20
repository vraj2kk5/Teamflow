# TeamFlow Manual Testing & Verification Guide

This guide walks through testing all 11 core requirements and the differentiating **Visual Bug Reporting** workflow on a running instance of TeamFlow.

---

## Prerequisites

1. PostgreSQL database running locally (or hosted dev instance).
2. Database seeded with `npm --prefix server run prisma:seed`.
3. Backend running:
   ```bash
   cd server
   npm run dev
   ```
   Server starts on `http://localhost:5000`.
4. Frontend running:
   ```bash
   cd client
   npm run dev
   ```
   Client starts on `http://localhost:3000`.

---

## Pre-seeded Credentials

| Role | Email | Password | Intended Test Focus |
|---|---|---|---|
| **ADMIN** | `admin@teamflow.dev` | `Password123!` | Org settings, member roles, full deletion, all projects |
| **PROJECT_MANAGER** | `pm@teamflow.dev` | `Password123!` | Project management, issue assignments, Kanban board |
| **MEMBER** | `member@teamflow.dev` | `Password123!` | Task updates, reporting visual bugs, commenting |

---

## Test Scenario 1: Authentication & Role-Based Navigation

1. **Visit Home:** Navigate to `http://localhost:3000`.
   - **Expectation:** Unauthenticated users are redirected to `/login?next=%2Fdashboard`.
2. **Login as Admin:**
   - Enter `admin@teamflow.dev` / `Password123!`.
   - Click "Sign In".
   - **Expectation:** Toast confirms "Signed in successfully". Redirects to `/dashboard`.
   - Sidebar displays organization name "Acme Engineering" and badge "Admin".
3. **Verify Dashboard (Requirement 1):**
   - KPI cards display real numbers from the database (Total Projects: 2, Active Issues: 10+, Overdue Tasks, Critical Bugs).
   - "Project Health" section lists "Core Platform" and "Mobile Application" with completion progress bars.
   - "Recent Activity" shows project creation and issue updates with timestamps.
4. **Logout & Session Verification:**
   - Click user avatar in top-right -> Click "Sign Out".
   - **Expectation:** Redirects to `/login`. Trying to access `/dashboard` redirects back to login.

---

## Test Scenario 2: Project Management & RBAC Enforcement

1. **Login as PM:** Sign in with `pm@teamflow.dev` / `Password123!`.
2. **List Projects (Requirement 2):**
   - Click "Projects" in sidebar.
   - Shows "Core Platform" and "Mobile Application" cards with health badges and completion metrics.
3. **Create Project (Requirement 3):**
   - Click "+ New Project".
   - Enter name: "Analytics Dashboard", description: "Real-time telemetry and reporting UI".
   - Click "Create Project".
   - **Expectation:** Modal closes, toast confirms creation, new project appears in the list.
4. **Kanban Board & Workflow Moves (Requirement 2 & 5):**
   - Click on "Core Platform".
   - View Kanban columns: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.
   - Click on issue `TF-1` ("Memory leak during WebSocket heartbeat").
   - Change Status dropdown from `TODO` to `IN_PROGRESS`.
   - **Expectation:** Status badge updates immediately. An activity log entry is recorded.
5. **Delete Confirmation (Requirement 4):**
   - In "Analytics Dashboard" Settings tab, click "Delete Project".
   - A confirmation dialog modal appears ("Are you sure? This cannot be undone").
   - Click "Delete".
   - **Expectation:** Project is deleted and user is returned to `/projects`.

---

## Test Scenario 3: Visual Bug Reporting (Differentiating Feature)

1. **Open Visual Bug Reporter:**
   - Click "Report a Bug" in the top bar (or click "Bug Reports" in the sidebar -> "+ Report a Bug").
   - URL opens `/bug-reports/new`.
2. **Fill Core Information:**
   - Target Project: Select "Core Platform".
   - Severity / Priority: Select "🔴 Critical".
   - Bug Title: "Audio stream stalls when switching browser tabs".
   - Description: "Background playback stops emitting audio buffers after 30 seconds."
3. **Diagnostic Information:**
   - Steps to Reproduce: "1. Play audio memo. 2. Switch to another tab. 3. Return after 30 seconds."
   - Expected Result: "Playback continues smoothly without interruption."
   - Actual Result: "Audio halts and media element displays error state."
   - Error Message / Stack Trace: Paste:
     ```
     DOMException: The play() request was interrupted by a new load request.
         at HTMLMediaElement.play (native)
         at AudioStreamController.resume (stream.js:42)
     ```
4. **Media Capture (Screen & Voice):**
   - **Voice Memo:**
     - Click "Record Voice Memo". Browser prompts for microphone permission.
     - Speak for 3-5 seconds. Observe the live timer and pulse indicator (`aria-live="polite"`).
     - Click "Stop Recording".
     - Listen to the audio preview with the built-in HTML5 player.
     - Click "Attach Voice Memo to Report". Observe voice note added to attached queue.
   - **Screen Recording:**
     - Click "Record Screen". Select current window or tab.
     - Record for 5 seconds. Click "Stop Recording".
     - Review the video preview player.
     - Click "Attach Screen Recording to Report".
   - **Screenshots:**
     - Drag and drop a PNG image or press `Ctrl+V` to paste an image from clipboard.
     - Thumbnail preview renders with file size.
5. **Two-Step Resilient Submission:**
   - Click "Submit Bug Report (3 files)".
   - **Step 1:** Issue is created with key `TF-9`.
   - **Step 2:** All 3 files upload sequentially with real progress percentages (0% -> 100%).
   - **Success State:** Green celebration screen displays "Bug Report Submitted Successfully! Issue TF-9 has been logged".
   - Click "View Bug Detail (TF-9)".
6. **Streaming Playback Verification:**
   - On `/issues/[id]`, review the Diagnostic Information box:
     - Error Log box renders monospaced text with a working "Copy Log" button.
   - In Media Attachments:
     - Click the Video thumbnail -> Streams smoothly via HTTP 206 Range requests.
     - Click the Audio player -> Plays voice note.
     - Click the Image -> Opens zoomable lightbox modal.

---

## Test Scenario 4: Search, Filtering & Discussion

1. **Backend Search & Filter (Requirement 6):**
   - Navigate to `/issues`.
   - Type "Memory" in the search box.
   - **Expectation:** Results filter to `TF-1`.
   - Select Priority: "Critical" -> Filters to critical issues.
   - Select Type: "Bug" -> Filters to bugs only.
   - URL updates with search parameters (`/issues?search=Memory&priority=CRITICAL&type=BUG`), supporting refresh and bookmarking.
2. **Comments & Discussion (Requirement 5):**
   - Open `TF-1`.
   - Scroll to Comments section.
   - Type: "Added unit test for reconnect throttling in PR #42."
   - Click "Post Comment".
   - **Expectation:** Comment appears immediately with author name, avatar, and relative timestamp.
3. **User Profile (Requirement 7):**
   - Click "Profile" in sidebar.
   - View assigned tasks and reported issues.
   - Edit Job Title to "Lead Systems Architect" and click "Save Changes".
   - **Expectation:** Profile updates and persists on refresh.

---

## Test Scenario 5: Error Handling & Edge Cases (Requirement 10)

1. **Negative Validation:**
   - Attempt to submit a bug report with an empty title -> Form validation error shown.
2. **Security & Permissions:**
   - Sign in as `member@teamflow.dev`.
   - Attempt to delete a project owned by `admin@teamflow.dev` -> Delete button is hidden or returns 403 Forbidden.
   - Attempt to access a random non-existent ID `/projects/nonexistent123` -> Displays 404 page with "Back to Dashboard" button.
3. **Invalid File Upload Security:**
   - Attempt to upload an executable renamed to `.png` or an SVG file -> Backend rejects with `415 Unsupported Media Type` (magic-byte check).
4. **Responsive UI (Requirement 11):**
   - Open browser DevTools (F12) and toggle mobile view (375px iPhone SE).
   - Sidebar collapses into hamburger drawer; Kanban cards stack cleanly; tables and media controls remain scrollable and usable.
