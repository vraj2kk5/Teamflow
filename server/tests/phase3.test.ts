import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Phase 3: Comments, Dashboard, Profiles, Activity Integration Tests", () => {
  let adminCookie: string;
  let memberCookie: string;
  let adminUserId: string;
  let memberUserId: string;
  let orgId: string;
  let projectId: string;
  let issueId: string;
  let commentId: string;

  beforeAll(async () => {
    // Reset database
    await prisma.activityLog.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.attachment.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.projectMembership.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.organizationMembership.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Setup Admin
    const adminRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Diana Prince",
        email: "diana.phase3@example.com",
        password: "Password123!",
        orgName: "Themyscira Tech",
      });

    adminCookie = adminRes.headers["set-cookie"][0];
    adminUserId = adminRes.body.data.user.id;
    orgId = adminRes.body.data.organization.id;
    const inviteCode = adminRes.body.data.organization.inviteCode;

    // 2. Setup Member
    const memberRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Barry Allen",
        email: "barry.phase3@example.com",
        password: "Password123!",
        inviteCode,
      });

    memberCookie = memberRes.headers["set-cookie"][0];
    memberUserId = memberRes.body.data.user.id;

    // 3. Setup Project
    const projRes = await request(app)
      .post("/api/projects")
      .set("Cookie", adminCookie)
      .send({
        name: "Speedforce Analytics",
        description: "High speed metrics system",
      });

    projectId = projRes.body.data.id;

    // Add member to project
    await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set("Cookie", adminCookie)
      .send({ userId: memberUserId });

    // 4. Setup 2 Issues: one task, one bug
    const issue1 = await request(app)
      .post("/api/issues")
      .set("Cookie", adminCookie)
      .send({
        projectId,
        type: "TASK",
        title: "Setup database caching",
        description: "Speed up queries using in-memory layer",
        priority: "HIGH",
        assigneeId: memberUserId,
      });

    issueId = issue1.body.data.id;

    await request(app)
      .post("/api/issues")
      .set("Cookie", adminCookie)
      .send({
        projectId,
        type: "BUG",
        title: "Memory leak in query planner",
        description: "High memory consumption detected",
        priority: "CRITICAL",
      });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Member adds comment to issue (writes ActivityLog inside transaction)", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/comments`)
      .set("Cookie", memberCookie)
      .send({ body: "I am actively investigating this task!" });

    expect(res.status).toBe(201);
    expect(res.body.data.body).toBe("I am actively investigating this task!");
    expect(res.body.data.authorId).toBe(memberUserId);
    commentId = res.body.data.id;

    // Verify activity log
    const log = await prisma.activityLog.findFirst({
      where: {
        issueId,
        action: "COMMENT_ADDED",
      },
    });
    expect(log).toBeDefined();
    expect(log!.actorId).toBe(memberUserId);
  });

  it("2. Author edits own comment; other user cannot edit (403)", async () => {
    // Admin tries to edit member's comment -> 403
    const forbiddenRes = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set("Cookie", adminCookie)
      .send({ body: "Tampered by admin" });

    expect(forbiddenRes.status).toBe(403);

    // Member edits own comment -> 200
    const okRes = await request(app)
      .patch(`/api/comments/${commentId}`)
      .set("Cookie", memberCookie)
      .send({ body: "Updated comment: Progress made!" });

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.body).toBe("Updated comment: Progress made!");
  });

  it("3. GET /api/dashboard returns correct real database aggregates", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    const stats = res.body.data.stats;
    expect(stats.totalProjects).toBe(1);
    expect(stats.openTasks).toBe(1); // Task is in TODO
    expect(stats.openBugs).toBe(1); // Bug is in TODO
    expect(stats.highPriorityOpen).toBe(2); // One HIGH, one CRITICAL

    const projectHealth = res.body.data.projectHealth;
    expect(projectHealth.length).toBe(1);
    expect(projectHealth[0].name).toBe("Speedforce Analytics");
    expect(projectHealth[0].totalIssues).toBe(2);
    expect(projectHealth[0].openBugs).toBe(1);

    expect(res.body.data.recentActivity.length).toBeGreaterThan(0);
  });

  it("4. User profile endpoints work and allow editing own profile", async () => {
    // Member updates own profile
    const patchRes = await request(app)
      .patch("/api/users/me")
      .set("Cookie", memberCookie)
      .send({
        name: "Barry Allen (Flash)",
        jobTitle: "Senior Systems Engineer",
        bio: "Fastest developer alive.",
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.name).toBe("Barry Allen (Flash)");
    expect(patchRes.body.data.jobTitle).toBe("Senior Systems Engineer");

    // Fetch profile
    const getRes = await request(app)
      .get(`/api/users/${memberUserId}`)
      .set("Cookie", adminCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.name).toBe("Barry Allen (Flash)");
    expect(getRes.body.data.stats.assignedCount).toBe(1);

    // Fetch assigned issues
    const issuesRes = await request(app)
      .get(`/api/users/${memberUserId}/issues?relation=assigned`)
      .set("Cookie", memberCookie);

    expect(issuesRes.status).toBe(200);
    expect(issuesRes.body.data.length).toBe(1);
    expect(issuesRes.body.data[0].id).toBe(issueId);
  });

  it("5. GET /api/activity returns organization audit log feed", async () => {
    const res = await request(app)
      .get("/api/activity")
      .set("Cookie", memberCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
  });

  it("6. Admin deletes comment with permission", async () => {
    const res = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const check = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    expect(check).toBeNull();
  });
});
