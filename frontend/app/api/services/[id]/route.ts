import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseDurationMinutes, parsePriceCents } from "@/lib/service";
import { NextRequest } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = Number(id);

  const existing = await db.service.findUnique({ where: { id: serviceId } });
  if (!existing) return Response.json({ error: "Service not found" }, { status: 404 });

  const body = await req.json();

  // Archive and restore reuse this endpoint: a body carrying only `isActive`
  // flips the flag and leaves the rest of the service untouched.
  if (
    body.name === undefined &&
    body.price === undefined &&
    body.durationMinutes === undefined &&
    typeof body.isActive === "boolean"
  ) {
    const service = await db.service.update({
      where: { id: serviceId },
      data: { isActive: body.isActive },
    });
    return Response.json(service);
  }

  const trimmedName = String(body.name ?? "").trim();
  if (!trimmedName) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const priceCents = parsePriceCents(body.price);
  if (priceCents === null) {
    return Response.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const duration = parseDurationMinutes(body.durationMinutes);
  if (duration === null) {
    return Response.json(
      { error: "Length must be a whole number of minutes between 5 and 480" },
      { status: 400 }
    );
  }

  const service = await db.service.update({
    where: { id: serviceId },
    data: {
      name: trimmedName,
      emoji: String(body.emoji ?? "").trim(),
      priceCents,
      durationMinutes: duration,
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    },
  });

  return Response.json(service);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = Number(id);

  const existing = await db.service.findUnique({ where: { id: serviceId } });
  if (!existing) return Response.json({ error: "Service not found" }, { status: 404 });

  // Bookings snapshot the name and price but still point at the row, and past
  // appointments are records worth keeping. Archiving is the way to retire a
  // service that has any history. (The FK is ON DELETE RESTRICT, so this is a
  // friendlier version of an error the database would raise anyway.)
  const bookingCount = await db.booking.count({ where: { serviceId } });
  if (bookingCount > 0) {
    return Response.json(
      {
        error: `"${existing.name}" has ${bookingCount} booking${
          bookingCount === 1 ? "" : "s"
        }. Archive it instead — it will disappear for clients but keep its history.`,
      },
      { status: 409 }
    );
  }

  await db.service.delete({ where: { id: serviceId } });
  return Response.json({ success: true });
}
