import { z } from "zod";
import { ROLES } from "../../shared/types/roles";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkPasswordPolicy,
} from "../../shared/constants/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))
  .pipe(z.string().max(254, "Email is too long."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  .superRefine((password, ctx) => {
    const result = checkPasswordPolicy(password);
    if (!result.valid) {
      for (const message of result.errors) {
        ctx.addIssue({ code: "custom", message });
      }
    }
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters.")
  .max(120, "Name is too long.");

export const roleSchema = z.enum(ROLES);

export const assignableRoleSchema = z.enum(["admin", "employee"]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.uuid("Invalid identifier."),
});
