import type { TelegramStatusDto } from "../../shared/types/tasks";
import { apiRequest } from "../lib/api";

export const notificationsService = {
  async getTelegramStatus(): Promise<TelegramStatusDto> {
    const data = await apiRequest<{ status: TelegramStatusDto }>(
      "/notifications/telegram/status",
    );
    return data.status;
  },

  async sendTestNotification(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(
      "/notifications/telegram/test",
      {
        method: "POST",
      },
    );
  },
};
