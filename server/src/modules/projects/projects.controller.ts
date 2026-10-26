import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { ProjectsService } from "./projects.service";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  joinProjectSchema,
} from "./projects.schema";
import { UnauthorizedError, NotFoundError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

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
  static async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const analytics = await ProjectsService.getProjectAnalytics(projectId, auth.organizationId);
      res.status(200).json({ data: analytics });
    } catch (err) {
      next(err);
    }
  }

  private static repoTreeCache = new Map<string, { files: string[]; expiresAt: number }>();

  static async getProjectFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const projectId = param(req.params.id);
      const query = ((req.query.q as string) || "").trim().toLowerCase();

      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId: auth.organizationId },
        select: { id: true, name: true, repositoryUrl: true, defaultBranch: true },
      });

      if (!project) throw new NotFoundError("Project not found");

      let allFiles: string[] = [];

      // Check GitHub repository
      if (project.repositoryUrl) {
        const ghMatch = project.repositoryUrl.match(/(?:github\.com\/|^)([\w.-]+)\/([\w.-]+?)(?:\.git|\/|$)/i);
        if (ghMatch) {
          const owner = ghMatch[1];
          const repo = ghMatch[2];
          const branch = project.defaultBranch || "main";
          const cacheKey = `${owner}/${repo}/${branch}`;
          const cached = ProjectsController.repoTreeCache.get(cacheKey);

          if (cached && cached.expiresAt > Date.now()) {
            allFiles = cached.files;
          } else {
            try {
              const ghRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
                { headers: { "User-Agent": "TeamFlow-App", Accept: "application/vnd.github.v3+json" } }
              );
              if (ghRes.ok) {
                const data: any = await ghRes.json();
                allFiles = (data.tree || [])
                  .filter((item: any) => item.type === "blob")
                  .map((item: any) => item.path)
                  .filter((filePath: string) => {
                    const ext = path.extname(filePath).toLowerCase();
                    return [
                      ".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".prisma",
                      ".sql", ".css", ".html", ".md", ".env.example", ".yml", ".yaml"
                    ].includes(ext);
                  });
                ProjectsController.repoTreeCache.set(cacheKey, {
                  files: allFiles,
                  expiresAt: Date.now() + 10 * 60 * 1000,
                });
              }
            } catch (err) {
              // fallback to local workspace
            }
          }
        }
      }

      // Fallback: Local workspace scan
      if (allFiles.length === 0) {
        const projectRoot = path.resolve(__dirname, "../../../../");
        const scanDir = (dir: string, baseDir: string): string[] => {
          let results: string[] = [];
          if (!fs.existsSync(dir)) return results;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const rel = path.join(baseDir, entry.name).replace(/\\/g, "/");
            if (entry.isDirectory()) {
              if (
                ["node_modules", ".git", ".next", "dist", "build", ".gemini", "coverage"].includes(entry.name)
              ) {
                continue;
              }
              results = results.concat(scanDir(path.join(dir, entry.name), rel));
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if ([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".prisma", ".sql", ".css", ".html", ".md"].includes(ext)) {
                results.push(rel);
              }
            }
          }
          return results;
        };
        allFiles = scanDir(projectRoot, "");
      }

      const filtered = query
        ? allFiles.filter((f) => f.toLowerCase().includes(query)).slice(0, 40)
        : allFiles.slice(0, 40);

      res.status(200).json({
        data: {
          files: filtered,
          total: allFiles.length,
          repositoryUrl: project.repositoryUrl,
          defaultBranch: project.defaultBranch || "main",
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
