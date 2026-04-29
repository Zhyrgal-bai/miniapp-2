import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_NAMES = ["Верх", "Низ", "Аксессуары"] as const;

async function main() {
  const biz = await prisma.business.upsert({
    where: { botToken: "seed-bot-token-placeholder" },
    update: {},
    create: {
      name: "Seed Store",
      botToken: "seed-bot-token-placeholder",
      slug: "seed-store",
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

  await prisma.user.upsert({
    where: {
      businessId_telegramId: {
        businessId: biz.id,
        telegramId: "seed-owner",
      },
    },
    update: {},
    create: {
      telegramId: "seed-owner",
      name: "Seed Owner",
      businessId: biz.id,
      role: UserRole.ADMIN,
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
