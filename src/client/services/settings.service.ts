import type { AppSettingsDto } from "../../shared/types/api";
import type { SettingsFormValues } from "../types/forms";
import { apiRequest } from "../lib/api";

export const settingsService = {
  get(): Promise<AppSettingsDto> {
    return apiRequest<{ settings: AppSettingsDto }>("/settings").then(
      (result) => result.settings,
    );
  },

  update(input: SettingsFormValues): Promise<AppSettingsDto> {
    return apiRequest<{ settings: AppSettingsDto }>("/settings", {
      method: "PATCH",
      body: input,
    }).then((result) => result.settings);
  },
};
