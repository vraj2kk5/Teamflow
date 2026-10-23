import { Router } from "express";
import { ProjectsController } from "./projects.controller";
import { requireAuth, requireOrgRole } from "../../middleware/auth.middleware";
import { requireProjectAccess, canManageProject } from "../../middleware/policies";
import { Role } from "@prisma/client";

const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get("/", ProjectsController.getProjects);
projectsRouter.post(
  "/",
  requireOrgRole(Role.ADMIN, Role.PROJECT_MANAGER),
  ProjectsController.createProject
);
projectsRouter.post("/join", ProjectsController.joinProject);

projectsRouter.get("/:id", requireProjectAccess, ProjectsController.getProject);
projectsRouter.patch(
  "/:id",
  requireProjectAccess,
  canManageProject,
  ProjectsController.updateProject
);
projectsRouter.delete(
  "/:id",
  requireProjectAccess,
  canManageProject,
  ProjectsController.deleteProject
);

projectsRouter.post(
  "/:id/regenerate-invite-code",
  requireProjectAccess,
  canManageProject,
  ProjectsController.regenerateInviteCode
);

projectsRouter.post(
  "/:id/members",
  requireProjectAccess,
  canManageProject,
  ProjectsController.addMember
);
projectsRouter.delete(
  "/:id/members/:userId",
  requireProjectAccess,
  canManageProject,
  ProjectsController.removeMember
);

projectsRouter.get(
  "/:id/activity",
  requireProjectAccess,
  ProjectsController.getActivity
);

export { projectsRouter };
