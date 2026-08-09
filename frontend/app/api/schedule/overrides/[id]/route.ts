import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

/** Removing an exception returns that date to the normal weekly schedule. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const overrideId = Number(id);

  if (!Number.isInteger(overrideId)) {
    return Response.json({ error: "Invalid override ID" }, { status: 400 });
  }

  const existing = await db.scheduleOverride.findUnique({ where: { id: overrideId } });
  if (!existing) return Response.json({ error: "Override not found" }, { status: 404 });

  await db.scheduleOverride.delete({ where: { id: overrideId } });
  return Response.json({ success: true });
}
