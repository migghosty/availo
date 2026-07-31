import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bookingId = Number(id);

  if (isNaN(bookingId)) {
    return Response.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error("NOT_FOUND");

      await tx.booking.delete({ where: { id: bookingId } });
      await tx.slot.update({
        where: { id: booking.slotId },
        data: { isAvailable: true },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json({ success: true });
}
