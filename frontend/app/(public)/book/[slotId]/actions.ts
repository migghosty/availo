"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function bookSlotAction(
  slotId: number,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const clientName = (formData.get("clientName") as string)?.trim();
  const clientEmail = (formData.get("clientEmail") as string)?.trim().toLowerCase();

  if (!clientName || clientName.length < 2) return "Please enter your full name (at least 2 characters).";
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return "A valid email address is required.";
  }

  let cancelToken = "";

  try {
    await db.$transaction(async (tx) => {
      const slot = await tx.slot.findUnique({
        where: { id: slotId },
        include: { booking: true },
      });

      if (!slot) throw new Error("SLOT_UNAVAILABLE");
      if (new Date(slot.startTime) < new Date()) throw new Error("SLOT_EXPIRED");
      if (!slot.isAvailable || slot.booking) throw new Error("SLOT_UNAVAILABLE");

      cancelToken = crypto.randomUUID();

      await tx.booking.create({
        data: { slotId, clientName, clientEmail, cancelToken },
      });

      await tx.slot.update({
        where: { id: slotId },
        data: { isAvailable: false },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_EXPIRED") {
      return "This slot has already passed and can no longer be booked.";
    }
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return "Sorry, this slot was just taken. Please choose another.";
    }
    return "Something went wrong. Please try again.";
  }

  redirect(`/booking/confirmed?token=${cancelToken}`);
}
