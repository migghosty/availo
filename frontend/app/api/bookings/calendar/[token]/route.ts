import { db } from "@/lib/db";
import { toCalendarEvent } from "@/lib/bookingEvent";
import { buildIcs } from "@/lib/calendar";
import { getBusinessAddress, getBusinessName } from "@/lib/settingsData";
import { getOrigin } from "@/lib/siteUrl";

/**
 * Serves a booking as a downloadable .ics file.
 *
 * This exists as a server route rather than a client-side download for one
 * reason: iOS Safari does not reliably honour `<a download>` on a `blob:` URL,
 * so the usual "generate the file in the browser" approach silently fails on
 * exactly the devices most clients use. A real URL with a real `Content-Type`
 * is what makes iOS hand the file to Calendar. Don't move this into the client.
 *
 * Public and keyed by `cancelToken`, mirroring
 * `app/api/bookings/cancel/[token]/route.ts` — the same unguessable secret the
 * client already holds, guarding the same data the cancel page already shows.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const booking = await db.booking.findUnique({ where: { cancelToken: token } });
  if (!booking) {
    return new Response("Booking not found", { status: 404 });
  }

  const [origin, address, businessName] = await Promise.all([
    getOrigin(),
    getBusinessAddress(),
    getBusinessName(),
  ]);
  const ics = buildIcs(toCalendarEvent(booking, { origin, address, businessName }));

  return new Response(ics, {
    headers: {
      // The charset matters: names outside ASCII arrive as mojibake without it.
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
      // The URL carries a secret token and the body carries a client's name, so
      // no shared or proxy cache should ever hold on to this response.
      "Cache-Control": "no-store",
    },
  });
}
