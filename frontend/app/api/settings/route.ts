import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { DEFAULT_CONFIG } from "@/lib/scheduleData";
import { NextRequest } from "next/server";

async function getOrCreateSettings() {
  return db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_CONFIG },
  });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return Response.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = await getOrCreateSettings();

  const duration =
    body.slotDurationMin === undefined
      ? current.slotDurationMin
      : Number(body.slotDurationMin);
  const interval =
    body.slotIntervalMin === undefined
      ? current.slotIntervalMin
      : Number(body.slotIntervalMin);
  const horizon =
    body.bookingHorizonDays === undefined
      ? current.bookingHorizonDays
      : Number(body.bookingHorizonDays);

  if (!duration || duration < 5 || duration > 480) {
    return Response.json(
      { error: "Appointment length must be between 5 and 480 minutes" },
      { status: 400 }
    );
  }

  if (!interval || interval < 5 || interval > 240) {
    return Response.json(
      { error: "Start-time interval must be between 5 and 240 minutes" },
      { status: 400 }
    );
  }

  if (!horizon || horizon < 1 || horizon > 365) {
    return Response.json(
      { error: "Booking window must be between 1 and 365 days" },
      { status: 400 }
    );
  }

  const settings = await db.settings.update({
    where: { id: 1 },
    data: {
      slotDurationMin: duration,
      slotIntervalMin: interval,
      bookingHorizonDays: horizon,
    },
  });

  return Response.json(settings);
}
