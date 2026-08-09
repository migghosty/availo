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

  if (!Number.isInteger(bookingId)) {
    return Response.json({ error: "Invalid booking ID" }, { status: 400 });
  }

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

  await db.booking.delete({ where: { id: bookingId } });

  return Response.json({ success: true });
}
