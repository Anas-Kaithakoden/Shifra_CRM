import { z } from "zod";

const optionalEmail = z.union([
  z.literal(""),
  z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
]);

const optionalUrl = z.union([
  z.literal(""),
  z.string().trim().pipe(z.url("Enter a valid URL.")),
]);

export const updateSettingsSchema = z
  .object({
    companyName: z.string().trim().min(1).max(120),
    companyEmail: optionalEmail,
    companyPhone: z.string().trim().max(40),
    companyWebsite: optionalUrl,
    timezone: z.string().trim().min(1).max(80),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.")),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one setting to update.",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
