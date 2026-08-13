import { auth } from "@/lib/auth";
import { cancelBooking } from "@/lib/cancellation";
import { getOrigin } from "@/lib/siteUrl";

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

  // "admin" here is what makes the client get told, rather than the admin
  // texting themselves about their own action.
  const result = await cancelBooking({ id: bookingId }, "admin", {
    origin: await getOrigin(),
  });

  if (!result.ok) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
