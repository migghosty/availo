import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
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

main()
  .then(() => seedSettings())
  .catch(console.error)
  .finally(() => db.$disconnect());
