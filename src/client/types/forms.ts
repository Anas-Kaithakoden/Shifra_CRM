export type AssignableRole = "admin" | "employee";

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface CreateEmployeeFormValues {
  fullName: string;
  email: string;
  password: string;
  role: AssignableRole;
}

export interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileFormValues {
  fullName: string;
}

export interface SettingsFormValues {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  timezone: string;
  currency: string;
}
