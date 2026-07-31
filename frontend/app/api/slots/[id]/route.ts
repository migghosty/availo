import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const slotId = Number(id);

  const slot = await db.slot.findUnique({
    where: { id: slotId },
    include: { booking: true },
  });

  if (!slot) return Response.json({ error: "Slot not found" }, { status: 404 });
  if (slot.booking) return Response.json({ error: "Cannot delete a booked slot" }, { status: 409 });

  await db.slot.delete({ where: { id: slotId } });
  return Response.json({ success: true });
}
