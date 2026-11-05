import type {
  AuthUserDto,
  LoginResponse,
  MeResponse,
} from "../../shared/types/api";
import type {
  ChangePasswordFormValues,
  LoginFormValues,
} from "../types/forms";
import { apiRequest } from "../lib/api";

export const authService = {
  login(input: LoginFormValues): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: input,
    });
  },

  me(): Promise<MeResponse> {
    return apiRequest<MeResponse>("/auth/me");
  },

  logout(): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>("/auth/logout", {
      method: "POST",
    });
  },

  changePassword(
    input: ChangePasswordFormValues,
  ): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
    });
  },

  updateProfile(fullName: string): Promise<{ user: AuthUserDto }> {
    return apiRequest<{ user: AuthUserDto }>("/auth/profile", {
      method: "PATCH",
      body: { fullName },
    });
  },
};
