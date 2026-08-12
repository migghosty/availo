import { db } from "@/lib/db";
import { createBooking } from "@/lib/booking";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { startTime, serviceId, clientName, clientEmail } = await req.json();

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

  // The service decides how long the appointment is, so there's no sensible
  // default to fall back on.
  const service = Number(serviceId);
  if (!Number.isInteger(service)) {
    return Response.json({ error: "A valid serviceId is required" }, { status: 400 });
  }

  const result = await createBooking({
    start,
    serviceId: service,
    clientName,
    clientEmail,
  });

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
