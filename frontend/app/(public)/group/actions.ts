"use server";

import { redirect } from "next/navigation";
import { parseSelectionParam, serializeSelection } from "@/lib/selection";

/**
 * Turns the group picker's form into a `/slots` URL.
 *
 * Routed through `parseSelectionParam` — the same parser `/slots` and
 * `/book/[start]` use to read it back — so the picker cannot mint a selection
 * those pages would reject. A rejection here means somebody tampered with the
 * form, and the honest answer is to send them back to pick again.
 */
export async function chooseGroupAction(formData: FormData): Promise<void> {
  const ids = formData.getAll("service").map(String);
  const selection = parseSelectionParam({ services: ids.join(",") });

  if (!selection || selection.length < 2) redirect("/group");

  redirect(`/slots?${serializeSelection(selection)}`);
}
