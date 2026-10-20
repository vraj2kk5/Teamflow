import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Auth Integration Tests", () => {
  const testUser = {
    name: "Alex Rivera",
    email: `alex.rivera.${Date.now()}@example.com`,
    password: "Password123!",
    orgName: "Acme Innovations",
  };

  let authCookie: string;

  beforeAll(async () => {
    // Clean up test data across tables in foreign key order
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

  it("GET /api/health should return ok and connected database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
    expect(res.body.storageDriver).toBeDefined();
  });

  it("POST /api/auth/register should create user, organization, and set auth cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.user.name).toBe(testUser.name);
    expect(res.body.data.role).toBe("ADMIN");
    expect(res.body.data.organization.name).toBe(testUser.orgName);
    expect(res.body.data.token).toBeDefined();

    // Check set-cookie header
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieHeader).toContain("token=");
    expect(cookieHeader).toContain("HttpOnly");

    authCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  it("POST /api/auth/register should fail on duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("POST /api/auth/register should fail on short password with 422", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Short Pwd",
        email: `short.${Date.now()}@example.com`,
        password: "short",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toBeDefined();
  });

  it("POST /api/auth/login should authenticate user and issue cookie", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.role).toBe("ADMIN");
  });

  it("POST /api/auth/login with wrong password should fail with 401 generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword999!",
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("POST /api/auth/login with non-existent email should fail with 401 generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nonexistent@example.com",
        password: "Password123!",
      });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("GET /api/auth/me should return user and org when authenticated via cookie", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(res.body.data.organization.name).toBe(testUser.orgName);
    expect(res.body.data.role).toBe("ADMIN");
  });

  it("GET /api/auth/me without cookie should return 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/logout should clear the auth cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    const cookieHeader = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieHeader).toMatch(/token=;/);
  });
});
