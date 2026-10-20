import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
