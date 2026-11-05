import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AppSettingsDto } from "../src/shared/types/api";
import {
  apiRequest,
  createUser,
  expectError,
  login,
  parseData,
} from "./helpers";

describe("application settings", () => {
  it("returns defaults and lets the owner update settings with an audit trail", async () => {
    const owner = await createUser({ role: "owner" });
    const ownerAuth = await login(owner.email);

    const initial = await apiRequest("/api/settings", { auth: ownerAuth });
    expect(initial.status).toBe(200);
    const initialData = await parseData<{ settings: AppSettingsDto }>(initial);
    expect(initialData.settings.companyName).toBe("Shifra Nuha Technologies");
    expect(initialData.settings.currency).toBe("USD");

    const update = await apiRequest("/api/settings", {
      method: "PATCH",
      auth: ownerAuth,
      body: {
        companyName: "Shifra Nuha Technologies Ltd",
        companyEmail: "hello@shifranuhatech.com",
        timezone: "Africa/Nairobi",
        currency: "kes",
      },
    });
    expect(update.status).toBe(200);
    const updated = await parseData<{ settings: AppSettingsDto }>(update);
    expect(updated.settings.companyName).toBe("Shifra Nuha Technologies Ltd");
    expect(updated.settings.currency).toBe("KES");
    expect(updated.settings.timezone).toBe("Africa/Nairobi");
    expect(updated.settings.updatedAt).not.toBeNull();

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(owner.id)
      .first<{ action: string }>();
    expect(audit?.action).toBe("settings.updated");
  });

  it("rejects invalid settings values", async () => {
    const owner = await createUser({ role: "owner" });
    const ownerAuth = await login(owner.email);

    const response = await apiRequest("/api/settings", {
      method: "PATCH",
      auth: ownerAuth,
      body: { currency: "US" },
    });
    await expectError(response, 400, "validation_error");
  });
});
