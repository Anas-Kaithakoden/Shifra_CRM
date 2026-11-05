import { z } from "zod";
import {
  emailSchema,
  fullNameSchema,
  passwordSchema,
} from "./common.schema";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "The new password must be different from the current password.",
    path: ["newPassword"],
  });

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
