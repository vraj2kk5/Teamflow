import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100),
  description: z.string().trim().max(1000).optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
