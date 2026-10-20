import { z } from "zod";
import { Role } from "@prisma/client";

export const updateOrgSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  role: z.nativeEnum(Role).default(Role.MEMBER),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
