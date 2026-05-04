import { MembershipRole, PrismaClient } from "@prisma/client";
import { encryptedBotTokenRow } from "../src/server/businessBotToken.js";

const prisma = new PrismaClient();

const CATEGORY_NAMES = ["Верх", "Низ", "Аксессуары"] as const;

const SEED_SLUG = "seed-store";
const SEED_BOT_TOKEN = "seed-bot-token-placeholder";

async function main() {
  const tok = encryptedBotTokenRow(SEED_BOT_TOKEN);
  const biz = await prisma.business.upsert({
    where: { slug: SEED_SLUG },
    update: {
      botToken: tok.botToken,
      botTokenHash: tok.botTokenHash,
    },
    create: {
      name: "Seed Store",
      botToken: tok.botToken,
      botTokenHash: tok.botTokenHash,
      slug: SEED_SLUG,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.settings.upsert({
    where: { businessId: biz.id },
    update: {},
    create: {
      businessId: biz.id,
    },
  });

  const usr = await prisma.user.upsert({
    where: { telegramId: "seed-owner" },
    update: {},
    create: {
      telegramId: "seed-owner",
      name: "Seed Owner",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_businessId: { userId: usr.id, businessId: biz.id },
    },
    update: {},
    create: {
      userId: usr.id,
      businessId: biz.id,
      role: MembershipRole.ADMIN,
    },
  });

  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: {
        businessId_name: {
          businessId: biz.id,
          name,
        },
      },
      update: {},
      create: {
        name,
        businessId: biz.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
