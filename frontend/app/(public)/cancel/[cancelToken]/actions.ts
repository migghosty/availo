"use server";

import { cancelBooking } from "@/lib/cancellation";
import { getOrigin } from "@/lib/siteUrl";
import { redirect } from "next/navigation";

export async function cancelBookingAction(
  cancelToken: string
): Promise<string | null> {
  const result = await cancelBooking({ cancelToken }, "client", {
    origin: await getOrigin(),
  });

  if (!result.ok) {
    return "Booking not found or already cancelled.";
  }

  redirect("/booking/cancelled");
}
