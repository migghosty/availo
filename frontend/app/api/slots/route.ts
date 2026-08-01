import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { zonedWallTimeToUtc } from "@/lib/timezone";
import { NextRequest } from "next/server";

export async function GET() {
  const slots = await db.slot.findMany({
    where: { startTime: { gte: new Date() }, isAvailable: true },
    orderBy: { startTime: "asc" },
  });
  return Response.json(slots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { startTime, durationMinutes } = body;

  if (!startTime || !durationMinutes) {
    return Response.json({ error: "startTime and durationMinutes are required" }, { status: 400 });
  }

  const startAt = zonedWallTimeToUtc(startTime);

  if (startAt < new Date()) {
    return Response.json({ error: "Cannot create a slot in the past" }, { status: 400 });
  }

  const slot = await db.slot.create({
    data: {
      startTime: startAt,
      durationMinutes: Number(durationMinutes),
    },
  });

  return Response.json(slot, { status: 201 });
}
