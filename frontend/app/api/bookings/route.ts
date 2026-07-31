import { db } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { slotId, clientName, clientEmail } = await req.json();

  if (!slotId || !clientName?.trim() || !clientEmail?.trim()) {
    return Response.json({ error: "slotId, clientName, and clientEmail are required" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  let booking;
  try {
    await db.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({
        where: { id: Number(slotId) },
        include: { booking: true },
      });

      if (!slot || !slot.isAvailable || slot.booking) {
        throw new Error("SLOT_UNAVAILABLE");
      }

      const cancelToken = crypto.randomUUID();

      booking = await tx.booking.create({
        data: {
          slotId: Number(slotId),
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim().toLowerCase(),
          cancelToken,
        },
      });

      await tx.slot.update({
        where: { id: Number(slotId) },
        data: { isAvailable: false },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return Response.json({ error: "Slot is no longer available" }, { status: 409 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json(booking, { status: 201 });
}
