import { z } from "zod";
import {
  assignableRoleSchema,
  emailSchema,
  fullNameSchema,
  passwordSchema,
  roleSchema,
} from "./common.schema";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: roleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const createUserSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: assignableRoleSchema.default("employee"),
});

export const updateUserSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    role: assignableRoleSchema.optional(),
  })
  .refine((data) => data.fullName !== undefined || data.role !== undefined, {
    message: "Provide at least one field to update.",
  });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
