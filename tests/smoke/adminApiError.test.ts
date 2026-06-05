import { describe, expect, it } from "vitest";
import {
  formatAdminApiError,
  formatHttpStatusError,
  TELEGRAM_SESSION_RU,
} from "../../frontend/src/utils/adminApiError.ts";

describe("admin API error formatting", () => {
  it("maps telegram 401 to session message", () => {
    expect(
      formatHttpStatusError(401, "Недействительные данные авторизации Telegram"),
    ).toBe(TELEGRAM_SESSION_RU);
  });

  it("translates non-telegram 401 legacy english", () => {
    expect(formatHttpStatusError(401, "Invalid operator password")).toBe(
      "Неверный пароль оператора",
    );
  });

  it("maps legacy english backend strings", () => {
    expect(formatHttpStatusError(500, "Server error")).toMatch(/временно недоступен/i);
    expect(formatHttpStatusError(404, "Not found")).toBe("Не найдено");
  });

  it("keeps short backend RU messages", () => {
    expect(formatHttpStatusError(400, "Есть неизвестные поля")).toBe(
      "Есть неизвестные поля",
    );
  });

  it("formats fetch Error with telegram hint", () => {
    expect(
      formatAdminApiError(new Error("Request failed with status code 401")),
    ).toBe(TELEGRAM_SESSION_RU);
  });

  it("sanitizes technical store-settings validation messages", () => {
    expect(
      formatHttpStatusError(
        400,
        "Укажите storeName, адрес, deliverySettings, finikApiKey, finikAccountId, newBotToken и/или merchantConfig",
      ),
    ).toBe("Не удалось сохранить настройки. Проверьте обязательные поля.");
    expect(
      formatHttpStatusError(400, "Укажите finikApiKey, finikAccountId и/или finikSecret"),
    ).toBe("Укажите API Key и Account ID Finik или очистите поля для отключения.");
    expect(formatHttpStatusError(400, "deliverySettings: ожидается объект")).toBe(
      "Некорректные настройки доставки.",
    );
    expect(formatHttpStatusError(400, "Магазин без businessType")).toBe(
      "Не удалось сохранить настройки. Проверьте обязательные поля.",
    );
  });
});
