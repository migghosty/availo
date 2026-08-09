"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function cancelBookingAction(
  cancelToken: string
): Promise<string | null> {
  try {
    // Deleting frees the time on its own — availability is computed from the
    // schedule minus existing bookings, so there's no slot to flip back.
    await db.booking.delete({ where: { cancelToken } });
  } catch {
    return "Booking not found or already cancelled.";
  }

  redirect("/booking/cancelled");
}
