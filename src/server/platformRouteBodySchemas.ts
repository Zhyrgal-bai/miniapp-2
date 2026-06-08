import { z } from "zod";
import { isValidBotTokenShape } from "../bot/saasRegistrationValidation.js";
import { parseFinikRegistrationFields } from "../shared/finikRegistration.js";
import { cleanInput, validateKgPhone } from "./orderInputSanitize.js";
import {
  PLATFORM_STORE_NAME_MAX,
  PLATFORM_STORE_NAME_MIN,
} from "./platformRegisterRequest.js";
import { parseBusinessAddressInput } from "../shared/businessAddress.js";

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
    finikAccountId: z.string().optional(),
    businessType: z.enum(["universal", "clothing", "coffee", "fastfood", "flowers"]),
    ownerUsername: z.string().optional(),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    latitude: z.union([z.number(), z.string()]).optional(),
    longitude: z.union([z.number(), z.string()]).optional(),
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
    const finik = parseFinikRegistrationFields({
      finikApiKey: val.finikApiKey ?? null,
      finikAccountId: val.finikAccountId ?? null,
    });
    if (!finik.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: finik.error,
        path: ["finikAccountId"],
      });
    }
    const addr = parseBusinessAddressInput({
      addressLine: val.addressLine,
      city: val.city,
      latitude: val.latitude,
      longitude: val.longitude,
    });
    if (!addr.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: addr.error,
        path: ["addressLine"],
      });
    }
  });

export type PlatformRegisterZodParsed = z.infer<typeof platformRegisterRequestShape>;

export const platformCheckWebhookBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
});

export const platformMerchantBotRecoveryBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
});

export const platformMerchantBotTokenBodySchema = z
  .object({
    businessId: z.coerce.number().int().positive(),
    newBotToken: z
      .string()
      .transform((s) => s.replace(/\s/g, "").trim())
      .pipe(z.string().min(1, "Укажите новый токен бота")),
  })
  .superRefine((val, ctx) => {
    if (!isValidBotTokenShape(val.newBotToken)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Неверный формат botToken",
        path: ["newBotToken"],
      });
    }
  });

export const platformToggleBotBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
  action: z.enum(["enable", "disable"]),
});

export const platformDeleteMyBusinessBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
});

export const platformSubscriptionPaymentBodySchema = z
  .object({
    businessId: z.coerce.number().int().positive(),
    plan: z.union([z.literal(30), z.literal(90)]).optional(),
    planCode: z
      .enum(["FIRST_MONTH", "MONTHLY", "THREE_MONTH", "HALF_YEAR", "YEARLY"])
      .optional(),
  })
  .refine((v) => v.plan != null || v.planCode != null, {
    message: "Укажите planCode или plan",
  });

export const platformSubscriptionAutoRenewBodySchema = z.object({
  businessId: z.coerce.number().int().positive(),
  enabled: z.boolean(),
});

export const platformAdminExtendBodySchema = z
  .object({
    businessId: z.coerce.number().int().positive(),
    days: z.union([
      z.literal(7),
      z.literal(30),
      z.literal(90),
      z.literal(365),
    ]).optional(),
    extendToDate: z.string().min(1).optional(),
  })
  .refine((v) => v.days != null || v.extendToDate != null, {
    message: "Укажите days или extendToDate",
  });
