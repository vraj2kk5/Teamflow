import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("Phase 4: Attachments, Media Validation, Magic Bytes, Access Tokens", () => {
  let adminCookie: string;
  let orgId: string;
  let projectId: string;
  let issueId: string;
  let validAttachmentId: string;
  let accessUrl: string;

  // 1x1 valid PNG buffer with real PNG magic header (89 50 4E 47 0D 0A 1A 0A)
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

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

    // Setup Admin and project
    const adminRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Media Admin",
        email: "media.admin@example.com",
        password: "Password123!",
        orgName: "Media Test Org",
      });

    adminCookie = adminRes.headers["set-cookie"][0];
    orgId = adminRes.body.data.organization.id;

    const projRes = await request(app)
      .post("/api/projects")
      .set("Cookie", adminCookie)
      .send({ name: "Media Test Project" });

    projectId = projRes.body.data.id;

    const issueRes = await request(app)
      .post("/api/issues")
      .set("Cookie", adminCookie)
      .send({
        projectId,
        type: "BUG",
        title: "Visual rendering glitch",
        description: "Screen flicker on high DPI monitors",
      });

    issueId = issueRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("1. Valid PNG upload creates Attachment record and stores file", async () => {
    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set("Cookie", adminCookie)
      .attach("file", validPngBuffer, "screenshot.png");

    expect(res.status).toBe(201);
    expect(res.body.data.kind).toBe("IMAGE");
    expect(res.body.data.mimeType).toBe("image/png");
    expect(res.body.data.sizeBytes).toBe(validPngBuffer.length);
    validAttachmentId = res.body.data.id;
  });

  it("2. Spoofed extension fails magic-byte check with 415", async () => {
    // Text file pretending to be image/png
    const fakeBuffer = Buffer.from("THIS IS NOT A PNG, JUST PLAIN TEXT");

    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set("Cookie", adminCookie)
      .attach("file", fakeBuffer, "hacked.png");

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("3. SVG upload is rejected with 415 (script risk check)", async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set("Cookie", adminCookie)
      .attach("file", svgBuffer, "image.svg");

    expect(res.status).toBe(415);
    expect(res.body.error.message).toContain("SVG files are not permitted");
  });

  it("4. Empty file upload fails with 400", async () => {
    const emptyBuffer = Buffer.alloc(0);

    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set("Cookie", adminCookie)
      .attach("file", emptyBuffer, "empty.png");

    expect(res.status).toBe(400);
  });

  it("5. Oversize image upload (>5MB) fails with 413", async () => {
    // 6MB buffer starting with valid PNG header
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
    validPngBuffer.copy(largeBuffer, 0, 0, 16);

    const res = await request(app)
      .post(`/api/issues/${issueId}/attachments`)
      .set("Cookie", adminCookie)
      .attach("file", largeBuffer, "huge.png");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("6. Authorized user retrieves access URL and can stream file with range requests", async () => {
    const accessRes = await request(app)
      .get(`/api/attachments/${validAttachmentId}/access`)
      .set("Cookie", adminCookie);

    expect(accessRes.status).toBe(200);
    expect(accessRes.body.data.accessUrl).toBeDefined();
    expect(accessRes.body.data.expiresIn).toBe(600);
    accessUrl = accessRes.body.data.accessUrl;

    // Stream file without auth header using the signed token URL
    const streamRes = await request(app).get(accessUrl);
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers["content-type"]).toBe("image/png");
    expect(streamRes.headers["x-content-type-options"]).toBe("nosniff");

    // Test HTTP 206 Partial Content Range request
    const rangeRes = await request(app)
      .get(accessUrl)
      .set("Range", "bytes=0-10");

    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers["content-range"]).toContain("bytes 0-10/");
    expect(rangeRes.headers["content-length"]).toBe("11");
  });

  it("7. Deleting attachment removes DB record and file from disk", async () => {
    const attachmentBefore = await prisma.attachment.findUnique({
      where: { id: validAttachmentId },
    });
    expect(attachmentBefore).toBeDefined();

    const deleteRes = await request(app)
      .delete(`/api/attachments/${validAttachmentId}`)
      .set("Cookie", adminCookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.success).toBe(true);

    const attachmentAfter = await prisma.attachment.findUnique({
      where: { id: validAttachmentId },
    });
    expect(attachmentAfter).toBeNull();
  });
});
