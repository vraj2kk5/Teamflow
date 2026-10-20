# TeamFlow: 5-Minute Internship Selection Demo Script

Use this script during your live technical interview and review with Rewamp Digital.

---

## ⏱️ Timeline Overview

| Time | Segment | Focus |
|---|---|---|
| **0:00 - 0:45** | **Introduction & Architecture** | Monorepo layout, tech stack, and design philosophy |
| **0:45 - 1:45** | **Core Collaboration Workflows** | Real-time Dashboard, Kanban Board, Projects & RBAC |
| **1:45 - 3:30** | **The Differentiator: Visual Bug Reporting** | Live screen & voice recording, logs, resilient upload & streaming |
| **3:30 - 4:15** | **Backend Architecture & Security** | Magic-byte sniffing, scoped 404s, HTTP 206 range streaming |
| **4:15 - 5:00** | **Testing, Verification & Q&A** | Test suites, clean DB seed, zero mockups |

---

## Script Walkthrough

### Part 1: Introduction & Architecture (0:00 - 0:45)
> "Good morning/afternoon! Today I'm excited to present **TeamFlow**, a modern project management and team collaboration platform built specifically with an integrated **Visual Bug Reporting** engine.
>
> For this assignment, I designed TeamFlow as a production-grade monorepo:
> - **Frontend:** Next.js 15 App Router with TypeScript and Tailwind CSS.
> - **Backend:** Express.js REST API with TypeScript, Prisma ORM, and PostgreSQL.
> - **Media Engine:** Browser MediaRecorder API combined with an abstracted storage driver supporting both local disk with HTTP 206 partial content streaming and Cloudflare R2 / S3.
>
> Most importantly: **every number, chart, card, and recording you see is backed by real PostgreSQL records and real file storage.** There are zero fake timers or mock arrays."

---

### Part 2: Core Collaboration Workflows (0:45 - 1:45)
> *(Action: Sign in as `admin@teamflow.dev` / `Password123!`)*
>
> "Let's log in with our pre-seeded Admin account. 
> - Here on the **Dashboard**, our statistics (Active Issues, Critical Bugs, Overdue Tasks) are computed live by Prisma aggregates on the server.
> - Below, the **Project Health breakdown** tracks completion velocity across our two active teams: *Core Platform* and *Mobile Application*.
>
> Now, let's navigate to **Projects** and open *Core Platform*.
> - Notice the **Kanban Board**: we have distinct stages (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`).
> - When I update an issue's status or assignee, TeamFlow automatically updates the resolved timestamp and records an immutable audit record in the **Activity Feed**."

---

### Part 3: Visual Bug Reporting (Differentiator) (1:45 - 3:30)
> *(Action: Click the red "Report a Bug" button in the navigation bar)*
>
> "Now let's explore TeamFlow's primary differentiator: **Visual Bug Reporting**.
> In conventional tools, developers often get vague bug reports like *'the button is broken'*. In TeamFlow, we capture full visual and diagnostic context in one seamless workflow:
>
> 1. **Live Screen Recording:** I click 'Record Screen', select my current window, and reproduce the bug live. Notice the real-time recording timer.
> 2. **Voice Memo Explanation:** I can record an audio voice note explaining expected vs actual behavior with microphone permissions.
> 3. **Screenshots & Clipboard Paste:** I can drag & drop PNG/JPEG images or press `Ctrl+V` to paste an image straight from my clipboard.
> 4. **Error Log Viewer:** I can paste a full Node.js or browser stack trace into the diagnostic box.
>
> Now, observe the submission flow:
> - This uses a **Two-Step Resilient Architecture**:
>   - First, the issue record is created on the backend.
>   - Second, media files upload sequentially with real `XMLHttpRequest` progress percentages.
>   - If a network blip occurs, the user can click 'Retry' on that specific file without creating duplicate issues!
>
> *(Action: Open the created bug issue)*
> - Look at the issue detail: the error log is rendered in an escaped monospaced viewer with a quick 'Copy Log' button.
> - Down in Media Attachments, the video player streams immediately using **HTTP 206 Partial Content Range requests**, allowing teammates to scrub forward without buffering the entire recording."

---

### Part 4: Backend Security & Engineering Highlights (3:30 - 4:15)
> "Behind the scenes, we built this with strict security and reliability principles:
> 1. **Magic-Byte Sniffing:** We never trust the client's file extension or declared MIME type. We read the raw file buffer using `file-type` to detect WebM, MP4, and JPEG signatures, and outright block executable disguises and SVGs.
> 2. **Role-Based Access Control & Scoped 404s:** Permissions are enforced centrally. If a user attempts to access a resource belonging to another organization, our API returns a **404 Not Found** instead of a 403, preventing resource enumeration leaks.
> 3. **Signed Streaming Tokens:** Files are never exposed publicly. Streaming URLs are protected by HMAC-signed tokens with 15-minute expirations."

---

### Part 5: Testing, Verification & Summary (4:15 - 5:00)
> "To verify all 11 mandatory requirements:
> - We maintain a complete verification matrix in `docs/REQUIREMENTS_CHECKLIST.md`.
> - Our automated test suite includes **35 integration tests** across authentication, RBAC policies, Kanban transitions, comments, and media validation.
> - Our Next.js production build compiles all 16 routes with zero type errors.
>
> Thank you, and I'd love to answer any questions or dive into specific parts of the codebase!"
