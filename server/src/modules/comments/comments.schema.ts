import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(10000),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(10000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
