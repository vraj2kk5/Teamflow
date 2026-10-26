import { z } from "zod";
import { ProjectStatus } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100),
  description: z.string().trim().max(1000).optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
  webhookUrl: z.string().url("Invalid Webhook URL").optional().nullable().or(z.literal("")),
  repositoryUrl: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  defaultBranch: z.string().trim().max(100).optional().nullable().or(z.literal("")),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  webhookUrl: z.string().url("Invalid Webhook URL").optional().nullable().or(z.literal("")),
  repositoryUrl: z.string().trim().max(300).optional().nullable().or(z.literal("")),
  defaultBranch: z.string().trim().max(100).optional().nullable().or(z.literal("")),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

export const joinProjectSchema = z.object({
  inviteCode: z.string().trim().min(3, "Invalid project invite code").max(32),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type JoinProjectInput = z.infer<typeof joinProjectSchema>;
