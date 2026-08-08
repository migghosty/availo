import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const db = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("admin1234", 12);
  const admin = await db.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: hash },
  });
  console.log(`Seeded admin user: ${admin.username}`);
  console.log("Login: username=admin  password=admin1234");
  console.log("Change this password before going to production.");
}

async function seedSettings() {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, slotDurationMin: 30 },
  });
  console.log("Settings seeded: 30-minute slots.");
}

async function seedServices() {
  const count = await db.service.count();
  if (count > 0) return;

  await db.service.createMany({
    data: [
      { name: "Haircut", emoji: "✂️", priceCents: 2500 },
      { name: "Eyebrows", emoji: "✨", priceCents: 1000 },
      { name: "Beard", emoji: "🪒", priceCents: 2000 },
      { name: "Hair & Beard", emoji: "💈", priceCents: 4000 },
    ],
  });
  console.log("Services seeded: Haircut, Eyebrows, Beard, Hair & Beard.");
}

main()
  .then(() => seedSettings())
  .then(() => seedServices())
  .catch(console.error)
  .finally(() => db.$disconnect());
