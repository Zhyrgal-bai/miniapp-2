import { prisma } from "./db.js";

const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomCode(len = 8): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export type MerchantReferralPayload = {
  code: string;
  link: string;
  signups: number;
  isPublic: boolean;
};

export async function getOrCreateMerchantReferralCode(input: {
  businessId: number;
  baseUrl: string;
}): Promise<MerchantReferralPayload> {
  const bid = input.businessId;
  let row = await prisma.merchantReferralCode.findUnique({
    where: { businessId: bid },
  });
  if (!row) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode(8);
      try {
        row = await prisma.merchantReferralCode.create({
          data: { businessId: bid, code },
        });
        break;
      } catch {
        /* collision retry */
      }
    }
  }
  if (!row) {
    throw new Error("REFERRAL_CREATE_FAILED");
  }
  const listing = await prisma.platformStoreListing.findUnique({
    where: { businessId: bid },
    select: { isPublic: true },
  });
  const base = input.baseUrl.replace(/\/$/, "");
  return {
    code: row.code,
    link: `${base}/merchant/register?ref=${encodeURIComponent(row.code)}`,
    signups: row.signups,
    isPublic: listing?.isPublic ?? false,
  };
}

export async function resolveReferrerByCode(
  code: string,
): Promise<{ businessId: number; referralCodeId: number } | null> {
  const c = code.trim().toLowerCase();
  if (c.length < 4) return null;
  const row = await prisma.merchantReferralCode.findUnique({
    where: { code: c },
    select: { id: true, businessId: true },
  });
  if (!row) return null;
  return { businessId: row.businessId, referralCodeId: row.id };
}

export async function recordReferralSignup(input: {
  code: string;
  applicantTelegramId: string;
  registrationRequestId?: number;
}): Promise<void> {
  const ref = await resolveReferrerByCode(input.code);
  if (!ref) return;
  const tid = input.applicantTelegramId.trim();
  if (!/^\d+$/.test(tid)) return;

  await prisma.merchantReferralSignup.create({
    data: {
      referralCodeId: ref.referralCodeId,
      referrerBusinessId: ref.businessId,
      applicantTelegramId: tid,
      registrationRequestId: input.registrationRequestId ?? null,
    },
  });
  await prisma.merchantReferralCode.update({
    where: { id: ref.referralCodeId },
    data: { signups: { increment: 1 } },
  });
}

export async function referralStats(businessId: number): Promise<{
  signups: number;
  code: string | null;
}> {
  const row = await prisma.merchantReferralCode.findUnique({
    where: { businessId },
    select: { signups: true, code: true },
  });
  return { signups: row?.signups ?? 0, code: row?.code ?? null };
}
