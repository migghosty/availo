"use server";

import { createBooking } from "@/lib/booking";
import { redirect } from "next/navigation";

export async function bookSlotAction(
  startMs: number,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const result = await createBooking({
    start: new Date(startMs),
    clientName: (formData.get("clientName") as string) ?? "",
    clientEmail: (formData.get("clientEmail") as string) ?? "",
  });

  if (!result.ok) return result.message;

  redirect(`/booking/confirmed?token=${result.cancelToken}`);
}
