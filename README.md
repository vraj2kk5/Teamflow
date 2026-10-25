# TeamFlow 🚀

> Modern Team Collaboration, Project Management & **Visual Bug Reporting** Platform  
> Built for the Full Stack Developer Internship Selection Assignment at **Rewamp Digital**.

![TeamFlow Overview](https://img.shields.io/badge/Next.js-15_App_Router-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Express](https://img.shields.io/badge/Express-4.21-green?logo=express)
![Prisma](https://img.shields.io/badge/Prisma-6.4-indigo?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)
![Tests](https://img.shields.io/badge/Tests-35_Passing-success)

---

## 📖 Table of Contents
1. [Overview & Key Features](#-overview--key-features)
2. [The Differentiating Feature: Visual Bug Reporting](#-the-differentiating-feature-visual-bug-reporting)
3. [Architecture & Monorepo Layout](#-architecture--monorepo-layout)
4. [Technology Stack](#-technology-stack)
5. [Prerequisites](#-prerequisites)
6. [Quick Start & Local Setup](#-quick-start--local-setup)
7. [Environment Configuration Reference](#-environment-configuration-reference)
8. [Demo Accounts & Seed Data](#-demo-accounts--seed-data)
9. [Email Services & Real Inbox Notifications](#-email-services--real-inbox-notifications)
10. [Automated Testing & Type Checking](#-automated-testing--type-checking)
11. [Storage Drivers: Local Disk vs Cloudflare R2](#-storage-drivers-local-disk-vs-cloudflare-r2)
12. [Troubleshooting & Windows Tips](#-troubleshooting--windows-tips)
13. [Production Deployment Guide](#-production-deployment-guide)
14. [Requirements Checklist](#-requirements-checklist)

---

## 🌟 Overview & Key Features

> ✉️ **Live Email Services Active:** TeamFlow has automated transactional email delivery enabled. When registering, testing invitations, or assigning tasks, **use your real, original email address** (e.g., your Gmail or Outlook) to receive real-time notifications directly in your inbox.

TeamFlow provides a streamlined, original alternative to bloated legacy project management tools like Jira. Designed for fast-moving engineering teams, it combines agile task tracking with a first-class visual diagnostic reporting workflow.

- **Role-Scoped Dashboard:** Real-time statistics computed directly from PostgreSQL database aggregates without mockups. Member dashboards strictly show personal assigned workloads, while Admins view organization-wide metrics.
- **Dedicated Tasks & Issues Hubs:** Clean separation between agile work items (`/tasks`) and bug reports (`/issues`) with dedicated filter bars and quick-filter pills (*Assigned to Me*, *Reported by Me*, *Overdue Only*, *Resolved*).
- **Collaborative Bug Solving:** Bug defects are shared collaboratively among all project members to investigate and fix, while tasks are assigned to specific team members.
- **Interactive Kanban Boards:** Four-stage workflow (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`) with automated resolution timestamping, resolution documentation dialogs, and immutable activity auditing.
- **Strict Media Security:** Media attachments on bug reports are restricted so only the original reporter can attach or remove files, ensuring defect report authenticity.
- **Real-Time In-App Notifications:** Notification bell with sound chime, unread badges, and alerts for task assignments, self-assignments, and discussion comments.
- **Role-Based Access Control (RBAC):** Organization-scoped permissions (`ADMIN`, `PROJECT_MANAGER`, `MEMBER`) enforced strictly on the backend with cross-tenant 404 security.
- **Full Discussion & Collaboration:** Rich comment threads, user task assignments, multi-parameter server-side search and filtering.
- **Responsive Design:** Native mobile slide-over drawer, responsive grid layouts, and touch-friendly controls tested across desktop, tablet, and mobile.

---

## 🎯 The Differentiating Feature: Visual Bug Reporting

When developers encounter a software defect, traditional bug tracking leads to vague text descriptions. TeamFlow solves this with an integrated **Visual Bug Reporting** suite:

1. **Screen Recording:** Capture browser tab or screen reproductions directly via `getDisplayMedia()`, with optional microphone commentary (up to 5 minutes).
2. **Voice Memo Recording:** Record audio explanations with waveform pulse indicators and live timer (`aria-live="polite"`) via `getUserMedia({ audio: true })`. Audio preloads metadata only and never auto-plays unexpectedly.
3. **Screenshots & Clipboard Paste:** Drag-and-drop image uploads with instantaneous thumbnail previews and global clipboard paste (`Ctrl+V`). Enforces 5MB limits and blocks SVG execution vectors.
4. **Escaped Error Log Viewer:** Paste stack traces or terminal outputs into a dedicated monospaced box with one-click copy and strict text escaping to prevent XSS.
5. **Two-Step Resilient Upload:** Creates the backend issue record first, then uploads media attachments sequentially with real `XMLHttpRequest.upload.onprogress` percentages. Failed files can be retried individually without duplicating tickets.
6. **HTTP 206 Range Streaming Player:** Video and audio files stream via temporary signed HMAC tokens, allowing smooth scrubbing and seeking without buffering entire files.

---

## 🏗️ Architecture & Monorepo Layout

TeamFlow is structured as a clean, single-repository monorepo without unnecessary microservices or container overhead:

```
teamflow/
├── client/                     # Next.js 15 (App Router) + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── app/                # Pages (dashboard, projects, tasks, issues, my-tasks, profile)
│   │   ├── components/         # Reusable UI component library & media capture cards
│   │   ├── contexts/           # AuthContext, ToastContext
│   │   ├── hooks/              # useAudioRecorder, useScreenRecorder
│   │   └── lib/                # Typed API client, utilities, formatting
│   └── package.json
│
├── server/                     # Node.js + Express.js + TypeScript + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma       # Normalized PostgreSQL database schema
│   │   ├── migrations/         # Committed SQL migrations
│   │   └── seed.ts             # Demo data seeder (guards against production)
│   ├── src/
│   │   ├── config/             # Zod environment variable validation
│   │   ├── middleware/         # Auth, RBAC policies, error handling, rate limits
│   │   ├── modules/            # Auth, Orgs, Projects, Issues, Comments, Attachments, Notifications
│   │   ├── lib/                # Storage drivers (LocalDisk with HTTP 206 & S3), logger, token HMAC
│   │   ├── app.ts              # Express application configuration & middleware
│   │   └── server.ts           # Server entry point
│   ├── tests/                  # Supertest + Vitest integration test suites
│   └── package.json
│
├── docs/                       # Project documentation & verification artifacts
│   ├── REQUIREMENTS_CHECKLIST.md # All 11 assignment requirements verified
│   ├── API.md                  # Complete REST API reference
│   ├── MANUAL_TESTING.md       # Step-by-step test script
│   └── DEMO_SCRIPT.md          # 5-minute presentation script
│
├── .env.example
├── README.md
└── package.json
```

---

## 💻 Technology Stack

| Layer | Technologies | Justification |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide Icons | Server & client components, route prefetching, dark mode |
| **Backend** | Node.js, Express.js, TypeScript, Helmet, CORS, Multer | Lightweight, robust REST architecture with central error handling |
| **Database** | PostgreSQL 16 with Prisma ORM | Relational integrity, cascade deletions, typed queries, migrations |
| **Auth** | JWT stored in `httpOnly`, `SameSite=Lax` (dev) / `SameSite=None; Secure` (prod) cookie | XSS-resilient authentication, bcrypt hashing (cost 10) |
| **Storage Driver** | Pluggable interface: `LocalDiskDriver` (dev) & `S3Driver` (prod) | Zero-credential local dev with HTTP 206 streaming; Cloudflare R2 ready |
| **Notifications** | In-app notification polling + Web Audio chime + Transactional SMTP | Real-time user feedback for assignments, mentions, and updates |
| **Testing** | Vitest, Supertest | Fast, reliable integration testing against real database |

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js:** v18.18.0+ or v20.x+ (`node -v`)
- **npm:** v9.x+ or v10.x+ (`npm -v`)
- **PostgreSQL:** v14+ running locally on port `5432` or `5433` (or a free cloud database instance from [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com))
- **Git:** for version control

---

## ⚡ Quick Start & Local Setup

Follow these step-by-step instructions to get TeamFlow up and running locally.

### 1. Clone the Repository
```bash
git clone https://github.com/vraj2kk5/Teamflow.git
cd Teamflow
```

### 2. Configure Environment Files

#### A. Server Environment (`server/.env`)
Copy the example environment file:
```bash
cp server/.env.example server/.env
```
*(On Windows Command Prompt: `copy server\.env.example server\.env`)*

Open `server/.env` and verify your database connection URL:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teamflow?schema=public
JWT_SECRET=development_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:3000
COOKIE_SAMESITE=lax
COOKIE_SECURE=false

# Media Storage Driver
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=uploads
FILE_TOKEN_SECRET=development_file_token_secret_for_media_streaming_32_chars

# Media Size Limits in MB
MAX_AUDIO_MB=25
MAX_VIDEO_MB=100
MAX_IMAGE_MB=5
```

> [!TIP]
> If your local PostgreSQL is running on a port other than `5432` (e.g. `5433`), simply adjust the port number in `DATABASE_URL` (e.g., `postgresql://postgres:postgres@localhost:5433/teamflow?schema=public`).

#### B. Client Environment (`client/.env`)
Copy the client example environment file:
```bash
cp client/.env.example client/.env
```
*(On Windows Command Prompt: `copy client\.env.example client\.env`)*

Verify `client/.env` contains:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

### 3. Install Dependencies
You can install dependencies across the monorepo in one step from the root directory:

```bash
# Install root, server, and client dependencies
npm install
npm --prefix server install
npm --prefix client install
```

---

### 4. Database Setup & Seeding

```bash
# Generate Prisma Client
npm run prisma:generate

# Run Database Migrations
npm run prisma:migrate

# Seed Demo Data (creates Admin, PM, Member accounts & sample projects)
npm run prisma:seed
```

> **Optional:** You can open Prisma Studio at any time to inspect database rows in your browser:
> ```bash
> npm run studio
> ```
> *(Opens database GUI at `http://localhost:5555`)*

---

### 5. Start Development Servers

You can launch both the backend and frontend simultaneously with a single root command:

```bash
npm run dev
```

Alternatively, you can run them in separate terminals:

```bash
# Terminal 1: Backend API (runs on http://localhost:5000)
cd server
npm run dev

# Terminal 2: Frontend Client (runs on http://localhost:3000)
cd client
npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

---

## 🔧 Environment Configuration Reference

### Server Variables (`server/.env`)
| Variable | Default / Example | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Express backend API |
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `JWT_SECRET` | String (32+ chars) | Secret used to sign user authentication JWTs |
| `JWT_EXPIRES_IN` | `7d` | Lifetime of authentication tokens |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for client requests |
| `COOKIE_SAMESITE` | `lax` | Cookie `SameSite` policy (`lax` in dev, `none` in prod) |
| `COOKIE_SECURE` | `false` | Cookie HTTPS flag (`false` in dev, `true` in prod) |
| `STORAGE_DRIVER` | `local` | Attachment storage driver (`local` or `s3`) |
| `LOCAL_UPLOAD_DIR`| `uploads` | Folder path for local attachments |
| `FILE_TOKEN_SECRET`| String (32+ chars) | Secret used for HMAC-signed streaming URLs |
| `MAX_IMAGE_MB` | `5` | Maximum image upload size in megabytes |
| `MAX_AUDIO_MB` | `25` | Maximum audio memo upload size in megabytes |
| `MAX_VIDEO_MB` | `100` | Maximum screen recording upload size in megabytes |
| `SMTP_HOST` | `smtp.gmail.com` | (Optional) Host for transactional email delivery |
| `RESEND_API_KEY` | `re_...` | (Optional) Resend API key for direct email delivery |

### Client Variables (`client/.env`)
| Variable | Default / Example | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Base URL of the backend REST API |

---

## 👥 Demo Accounts & Seed Data

The database is pre-seeded with 3 realistic accounts representing all 3 role levels:

| Role | Email | Password | Permissions & Capabilities |
|---|---|---|---|
| **ADMIN** | `admin@teamflow.dev` | `Password123!` | Full workspace access, project deletion, invite management, unassigned task oversight |
| **PROJECT_MANAGER** | `pm@teamflow.dev` | `Password123!` | Create projects, assign tasks to members, manage Kanban boards, report bugs |
| **MEMBER** | `member@teamflow.dev` | `Password123!` | Work on assigned tasks, submit visual bug reports, update task status, add comments |

*Note: The seed script strictly refuses to execute in `NODE_ENV=production` for data safety.*

---

## 📧 Email Services & Real Inbox Notifications

> 💡 **Tip:** When testing TeamFlow registration or invitations, **use your actual email address**!

TeamFlow integrates live transactional email delivery (powered by **Brevo SMTP** and **Resend API**). Real emails are delivered to recipients' inboxes for:

1. **Workspace Welcome Email:** When an Admin registers an account and creates a workspace, they receive a welcome email with workspace details and invite code.
2. **Login Security Alerts:** Users receive a notification whenever they log in, with security timestamps and dashboard deep-links.
3. **Workspace Member Invitations:** Inviting a new user via their email address dispatches a personalized email with the workspace invite code and pre-configured role (`PROJECT_MANAGER` or `MEMBER`).
4. **Task Assignment Notifications:** Whenever a task is assigned to a team member, that member receives an instant email containing the ticket key (e.g., `TF-1`), task title, reporter name, and a one-click button to view the task directly.

*If SMTP/Resend variables are not configured in development, emails are safely logged to your backend console with zero errors.*

---

## 🧪 Automated Testing & Type Checking

TeamFlow includes 35 comprehensive automated integration tests covering authentication, RBAC policy enforcement, Kanban state transitions, comment permissions, magic-byte sniffing, and media uploads.

### Run All Backend Integration Tests
```bash
# Run test suite via Vitest
npm run test:server
# or
npm --prefix server test
```

### Test Suite Coverage:
- **`tests/auth.test.ts` (10 tests):** Registration, password hashing, JWT cookies, duplicate emails, auth middleware.
- **`tests/phase2.test.ts` (12 tests):** Cross-organization 404 security, project CRUD, sequential issue keys (`TF-1`), Kanban status moves.
- **`tests/phase3.test.ts` (6 tests):** Comment author permissions, real dashboard aggregate metrics, user task query filters.
- **`tests/phase4.test.ts` (7 tests):** Magic-byte sniffing (`file-type`), 5MB image limit, 415 executable rejection, HMAC streaming tokens, HTTP 206 range requests.

### Client TypeScript Type Check:
```bash
cd client
npx tsc --noEmit
```

### Client Production Build:
```bash
npm run build:client
```

---

## 💾 Storage Drivers: Local Disk vs Cloudflare R2

TeamFlow uses a clean driver abstraction (`server/src/lib/storage/storage.driver.ts`):

```typescript
export interface StorageDriver {
  upload(file: Express.Multer.File, key: string): Promise<UploadResult>;
  getStream(key: string, range?: { start: number; end?: number }): Promise<StreamResult>;
  getSignedUrl(key: string, expiresInSeconds?: number, attachmentId?: string): Promise<string>;
  delete(key: string): Promise<void>;
}
```

### Local Development Driver (`LOCAL_DISK`)
- Files are saved directly to `./uploads`.
- **HTTP 206 Partial Content Streaming:** Implements real byte-range requests (`Range: bytes=start-end`) so media players can scrub and seek video without downloading the whole file.
- Generates HMAC-SHA256 signed access URLs valid for 15 minutes.
- Displays an explicit development warning in server logs to prevent accidental production usage.

### Cloud Object Storage Driver (`S3`)
- Built using `@aws-sdk/client-s3`.
- Fully compatible with **Cloudflare R2**, **Supabase Storage**, or **AWS S3**.
- Set `STORAGE_DRIVER="s3"`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_ENDPOINT`.

---

## 💡 Troubleshooting & Windows Tips

- **Windows / OneDrive Path Clashing:**
  - Next.js Turbopack can encounter path resolution errors on Windows OneDrive directories. The `npm --prefix client run dev` command is configured with standard Next.js dev server (`next dev -p 3000`) for complete stability.
- **Port Conflicts:**
  - If port `5000` is occupied by another application, you can change `PORT=5001` in `server/.env` and update `NEXT_PUBLIC_API_URL=http://localhost:5001/api` in `client/.env`.
- **Database Connection Issues:**
  - Ensure your PostgreSQL service is running (`pg_ctl` or Windows Services).
  - Test connecting using `psql -U postgres -d teamflow`.

---

## 🚀 Production Deployment Guide

### 1. Database (Neon or Supabase)
1. Create a free PostgreSQL instance on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the connection string into your environment variables as `DATABASE_URL`.
3. Run `npm run prisma:migrate` to apply migrations.

### 2. Backend (Render or Railway)
1. Deploy the `server/` directory as a Node.js web service.
2. Build command: `npm install && npm run build`
3. Start command: `node dist/server.js`
4. Environment variables to configure:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-postgres-url>`
   - `JWT_SECRET=<strong-random-key>`
   - `CLIENT_ORIGIN=https://<your-frontend-domain>`
   - `STORAGE_DRIVER=s3` (along with Cloudflare R2 bucket credentials)

### 3. Frontend (Vercel)
1. Import the repository on [Vercel](https://vercel.com).
2. Set **Root Directory** to `client`.
3. Framework Preset: Next.js.
4. Environment variables:
   - `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api`

---

## 📑 Requirements Checklist

All 11 mandatory assignment requirements are satisfied and tested. For full mapping to pages, endpoints, and automated tests, see **[docs/REQUIREMENTS_CHECKLIST.md](docs/REQUIREMENTS_CHECKLIST.md)**.

- [x] **Requirement 1:** Authenticated Home/Dashboard with real project stats & recent activity.
- [x] **Requirement 2:** Listing and detail pages for projects and issues (tasks & bugs).
- [x] **Requirement 3:** Create and update projects, tasks, and bug reports.
- [x] **Requirement 4:** Delete records user owns or manages with confirmation dialogs.
- [x] **Requirement 5:** Comments, discussion, assignments, status updates, media attachments.
- [x] **Requirement 6:** Backend-executed search and filtering across multiple criteria.
- [x] **Requirement 7:** User profile with assigned tasks, reported issues, and editable info.
- [x] **Requirement 8:** Functional REST backend API connecting client to server logic.
- [x] **Requirement 9:** Relational PostgreSQL database surviving restarts and refreshes.
- [x] **Requirement 10:** Input validation (Zod), loading states, and error handling.
- [x] **Requirement 11:** Responsive UI verified across mobile, tablet, and desktop.
- [x] **Differentiator:** Visual Bug Reporting with screen/voice capture, logs, and streaming player.

---

## 📄 License
This project was developed for the Rewamp Digital Full Stack Developer Internship selection assignment.
