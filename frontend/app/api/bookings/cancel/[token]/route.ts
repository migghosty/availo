import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const booking = await db.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

  // Deleting is all that's needed — the time becomes available again on its own,
  // since availability is computed from the schedule minus existing bookings.
  await db.booking.delete({ where: { cancelToken: token } });

  return Response.json({ success: true });
}
