import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeWindows, type TimeWindow } from "@/lib/schedule";
import { NextRequest } from "next/server";

/** Weekly schedule as a map of dayOfWeek -> open windows. */
export async function GET() {
  const rules = await db.scheduleRule.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });
  return Response.json(rules);
}

type DayPayload = { dayOfWeek: number; windows: TimeWindow[] };

/**
 * Replaces the whole weekly schedule in one shot. The admin edits the week as a
 * single form, so a wholesale replace avoids diffing rules client-side and
 * keeps the saved state exactly what was on screen.
 */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const days: DayPayload[] = body?.days;

  if (!Array.isArray(days)) {
    return Response.json({ error: "days must be an array" }, { status: 400 });
  }

  const toCreate: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [];

  for (const day of days) {
    const dayOfWeek = Number(day?.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return Response.json({ error: "Invalid day of week" }, { status: 400 });
    }

    const windows = Array.isArray(day.windows) ? day.windows : [];
    const normalized = normalizeWindows(
      windows.map((w) => ({
        startMinute: Number(w?.startMinute),
        endMinute: Number(w?.endMinute),
      }))
    );

    if (!normalized.ok) {
      return Response.json({ error: normalized.error }, { status: 400 });
    }

    for (const window of normalized.windows) {
      toCreate.push({ dayOfWeek, ...window });
    }
  }

  await db.$transaction(async (tx) => {
    await tx.scheduleRule.deleteMany();
    if (toCreate.length > 0) {
      await tx.scheduleRule.createMany({ data: toCreate });
    }
  });

  const rules = await db.scheduleRule.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
  });

  return Response.json(rules);
}
