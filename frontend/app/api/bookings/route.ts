import { db } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { startTime, clientName, clientEmail } = await req.json();

  if (!startTime || !clientName?.trim() || !clientEmail?.trim()) {
    return Response.json(
      { error: "startTime, clientName, and clientEmail are required" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return Response.json({ error: "Invalid startTime" }, { status: 400 });
  }

  const result = await createBooking({ start, clientName, clientEmail });

  if (!result.ok) {
    const status =
      result.code === "UNAVAILABLE" ? 409 : result.code === "ERROR" ? 500 : 400;
    return Response.json({ error: result.message }, { status });
  }

  const booking = await db.booking.findUnique({
    where: { cancelToken: result.cancelToken },
  });

  return Response.json(booking, { status: 201 });
}
