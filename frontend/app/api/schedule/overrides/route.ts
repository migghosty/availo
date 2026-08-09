import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeWindows, type TimeWindow } from "@/lib/schedule";
import { todayInTimezone } from "@/lib/timezone";
import { NextRequest } from "next/server";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Upcoming date-specific exceptions (past ones are noise for the admin). */
export async function GET() {
  const overrides = await db.scheduleOverride.findMany({
    where: { date: { gte: todayInTimezone() } },
    include: { windows: { orderBy: { startMinute: "asc" } } },
    orderBy: { date: "asc" },
  });

  return Response.json(overrides);
}

/**
 * Creates or replaces the exception for a single date. Upsert semantics mean
 * re-saving the same date edits it rather than erroring on the unique index.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const date = String(body?.date ?? "").trim();
  const isClosed = Boolean(body?.isClosed);

  if (!DATE_KEY.test(date)) {
    return Response.json({ error: "A valid date is required" }, { status: 400 });
  }

  if (date < todayInTimezone()) {
    return Response.json({ error: "Pick a date that hasn't passed yet" }, { status: 400 });
  }

  const rawWindows: TimeWindow[] = Array.isArray(body?.windows) ? body.windows : [];
  const normalized = normalizeWindows(
    rawWindows.map((w) => ({
      startMinute: Number(w?.startMinute),
      endMinute: Number(w?.endMinute),
    }))
  );

  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  if (!isClosed && normalized.windows.length === 0) {
    return Response.json(
      { error: "Add at least one time range, or mark the day as closed." },
      { status: 400 }
    );
  }

  // A closed day has no windows, regardless of what was submitted.
  const windows = isClosed ? [] : normalized.windows;

  const override = await db.$transaction(async (tx) => {
    const existing = await tx.scheduleOverride.findUnique({ where: { date } });

    if (existing) {
      await tx.scheduleOverrideWindow.deleteMany({ where: { overrideId: existing.id } });
      return tx.scheduleOverride.update({
        where: { id: existing.id },
        data: { isClosed, windows: { create: windows } },
        include: { windows: true },
      });
    }

    return tx.scheduleOverride.create({
      data: { date, isClosed, windows: { create: windows } },
      include: { windows: true },
    });
  });

  return Response.json(override, { status: 201 });
}
