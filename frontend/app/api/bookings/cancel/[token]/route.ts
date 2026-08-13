import { cancelBooking } from "@/lib/cancellation";
import { getOrigin } from "@/lib/siteUrl";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Origin is resolved here and passed down: getOrigin() reads request headers,
  // so it can only be called at the edge of a request.
  const result = await cancelBooking({ cancelToken: token }, "client", {
    origin: await getOrigin(),
  });

  if (!result.ok) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
