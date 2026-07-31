import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

async function getOrCreateSettings() {
  return db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, slotDurationMin: 30 },
  });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return Response.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slotDurationMin } = await req.json();
  const duration = Number(slotDurationMin);

  if (!duration || duration < 5 || duration > 480) {
    return Response.json({ error: "Duration must be between 5 and 480 minutes" }, { status: 400 });
  }

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: { slotDurationMin: duration },
    create: { id: 1, slotDurationMin: duration },
  });

  return Response.json(settings);
}
