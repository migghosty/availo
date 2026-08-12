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
    create: { id: 1, slotIntervalMin: 15 },
  });
  console.log("Settings seeded: start times every 15 minutes.");
}

async function seedServices() {
  const count = await db.service.count();
  if (count > 0) return;

  // Deliberately three different lengths: per-service durations are invisible
  // until two services disagree about how much of the day they take.
  await db.service.createMany({
    data: [
      { name: "Haircut", emoji: "✂️", priceCents: 2500, durationMinutes: 30 },
      { name: "Eyebrows", emoji: "✨", priceCents: 1000, durationMinutes: 15 },
      { name: "Beard", emoji: "🪒", priceCents: 2000, durationMinutes: 30 },
      { name: "Hair & Beard", emoji: "💈", priceCents: 4000, durationMinutes: 60 },
    ],
  });
  console.log("Services seeded: Haircut 30m, Eyebrows 15m, Beard 30m, Hair & Beard 60m.");
}

/** Mon/Wed/Fri 4:00 PM–10:00 PM, Tue/Thu 7:00 PM–10:00 PM. */
async function seedSchedule() {
  const count = await db.scheduleRule.count();
  if (count > 0) return;

  const HOUR = 60;
  await db.scheduleRule.createMany({
    data: [
      { dayOfWeek: 1, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
      { dayOfWeek: 3, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
      { dayOfWeek: 5, startMinute: 16 * HOUR, endMinute: 22 * HOUR },
      { dayOfWeek: 2, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
      { dayOfWeek: 4, startMinute: 19 * HOUR, endMinute: 22 * HOUR },
    ],
  });
  console.log("Schedule seeded: Mon/Wed/Fri 4–10 PM, Tue/Thu 7–10 PM.");
}

main()
  .then(() => seedSettings())
  .then(() => seedServices())
  .then(() => seedSchedule())
  .catch(console.error)
  .finally(() => db.$disconnect());
