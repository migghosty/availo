import { db } from "@/lib/db";
import { createBooking, createGroupBooking } from "@/lib/booking";
import { MAX_GROUP_SIZE } from "@/lib/selection";
import { getOrigin } from "@/lib/siteUrl";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { startTime, serviceId, serviceIds, clientName, clientPhone, smsConsent } =
    await req.json();

  if (!startTime || !clientName?.trim() || !clientPhone?.trim()) {
    return Response.json(
      { error: "startTime, clientName, and clientPhone are required" },
      { status: 400 }
    );
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return Response.json({ error: "Invalid startTime" }, { status: 400 });
  }

  // The service decides how long the appointment is, so there's no sensible
  // default to fall back on. `serviceIds` is the group spelling: a list of
  // 2..MAX_GROUP_SIZE services seen back to back, one row written per person.
  // `serviceId` stays accepted and unchanged, so existing callers are untouched.
  const requested: unknown[] = Array.isArray(serviceIds)
    ? serviceIds
    : [serviceId];

  if (requested.length < 1 || requested.length > MAX_GROUP_SIZE) {
    return Response.json(
      { error: `Between 1 and ${MAX_GROUP_SIZE} services are required` },
      { status: 400 }
    );
  }

  const ids = requested.map(Number);
  if (ids.some((id) => !Number.isInteger(id))) {
    return Response.json({ error: "A valid serviceId is required" }, { status: 400 });
  }

  const input = {
    start,
    clientName,
    clientPhone,
    smsConsent: smsConsent === true,
    origin: await getOrigin(),
  };

  const result =
    ids.length === 1
      ? await createBooking({ ...input, serviceId: ids[0] })
      : await createGroupBooking({ ...input, serviceIds: ids });

  if (!result.ok) {
    const status =
      result.code === "UNAVAILABLE" ? 409 : result.code === "ERROR" ? 500 : 400;
    return Response.json({ error: result.message }, { status });
  }

  // A solo booking answers with the row, exactly as it always has. A group
  // answers with every row it wrote, earliest first — one object could not
  // describe three appointments without lying about one of them.
  if (result.groupId) {
    const bookings = await db.booking.findMany({
      where: { groupId: result.groupId },
      orderBy: { startTime: "asc" },
    });
    return Response.json(bookings, { status: 201 });
  }

  const booking = await db.booking.findUnique({
    where: { cancelToken: result.cancelToken },
  });

  return Response.json(booking, { status: 201 });
}
