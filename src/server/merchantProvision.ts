import type { Prisma } from "@prisma/client";
import {
  BillingPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { encryptedBotTokenRow } from "./businessBotToken.js";
import { createOwnerStaffRow } from "./businessStaffAccess.js";
import { parseFinikRegistrationFields } from "../shared/finikRegistration.js";
import { allocateUniqueBusinessSlug } from "../shared/storeSlug.js";
import { normalizeProvisionBusinessType } from "../shared/businessTypes.js";
import { resolveFreeOrdersLimit } from "../shared/freeUsageModel.js";

function normalizeStoreName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export type ProvisionMerchantStoreParams = {
  name: string;
  botToken: string;
  telegramId: string;
  finikApiKey?: string | null;
  finikAccountId?: string | null;
  businessType?: string;
  addressLine?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/** Business + Settings + OWNER после approve заявки (бот или platform). */
export async function provisionMerchantStoreInTx(
  tx: Prisma.TransactionClient,
  params: ProvisionMerchantStoreParams,
): Promise<number> {
  const slug = await allocateUniqueBusinessSlug(tx, params.name);
  const botTok = params.botToken.trim();
  const tokenFields = encryptedBotTokenRow(botTok);
  const finik = parseFinikRegistrationFields({
    finikApiKey: params.finikApiKey ?? null,
    finikAccountId: params.finikAccountId ?? null,
  });
  const useFinikPayment =
    finik.ok && !finik.skip;

  const ownerUser = await tx.user.upsert({
    where: { telegramId: params.telegramId },
    update: { name: normalizeStoreName(params.name) },
    create: {
      telegramId: params.telegramId,
      name: normalizeStoreName(params.name),
    },
    select: { id: true },
  });

  const freeLimit = resolveFreeOrdersLimit(null);

  const business = await tx.business.create({
    data: {
      name: params.name.trim(),
      slug,
      botToken: tokenFields.botToken,
      botTokenHash: tokenFields.botTokenHash,
      finikApiKey:
        useFinikPayment && finik.finikApiKey != null ? finik.finikApiKey : null,
      finikAccountId: useFinikPayment ? finik.finikAccountId : null,
      businessType: normalizeProvisionBusinessType(params.businessType) as any,
      isActive: true,
      isBlocked: false,
      subscriptionStatus: SubscriptionStatus.FREE,
      billingPlan: BillingPlan.FREE,
      trialEndsAt: null,
      subscriptionEndsAt: null,
      freeOrdersUsed: 0,
      freeOrdersLimit: freeLimit,
      quotaExhaustedAt: null,
      addressLine: params.addressLine?.trim() || null,
      city: params.city?.trim() || null,
      latitude:
        params.latitude != null && Number.isFinite(params.latitude)
          ? params.latitude
          : null,
      longitude:
        params.longitude != null && Number.isFinite(params.longitude)
          ? params.longitude
          : null,
    } as any,
  });

  await tx.settings.create({
    data: {
      businessId: business.id,
      paymentProvider: useFinikPayment ? "finik" : null,
    },
  });

  await createOwnerStaffRow(tx, {
    businessId: business.id,
    userId: ownerUser.id,
  });

  return business.id;
}
