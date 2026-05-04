import { z } from "zod";
import { isValidBotTokenShape } from "../bot/saasRegistrationValidation.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import {
  PLATFORM_STORE_NAME_MAX,
  PLATFORM_STORE_NAME_MIN,
} from "./platformRegisterRequest.js";

export function formatZodApiError(err: z.ZodError): string {
  const first = err.issues[0]?.message?.trim();
  return first !== undefined && first !== "" ? first : "Некорректные данные";
}

export const platformRegisterRequestShape = z
  .object({
    storeName: z.string().transform((s) => cleanInput(s)).pipe(
      z
        .string()
        .min(
          PLATFORM_STORE_NAME_MIN,
          `Название магазина: от ${PLATFORM_STORE_NAME_MIN} символов`,
        )
        .max(
          PLATFORM_STORE_NAME_MAX,
          `Название магазина: до ${PLATFORM_STORE_NAME_MAX} символов`,
        ),
    ),
    botToken: z
      .string()
      .transform((s) => s.replace(/\s/g, "").trim()),
    phone: z.string(),
    telegramId: z.union([z.string(), z.number()]).optional(),
    finikApiKey: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.botToken === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите botToken",
        path: ["botToken"],
      });
      return;
    }
    if (!isValidBotTokenShape(val.botToken)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Неверный формат botToken",
        path: ["botToken"],
      });
    }
    const ph = val.phone.trim();
    if (ph === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите телефон",
        path: ["phone"],
      });
      return;
    }
    if (!validateKgPhone(ph)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Неверный номер телефона (ожидается KG: +996… или 0…)",
        path: ["phone"],
      });
    }
  });

export type PlatformRegisterZodParsed = z.infer<typeof platformRegisterRequestShape>;

export const platformCheckWebhookBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
});

export const platformToggleBotBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
  action: z.enum(["enable", "disable"]),
});
