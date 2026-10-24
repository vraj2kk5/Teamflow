import { Request, Response, NextFunction } from "express";
import { OrgsService } from "./orgs.service";
import { updateOrgSchema, addMemberSchema, updateMemberRoleSchema } from "./orgs.schema";
import { UnauthorizedError } from "../../lib/errors";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

function resolveOrgId(req: Request): string {
  const raw = param(req.params.id);
  if (!raw || raw === "current") {
    return req.auth?.organizationId || "";
  }
  return raw;
}

export class OrgsController {
  static async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.auth?.organizationId;
      if (!orgId) throw new UnauthorizedError();

      const org = await OrgsService.getCurrentOrg(orgId, req.auth?.role);
      res.status(200).json({ data: org });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const validated = updateOrgSchema.parse(req.body);
      const updated = await OrgsService.updateOrg(orgId, validated, req.auth!.userId);
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const members = await OrgsService.getMembers(orgId);
      res.status(200).json({ data: members });
    } catch (err) {
      next(err);
    }
  }

  static async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const validated = addMemberSchema.parse(req.body);
      const member = await OrgsService.addMemberByEmail(orgId, validated, req.auth!.userId);
      res.status(201).json({ data: member });
    } catch (err) {
      next(err);
    }
  }

  static async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const targetUserId = param(req.params.userId);
      const validated = updateMemberRoleSchema.parse(req.body);
      const updated = await OrgsService.updateMemberRole(
        orgId,
        targetUserId,
        validated.role,
        req.auth!.userId
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const targetUserId = param(req.params.userId);
      const result = await OrgsService.removeMember(orgId, targetUserId, req.auth!.userId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async rotateInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const updated = await OrgsService.rotateInviteCode(orgId);
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = resolveOrgId(req);
      const result = await OrgsService.deleteOrg(orgId, req.auth!.userId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId || req.user?.id;
      if (!userId) throw new UnauthorizedError();

      const result = await OrgsService.createOrg(userId, req.body);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId || req.user?.id;
      if (!userId) throw new UnauthorizedError();

      const result = await OrgsService.joinOrg(userId, req.body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
