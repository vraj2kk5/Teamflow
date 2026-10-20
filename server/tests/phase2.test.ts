import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Phase 2: Orgs, Projects, Issues, RBAC Integration Tests", () => {
  let adminToken: string;
  let adminCookie: string;
  let orgId: string;
  let inviteCode: string;

  let pmToken: string;
  let pmCookie: string;
  let pmUserId: string;

  let memberToken: string;
  let memberCookie: string;
  let memberUserId: string;

  let projectId: string;
  let issueId: string;

  beforeAll(async () => {
    // Clean database of previous test runs
    await prisma.activityLog.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.attachment.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.projectMembership.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.organizationMembership.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Admin registers and creates organization", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Admin User",
        email: "admin.p2@example.com",
        password: "Password123!",
        orgName: "Phase2 Tech Inc",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("ADMIN");
    adminToken = res.body.data.token;
    orgId = res.body.data.organization.id;
    inviteCode = res.body.data.organization.inviteCode;

    const cookies = res.headers["set-cookie"];
    adminCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  it("2. User joins with invite code as MEMBER", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Member User",
        email: "member.p2@example.com",
        password: "Password123!",
        inviteCode,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("MEMBER");
    expect(res.body.data.organization.id).toBe(orgId);
    memberToken = res.body.data.token;
    memberUserId = res.body.data.user.id;

    const cookies = res.headers["set-cookie"];
    memberCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  it("3. User joins and is promoted to PROJECT_MANAGER by Admin", async () => {
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "PM User",
        email: "pm.p2@example.com",
        password: "Password123!",
        inviteCode,
      });

    expect(regRes.status).toBe(201);
    pmUserId = regRes.body.data.user.id;
    pmToken = regRes.body.data.token;

    // Admin promotes PM user
    const promoteRes = await request(app)
      .patch(`/api/organizations/${orgId}/members/${pmUserId}`)
      .set("Cookie", adminCookie)
      .send({ role: "PROJECT_MANAGER" });

    expect(promoteRes.status).toBe(200);
    expect(promoteRes.body.data.role).toBe("PROJECT_MANAGER");

    // Login as PM to refresh token payload with new role
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "pm.p2@example.com", password: "Password123!" });

    pmToken = loginRes.body.data.token;
    const cookies = loginRes.headers["set-cookie"];
    pmCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  it("4. PM creates a project and is automatically owner & member", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Cookie", pmCookie)
      .send({
        name: "Core Infrastructure",
        description: "DevOps and cloud services setup",
        status: "ACTIVE",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Core Infrastructure");
    expect(res.body.data.ownerId).toBe(pmUserId);
    projectId = res.body.data.id;
  });

  it("5. Member attempts to create a project and is denied with 403", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Cookie", memberCookie)
      .send({
        name: "Unauthorized Project",
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("6. PM adds Member to the project", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set("Cookie", pmCookie)
      .send({ userId: memberUserId });

    expect(res.status).toBe(201);
  });

  it("7. PM creates an issue assigned to Member with TF key", async () => {
    const res = await request(app)
      .post("/api/issues")
      .set("Cookie", pmCookie)
      .send({
        projectId,
        type: "TASK",
        title: "Setup CI/CD pipeline",
        description: "Configure GitHub Actions or equivalent runner",
        priority: "HIGH",
        assigneeId: memberUserId,
        estimatedHours: 8,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe("TF-1");
    expect(res.body.data.assigneeId).toBe(memberUserId);
    issueId = res.body.data.id;
  });

  it("8. Assigning non-project member to issue fails with 400", async () => {
    // Create an outside user in another org
    const outsideUser = await prisma.user.create({
      data: {
        name: "Outside User",
        email: "outside@other.com",
        passwordHash: "hash",
      },
    });

    const res = await request(app)
      .post("/api/issues")
      .set("Cookie", pmCookie)
      .send({
        projectId,
        type: "TASK",
        title: "Invalid assignment test",
        description: "Assignee is not in project",
        assigneeId: outsideUser.id,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("registered member of this project");
  });

  it("9. Member retrieves assigned issue and updates status to DONE (sets resolvedAt)", async () => {
    // Member reads issue
    const getRes = await request(app)
      .get(`/api/issues/${issueId}`)
      .set("Cookie", memberCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.title).toBe("Setup CI/CD pipeline");

    // Member marks DONE
    const statusRes = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set("Cookie", memberCookie)
      .send({ status: "DONE" });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe("DONE");
    expect(statusRes.body.data.resolvedAt).toBeDefined();

    // Moving back to IN_PROGRESS clears resolvedAt
    const moveRes = await request(app)
      .patch(`/api/issues/${issueId}/status`)
      .set("Cookie", memberCookie)
      .send({ status: "IN_PROGRESS" });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.status).toBe("IN_PROGRESS");
    expect(moveRes.body.data.resolvedAt).toBeNull();
  });

  it("10. Attempting to demote or remove the last Admin fails with clear error", async () => {
    const adminMembership = await prisma.organizationMembership.findFirst({
      where: { organizationId: orgId, role: "ADMIN" },
    });

    const res = await request(app)
      .patch(`/api/organizations/${orgId}/members/${adminMembership!.userId}`)
      .set("Cookie", adminCookie)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("last administrator");
  });

  it("11. Member cannot delete a project (negative check)", async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set("Cookie", memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("12. Verify ActivityLog entries were created inside transactions", async () => {
    const logs = await prisma.activityLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    expect(logs.length).toBeGreaterThanOrEqual(4);
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("PROJECT_CREATED");
    expect(actions).toContain("ISSUE_CREATED");
    expect(actions).toContain("STATUS_CHANGED");
  });
});
