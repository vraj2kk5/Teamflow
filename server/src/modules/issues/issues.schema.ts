import { z } from "zod";
import { IssueType, IssueStatus, Priority } from "@prisma/client";

export const createIssueSchema = z.object({
  projectId: z.string().cuid("Invalid project ID"),
  type: z.nativeEnum(IssueType),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().trim().min(5, "Description must be at least 5 characters"),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0, "Estimated hours cannot be negative").max(1000).nullable().optional(),

  // Bug-specific fields
  stepsToReproduce: z.string().trim().nullable().optional(),
  expectedResult: z.string().trim().nullable().optional(),
  actualResult: z.string().trim().nullable().optional(),
  errorLog: z.string().trim().max(25000, "Error log exceeds maximum length").nullable().optional(),
  filePath: z.string().trim().max(500).nullable().optional(),
  lineNumber: z.number().int().min(1).nullable().optional(),
  codeSnippet: z.string().trim().max(50000).nullable().optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200).optional(),
  description: z.string().trim().min(5).optional(),
  status: z.nativeEnum(IssueStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).nullable().optional(),
  resolutionNotes: z.string().trim().nullable().optional(),

  // Bug-specific fields
  stepsToReproduce: z.string().trim().nullable().optional(),
  expectedResult: z.string().trim().nullable().optional(),
  actualResult: z.string().trim().nullable().optional(),
  errorLog: z.string().trim().max(25000).nullable().optional(),
  filePath: z.string().trim().max(500).nullable().optional(),
  lineNumber: z.number().int().min(1).nullable().optional(),
  codeSnippet: z.string().trim().max(50000).nullable().optional(),
});

export const updateIssueStatusSchema = z.object({
  status: z.nativeEnum(IssueStatus),
  resolutionNotes: z.string().trim().nullable().optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
