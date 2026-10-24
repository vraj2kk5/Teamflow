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
7. [Email Services & Real Inbox Notifications](#-email-services--real-inbox-notifications)
8. [Demo Accounts & Seed Data](#-demo-accounts--seed-data)
9. [Automated Testing](#-automated-testing)
10. [Storage Drivers: Local Disk vs Cloudflare R2](#-storage-drivers-local-disk-vs-cloudflare-r2)
11. [Production Deployment Guide](#-production-deployment-guide)
12. [Requirements Checklist](#-requirements-checklist)

---

## 🌟 Overview & Key Features

> ✉️ **Live Email Services Active:** TeamFlow has automated transactional email delivery enabled. When registering, testing invitations, or assigning tasks, **use your real, original email address** (e.g. your Gmail or Outlook) to receive real-time notifications in your inbox.

TeamFlow provides a streamlined, original alternative to bloated legacy project management tools like Jira. Designed for fast-moving engineering teams, it combines agile task tracking with a first-class visual diagnostic reporting workflow.

- **Real-Time Project Health & Dashboard:** Live statistics computed directly from PostgreSQL database aggregates without mockups or simulated counters.
- **Interactive Kanban Boards:** Four-stage workflow (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`) with automated resolution timestamping and immutable activity auditing.
- **Role-Based Access Control (RBAC):** Organization-scoped permissions (`ADMIN`, `PROJECT_MANAGER`, `MEMBER`) enforced strictly on the backend with cross-tenant 404 security.
- **Full Discussion & Collaboration:** Rich comment threads, user task assignments, multi-parameter server-side search and filtering.
- **Responsive Design:** Native mobile slide-over drawer, responsive grid layouts, and touch-friendly controls tested across desktop, tablet, and mobile.

---

## 🎯 The Differentiating Feature: Visual Bug Reporting

When developers encounter a software defect, traditional bug tracking leads to vague text descriptions. TeamFlow solves this with an integrated **Visual Bug Reporting** suite:

1. **Screen Recording:** Capture browser tab or screen reproductions directly via `getDisplayMedia()`, with optional microphone commentary (up to 5 minutes).
2. **Voice Memo Recording:** Record audio explanations with waveform pulse indicators and live timer (`aria-live="polite"`) via `getUserMedia({ audio: true })`.
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
│   │   ├── app/                # App router pages (dashboard, projects, issues, bug-reports, auth)
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
│   │   ├── modules/            # Auth, Orgs, Projects, Issues, Comments, Attachments, Dashboard
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
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide Icons | Server components, static route optimization, modern dark theme |
| **Backend** | Node.js, Express.js, TypeScript, Helmet, CORS, Multer | Lightweight, robust REST architecture with central error handling |
| **Database** | PostgreSQL 16 with Prisma ORM | Relational integrity, cascade deletions, typed queries, migrations |
| **Auth** | JWT stored in `httpOnly`, `SameSite=Lax` (dev) / `SameSite=None; Secure` (prod) cookie | XSS-resilient authentication, bcrypt hashing (cost 10) |
| **Storage Driver** | Pluggable interface: `LocalDiskDriver` (dev) & `S3Driver` (prod) | Zero-credential local dev with HTTP 206 streaming; Cloudflare R2 ready |
| **Testing** | Vitest, Supertest | Fast, reliable integration testing against real database |

---

## 📋 Prerequisites

- **Node.js:** v18.18+ or v20+ (`node -v`)
- **npm:** v9+ (`npm -v`)
- **PostgreSQL:** v14+ running locally on port 5432 (or a free cloud database like Neon or Supabase)

---

## ⚡ Quick Start & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/teamflow.git
cd teamflow
```

### 2. Configure Environment Variables
Copy `.env.example` into server and client directories:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

Ensure `server/.env` contains your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/teamflow?schema=public"
JWT_SECRET="development_super_secret_jwt_key_at_least_32_characters"
STORAGE_DRIVER="LOCAL_DISK"
UPLOAD_DIR="./uploads"
PORT=5000
CLIENT_ORIGIN="http://localhost:3000"
```

### 3. Install Dependencies
```bash
# Install root, server, and client dependencies
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Run Database Migrations & Seed Data
```bash
# Apply Prisma migrations
npm --prefix server run prisma:migrate

# Seed demo users, projects, issues, and activity logs
npm --prefix server run prisma:seed
```

### 5. Start Development Servers
Open two terminals:

```bash
# Terminal 1: Start Backend API (runs on http://localhost:5000)
cd server
npm run dev

# Terminal 2: Start Frontend Application (runs on http://localhost:3000)
cd client
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 📧 Email Services & Real Inbox Notifications

> 💡 **Important:** When testing TeamFlow, **please use your actual/original email address**!

TeamFlow integrates live transactional email delivery (powered by **Brevo SMTP** and **Resend API**). Real emails are dynamically delivered to recipients' inboxes for:

1. **Workspace Welcome Email:** When an Admin registers an account and creates a workspace, they receive their welcome email with workspace details and invite code.
2. **Login Security Alerts:** Users receive a notification whenever they log in, with security timestamps and dashboard deep-links.
3. **Workspace Member Invitations:** Inviting a new user via their email address dispatches a personalized email with the workspace invite code and pre-configured role (`PROJECT_MANAGER` or `MEMBER`).
4. **Task & Bug Assignment Notifications:** Whenever an Admin or Project Manager assigns a task or bug to a team member, that member receives an instant email containing the ticket key (e.g., `TF-1`), task title, reporter name, and a one-click button to view the task directly.

Ensure you register with your **original email address** to experience and verify real email notifications!

---

## 👥 Demo Accounts & Seed Data

The database is pre-seeded with 3 realistic accounts representing all 3 role levels:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **ADMIN** | `admin@teamflow.dev` | `Password123!` | Full organization management, project deletion, all issues |
| **PROJECT_MANAGER** | `pm@teamflow.dev` | `Password123!` | Project creation, issue assignments, Kanban board moves |
| **MEMBER** | `member@teamflow.dev` | `Password123!` | Task updates, visual bug reporting, commenting |

*Note: The seed script strictly refuses to execute in `NODE_ENV=production` for data safety.*

---

## 🧪 Automated Testing

TeamFlow includes 35 comprehensive automated integration tests covering authentication, RBAC policy enforcement, Kanban state transitions, comment permissions, magic-byte sniffing, and media uploads.

```bash
# Run all server integration tests
npm --prefix server test
```

### Test Suite Summary:
- **`tests/auth.test.ts` (10 tests):** Registration, password hashing, JWT cookies, duplicate emails, auth middleware.
- **`tests/phase2.test.ts` (12 tests):** Cross-organization 404 security, project CRUD, sequential issue keys (`TF-1`), Kanban status moves.
- **`tests/phase3.test.ts` (6 tests):** Comment author permissions, real dashboard aggregate metrics, user task query filters.
- **`tests/phase4.test.ts` (7 tests):** Magic-byte sniffing (`file-type`), 5MB image limit, 415 executable rejection, HMAC streaming tokens, HTTP 206 range requests.

### Client Production Build:
```bash
# Verify static generation and TypeScript compilation for all 16 client routes
npm --prefix client run build
```

---

## 💾 Storage Drivers: Local Disk vs Cloudflare R2

TeamFlow uses a clean driver abstraction (`server/src/lib/storage/storage.driver.ts`):

```typescript
export interface StorageDriver {
  upload(file: Express.Multer.File, key: string): Promise<UploadResult>;
  getStream(key: string, range?: { start: number; end?: number }): Promise<StreamResult>;
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
- Compatible with **Cloudflare R2**, **Supabase Storage**, or **AWS S3**.
- Set `STORAGE_DRIVER="S3"`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional `S3_ENDPOINT`.

---

## 🚀 Production Deployment Guide

### 1. Database (Neon or Supabase)
1. Create a free PostgreSQL instance on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
2. Copy the connection string into your environment variables as `DATABASE_URL`.
3. Run `npm run prisma:deploy` to apply migrations.

### 2. Backend (Render or Railway)
1. Deploy the `server/` directory as a Node.js web service.
2. Build command: `npm install && npm run build`
3. Start command: `node dist/server.js`
4. Environment variables to configure:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your-postgres-url>`
   - `JWT_SECRET=<strong-random-key>`
   - `CLIENT_ORIGIN=https://<your-frontend-domain>`
   - `STORAGE_DRIVER=S3` (along with Cloudflare R2 bucket credentials)

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
