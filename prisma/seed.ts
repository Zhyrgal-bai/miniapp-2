import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORY_TREE = [
  {
    name: "Верх",
    children: ["Худи", "Футболки", "Свитшоты"],
  },
  {
    name: "Низ",
    children: ["Штаны", "Шорты"],
  },
  {
    name: "Аксессуары",
    children: ["Кепки", "Сумки"],
  },
] as const;

async function main() {
  const owner = await prisma.user.upsert({
    where: { telegramId: "seed-owner" },
    update: {},
    create: { telegramId: "seed-owner", name: "Seed Owner" },
  });

  for (const group of CATEGORY_TREE) {
    let parent = await prisma.category.findFirst({
      where: { name: group.name, parentId: null, ownerId: owner.id },
    });
    if (!parent) {
      parent = await prisma.category.create({
        data: { name: group.name, ownerId: owner.id },
      });
    }
    for (const sub of group.children) {
      const exists = await prisma.category.findFirst({
        where: { name: sub, parentId: parent.id, ownerId: owner.id },
      });
      if (!exists) {
        await prisma.category.create({
          data: { name: sub, parentId: parent.id, ownerId: owner.id },
        });
      }
    }
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
