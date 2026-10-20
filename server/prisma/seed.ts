import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run seed script in production environment!");
  }

  console.log("🌱 Starting TeamFlow database seed...");

  // 1. Upsert Demo Users
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@teamflow.dev" },
    update: { passwordHash, name: "Sarah Connor (Admin)" },
    create: {
      email: "admin@teamflow.dev",
      name: "Sarah Connor (Admin)",
      passwordHash,
    },
  });

  const pmUser = await prisma.user.upsert({
    where: { email: "pm@teamflow.dev" },
    update: { passwordHash, name: "Alex Rivera (PM)" },
    create: {
      email: "pm@teamflow.dev",
      name: "Alex Rivera (PM)",
      passwordHash,
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: "member@teamflow.dev" },
    update: { passwordHash, name: "David Chen (Dev)" },
    create: {
      email: "member@teamflow.dev",
      name: "David Chen (Dev)",
      passwordHash,
    },
  });

  console.log("👤 Created/Updated 3 Demo Users: admin@teamflow.dev, pm@teamflow.dev, member@teamflow.dev");

  // 2. Upsert Demo Organization
  const org = await prisma.organization.upsert({
    where: { slug: "acme-engineering" },
    update: { name: "Acme Engineering" },
    create: {
      name: "Acme Engineering",
      slug: "acme-engineering",
    },
  });

  // 3. Organization Memberships (ADMIN, PROJECT_MANAGER, MEMBER)
  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: org.id,
      },
    },
    update: { role: "ADMIN" },
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: "ADMIN",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: pmUser.id,
        organizationId: org.id,
      },
    },
    update: { role: "PROJECT_MANAGER" },
    create: {
      userId: pmUser.id,
      organizationId: org.id,
      role: "PROJECT_MANAGER",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: memberUser.id,
        organizationId: org.id,
      },
    },
    update: { role: "MEMBER" },
    create: {
      userId: memberUser.id,
      organizationId: org.id,
      role: "MEMBER",
    },
  });

  console.log("🏢 Configured Organization 'Acme Engineering' with 3 role memberships");

  // 4. Projects
  // Project 1: Core Platform
  let proj1 = await prisma.project.findFirst({
    where: { organizationId: org.id, name: "Core Platform" },
  });
  if (!proj1) {
    proj1 = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: "Core Platform",
        description: "Next-generation cloud infrastructure, API services, and micro-frontend platform.",
        ownerId: adminUser.id,
        issueSequence: 8,
      },
    });
  }

  // Project 2: Mobile App
  let proj2 = await prisma.project.findFirst({
    where: { organizationId: org.id, name: "Mobile Application" },
  });
  if (!proj2) {
    proj2 = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: "Mobile Application",
        description: "Cross-platform iOS and Android companion app with offline caching and push alerts.",
        ownerId: pmUser.id,
        issueSequence: 5,
      },
    });
  }

  // Project Memberships
  // Proj 1: Sarah, Alex, David
  for (const user of [adminUser, pmUser, memberUser]) {
    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          userId: user.id,
          projectId: proj1.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        projectId: proj1.id,
      },
    });
  }

  // Proj 2: Alex, David
  for (const user of [pmUser, memberUser]) {
    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          userId: user.id,
          projectId: proj2.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        projectId: proj2.id,
      },
    });
  }

  console.log("📁 Created 2 Projects: Core Platform, Mobile Application");

  // 5. Issues Seed (Core Platform)
  const seedIssuesProj1 = [
    {
      key: "TF-1",
      title: "Memory leak during WebSocket heartbeat reconnection on high latency",
      type: "BUG" as const,
      status: "TODO" as const,
      priority: "CRITICAL" as const,
      description: "Under simulated packet drops and reconnect spikes, worker processes continuously allocate memory without garbage collection releasing buffer references.",
      stepsToReproduce: "1. Connect 10,000 synthetic test clients.\n2. Inject 300ms network packet loss.\n3. Observe node process memory consumption exceeding 1.8GB.",
      expectedResult: "Heartbeat timer throttles exponentially and garbage collector keeps heap under 250MB.",
      actualResult: "Worker triggers OOM killer and exits with code 137.",
      errorLog: "FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory\n1: 0xb09c10 node::Abort() [node]\n2: 0xa1c42f [node]\n3: 0xce7e3e v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, bool) [node]",
      reporterId: memberUser.id,
      assigneeId: adminUser.id,
    },
    {
      key: "TF-2",
      title: "Database connection pool exhaustion when bulk-exporting project audit logs",
      type: "BUG" as const,
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      description: "Audit CSV export holds transaction connections open while streaming to client rather than using cursor pagination.",
      stepsToReproduce: "1. Navigate to Settings -> Audit Feed.\n2. Click 'Export Full CSV'.\n3. Wait 15 seconds.",
      expectedResult: "Streamed CSV in 500-record chunks without monopolizing connection pool.",
      actualResult: "Prisma client throws P2024: Timed out fetching a new connection from the pool.",
      errorLog: "PrismaClientInitializationError: Timed out fetching a new connection from the connection pool. More info: http://pris.ly/d/connection-pool (Current connection pool timeout: 10, Connection limit: 20)",
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "TF-3",
      title: "Implement rate limiting and CSRF protection headers on state-changing endpoints",
      type: "TASK" as const,
      status: "IN_REVIEW" as const,
      priority: "HIGH" as const,
      description: "Verify X-Requested-With and enforce express-rate-limit windows across authentication and file upload routes.",
      reporterId: adminUser.id,
      assigneeId: pmUser.id,
    },
    {
      key: "TF-4",
      title: "Upgrade Prisma ORM and generate migration files for polymorphic activity logs",
      type: "TASK" as const,
      status: "DONE" as const,
      priority: "MEDIUM" as const,
      description: "Ensure all metadata fields are safely indexed as JSONB and reverse foreign keys cascade cleanly.",
      resolvedAt: new Date(),
      reporterId: adminUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "TF-5",
      title: "Visual bug: Avatar initials wrap onto two lines in Safari 17.2",
      type: "BUG" as const,
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      description: "When rendering two-character initials in the navigation bar, Safari flexbox wraps the second initial below the first.",
      stepsToReproduce: "1. Open app in Safari 17.2 on macOS Sonoma.\n2. Observe top right profile circle.",
      expectedResult: "Initials remain centered horizontally and vertically on a single line.",
      actualResult: "Second character wraps downwards.",
      reporterId: memberUser.id,
      assigneeId: pmUser.id,
    },
    {
      key: "TF-6",
      title: "Add automated dark mode contrast checks to CI pipeline",
      type: "TASK" as const,
      status: "TODO" as const,
      priority: "LOW" as const,
      description: "Integrate axe-core automated audits on slate-900 / indigo-500 design tokens.",
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "TF-7",
      title: "Build HTTP 206 partial content streaming driver for local audio/video",
      type: "TASK" as const,
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      description: "Support byte-range requests for smooth scrubbing and seeking on recordings in local dev mode.",
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "TF-8",
      title: "CORS preflight failure on cross-origin media download tokens",
      type: "BUG" as const,
      status: "DONE" as const,
      priority: "HIGH" as const,
      description: "Local media server was rejecting preflight OPTIONS requests without credentials header.",
      resolvedAt: new Date(),
      errorLog: "Access to fetch at 'http://localhost:5000/api/attachments/stream' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
      reporterId: memberUser.id,
      assigneeId: adminUser.id,
    },
  ];

  for (const item of seedIssuesProj1) {
    const existing = await prisma.issue.findFirst({
      where: { projectId: proj1.id, key: item.key },
    });
    if (!existing) {
      await prisma.issue.create({
        data: {
          projectId: proj1.id,
          organizationId: org.id,
          ...item,
        },
      });
    }
  }

  // 6. Issues Seed (Mobile App)
  const seedIssuesProj2 = [
    {
      key: "MOB-1",
      title: "Integrate biometric face unlock and keychain token persistence",
      type: "TASK" as const,
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      description: "Store encrypted refresh token in iOS Keychain and Android Keystore with biometric prompt fallback.",
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "MOB-2",
      title: "Crash on background resume when camera permission was revoked in iOS Settings",
      type: "BUG" as const,
      status: "IN_REVIEW" as const,
      priority: "CRITICAL" as const,
      description: "App crashes immediately upon resuming from background if camera permission was switched off by user in device settings.",
      stepsToReproduce: "1. Launch app and open camera view.\n2. Minimize app to home screen.\n3. Go to iOS Settings -> Privacy -> TeamFlow -> Disable Camera.\n4. Resume TeamFlow.",
      expectedResult: "Graceful camera permission denied banner shown with 'Open Settings' button.",
      actualResult: "App crashes with uncaught NSInvalidArgumentException.",
      errorLog: "Fatal Exception: NSInvalidArgumentException\n*** -[AVCaptureDeviceInput initWithDevice:error:]: Cannot open device: <AVCaptureFigVideoDevice: 0x280e21500 [Back Camera][com.apple.avfoundation.avcapturedevice.built-in_video:0]>\n0   CoreFoundation  __exceptionPreprocess + 220\n1   libobjc.A.dylib objc_exception_throw + 60\n2   AVFCapture      -[AVCaptureDeviceInput initWithDevice:error:] + 480",
      reporterId: memberUser.id,
      assigneeId: pmUser.id,
    },
    {
      key: "MOB-3",
      title: "Offline sync queue with SQLite and optimistic task completion",
      type: "TASK" as const,
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      description: "Store pending status changes locally when device has no cellular connectivity.",
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
    {
      key: "MOB-4",
      title: "Push notification badge count does not decrement after viewing issue details",
      type: "BUG" as const,
      status: "TODO" as const,
      priority: "LOW" as const,
      description: "Opening an issue from notification does not clear the OS icon badge count.",
      stepsToReproduce: "1. Receive push notification for new issue.\n2. Tap notification to open issue.\n3. Return to home screen.",
      expectedResult: "App icon badge count resets to 0.",
      actualResult: "Badge remains at 1.",
      reporterId: adminUser.id,
      assigneeId: pmUser.id,
    },
    {
      key: "MOB-5",
      title: "Configure splash screen assets and app icons for Android 14 adaptive icons",
      type: "TASK" as const,
      status: "DONE" as const,
      priority: "LOW" as const,
      description: "Generate monochrome and dynamic themed icon vectors.",
      resolvedAt: new Date(),
      reporterId: pmUser.id,
      assigneeId: memberUser.id,
    },
  ];

  for (const item of seedIssuesProj2) {
    const existing = await prisma.issue.findFirst({
      where: { projectId: proj2.id, key: item.key },
    });
    if (!existing) {
      await prisma.issue.create({
        data: {
          projectId: proj2.id,
          organizationId: org.id,
          ...item,
        },
      });
    }
  }

  console.log("📝 Seeded 13 realistic issues across Core Platform and Mobile App");

  // 7. Seed Comments on Key Issues
  const issueTf1 = await prisma.issue.findFirst({
    where: { projectId: proj1.id, key: "TF-1" },
  });

  if (issueTf1) {
    const count = await prisma.comment.count({ where: { issueId: issueTf1.id } });
    if (count === 0) {
      await prisma.comment.createMany({
        data: [
          {
            issueId: issueTf1.id,
            authorId: pmUser.id,
            body: "I replicated this issue in staging with autocannon. Memory growth is directly proportional to reconnect frequency.",
          },
          {
            issueId: issueTf1.id,
            authorId: memberUser.id,
            body: "Identified the root cause! The reconnect handler was attaching a new 'error' listener on every attempt without calling removeAllListeners.",
          },
          {
            issueId: issueTf1.id,
            authorId: adminUser.id,
            body: "Excellent detective work David. Let's merge the fix and add a load test to prevent regressions.",
          },
        ],
      });
      console.log("💬 Added discussion comments to TF-1");
    }
  }

  // 8. Seed Activity Logs
  const actCount = await prisma.activityLog.count({ where: { organizationId: org.id } });
  if (actCount < 4) {
    await prisma.activityLog.createMany({
      data: [
        {
          organizationId: org.id,
          projectId: proj1.id,
          actorId: adminUser.id,
          action: "PROJECT_CREATED",
          metadata: { name: proj1.name, key: "TF" },
        },
        {
          organizationId: org.id,
          projectId: proj2.id,
          actorId: pmUser.id,
          action: "PROJECT_CREATED",
          metadata: { name: proj2.name, key: "MOB" },
        },
        {
          organizationId: org.id,
          projectId: proj1.id,
          issueId: issueTf1?.id,
          actorId: memberUser.id,
          action: "ISSUE_CREATED",
          metadata: { key: "TF-1", title: "Memory leak during WebSocket heartbeat reconnection" },
        },
        {
          organizationId: org.id,
          projectId: proj1.id,
          issueId: issueTf1?.id,
          actorId: adminUser.id,
          action: "STATUS_CHANGED",
          metadata: { status: "TODO", priority: "CRITICAL" },
        },
      ],
    });
    console.log("📊 Seeded initial ActivityLog entries");
  }

  console.log("✨ Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
