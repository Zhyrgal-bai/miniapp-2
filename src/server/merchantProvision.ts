import type { Prisma } from "@prisma/client";
import {
  BillingPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { encryptedBotTokenRow } from "./businessBotToken.js";
import { createOwnerStaffRow } from "./businessStaffAccess.js";
import { parseFinikRegistrationFields } from "../shared/finikRegistration.js";
import { allocateUniqueBusinessSlug } from "../shared/storeSlug.js";

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
    select: { id: true, hasUsedTrial: true },
  });

  const giveTrial = !ownerUser.hasUsedTrial;
  const trialEnd = giveTrial
    ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    : null;

  const business = await tx.business.create({
    data: {
      name: params.name.trim(),
      slug,
      botToken: tokenFields.botToken,
      botTokenHash: tokenFields.botTokenHash,
      finikApiKey: useFinikPayment ? finik.finikApiKey : null,
      finikAccountId: useFinikPayment ? finik.finikAccountId : null,
      businessType:
        params.businessType === "coffee" ||
        params.businessType === "fastfood" ||
        params.businessType === "flowers"
          ? (params.businessType as any)
          : ("clothing" as any),
      isActive: giveTrial,
      isBlocked: false,
      subscriptionStatus: giveTrial
        ? SubscriptionStatus.TRIALING
        : SubscriptionStatus.EXPIRED,
      billingPlan: BillingPlan.FREE,
      trialEndsAt: trialEnd,
      subscriptionEndsAt: null,
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

  if (giveTrial) {
    await tx.user.update({
      where: { id: ownerUser.id },
      data: { hasUsedTrial: true },
    });
  }

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
