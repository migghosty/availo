"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function cancelBookingAction(
  cancelToken: string,
  _prevState: string | null
): Promise<string | null> {
  try {
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { cancelToken },
      });

      if (!booking) throw new Error("NOT_FOUND");

      await tx.booking.delete({ where: { cancelToken } });
      await tx.slot.update({
        where: { id: booking.slotId },
        data: { isAvailable: true },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return "Booking not found or already cancelled.";
    }
    return "Something went wrong. Please try again.";
  }

  redirect("/booking/cancelled");
}
