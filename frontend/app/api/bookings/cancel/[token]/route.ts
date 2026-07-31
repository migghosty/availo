import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { cancelToken: token } });
      if (!booking) throw new Error("NOT_FOUND");

      await tx.booking.delete({ where: { cancelToken: token } });
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
