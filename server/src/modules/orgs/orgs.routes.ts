import { Router } from "express";
import { OrgsController } from "./orgs.controller";
import { requireAuth, requireOrgRole } from "../../middleware/auth.middleware";
import { Role } from "@prisma/client";

const orgsRouter = Router();

orgsRouter.use(requireAuth);

orgsRouter.get("/current", OrgsController.getCurrent);
orgsRouter.patch("/:id", requireOrgRole(Role.ADMIN), OrgsController.update);
orgsRouter.get("/:id/members", OrgsController.getMembers);
orgsRouter.post(
  "/:id/members",
  requireOrgRole(Role.ADMIN, Role.PROJECT_MANAGER),
  OrgsController.addMember
);
orgsRouter.patch(
  "/:id/members/:userId",
  requireOrgRole(Role.ADMIN),
  OrgsController.updateMemberRole
);
orgsRouter.delete(
  "/:id/members/:userId",
  requireOrgRole(Role.ADMIN),
  OrgsController.removeMember
);
orgsRouter.post(
  "/:id/invite-code/rotate",
  requireOrgRole(Role.ADMIN),
  OrgsController.rotateInviteCode
);

export { orgsRouter };
