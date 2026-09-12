"use server";

import { createBooking, createGroupBooking } from "@/lib/booking";
import { getOrigin } from "@/lib/siteUrl";
import { redirect } from "next/navigation";

export async function bookSlotAction(
  startMs: number,
  serviceIds: number[],
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const input = {
    start: new Date(startMs),
    clientName: (formData.get("clientName") as string) ?? "",
    clientPhone: (formData.get("clientPhone") as string) ?? "",
    smsConsent: formData.get("smsConsent") === "on",
    origin: await getOrigin(),
  };

  // Two spellings of the same function: `createBooking` keeps the one-person
  // signature it has always had, and both funnel into one private `bookLegs`,
  // so neither path can enforce a rule the other doesn't.
  const result =
    serviceIds.length === 1
      ? await createBooking({ ...input, serviceId: serviceIds[0] })
      : await createGroupBooking({ ...input, serviceIds });

  if (!result.ok) return result.message;

  redirect(`/booking/confirmed?token=${result.cancelToken}`);
}
