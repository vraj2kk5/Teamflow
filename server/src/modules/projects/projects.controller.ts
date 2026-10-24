import { Request, Response, NextFunction } from "express";
import { ProjectsService } from "./projects.service";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  joinProjectSchema,
} from "./projects.schema";
import { UnauthorizedError } from "../../lib/errors";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

export class ProjectsController {
  static async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const result = await ProjectsService.getProjects(
        auth.organizationId,
        auth.userId,
        auth.role,
        {
          q: req.query.q as string,
          status: req.query.status as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10,
          allOrgProjects: req.query.allOrgProjects as string,
        }
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const project = await ProjectsService.getProjectById(projectId, auth.organizationId);
      res.status(200).json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  static async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const validated = createProjectSchema.parse(req.body);
      const project = await ProjectsService.createProject(
        auth.organizationId,
        auth.userId,
        validated
      );
      res.status(201).json({ data: project });
    } catch (err) {
      next(err);
    }
  }

  static async joinProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const validated = joinProjectSchema.parse(req.body);
      const result = await ProjectsService.joinProjectByInviteCode(
        auth.organizationId,
        auth.userId,
        validated.inviteCode
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async regenerateInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const result = await ProjectsService.regenerateInviteCode(
        projectId,
        auth.organizationId,
        auth.userId
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const validated = updateProjectSchema.parse(req.body);
      const updated = await ProjectsService.updateProject(
        projectId,
        auth.organizationId,
        auth.userId,
        validated
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const result = await ProjectsService.deleteProject(
        projectId,
        auth.organizationId,
        auth.userId
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const validated = addProjectMemberSchema.parse(req.body);
      const member = await ProjectsService.addProjectMember(
        projectId,
        auth.organizationId,
        validated.userId,
        auth.userId
      );
      res.status(201).json({ data: member });
    } catch (err) {
      next(err);
    }
  }

  static async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectId = param(req.params.id);
      const userId = param(req.params.userId);
      const result = await ProjectsService.removeProjectMember(projectId, userId);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const activity = await ProjectsService.getProjectActivity(
        projectId,
        auth.organizationId
      );
      res.status(200).json({ data: activity });
    } catch (err) {
      next(err);
    }
  }
}
