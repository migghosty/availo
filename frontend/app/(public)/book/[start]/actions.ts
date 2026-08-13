"use server";

import { createBooking } from "@/lib/booking";
import { getOrigin } from "@/lib/siteUrl";
import { redirect } from "next/navigation";

export async function bookSlotAction(
  startMs: number,
  serviceId: number,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const result = await createBooking({
    start: new Date(startMs),
    serviceId,
    clientName: (formData.get("clientName") as string) ?? "",
    clientPhone: (formData.get("clientPhone") as string) ?? "",
    // An unchecked box submits nothing at all; "on" is what a ticked one sends.
    smsConsent: formData.get("smsConsent") === "on",
    // Resolved at the request edge — getOrigin() reads headers.
    origin: await getOrigin(),
  });

  if (!result.ok) return result.message;

  redirect(`/booking/confirmed?token=${result.cancelToken}`);
}
