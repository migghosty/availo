import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

function parsePriceCents(price: unknown): number | null {
  const dollars = Number(price);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = Number(id);

  const { name, emoji, price } = await req.json();

  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const priceCents = parsePriceCents(price);
  if (priceCents === null) {
    return Response.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const existing = await db.service.findUnique({ where: { id: serviceId } });
  if (!existing) return Response.json({ error: "Service not found" }, { status: 404 });

  const service = await db.service.update({
    where: { id: serviceId },
    data: {
      name: trimmedName,
      emoji: String(emoji ?? "").trim(),
      priceCents,
    },
  });

  return Response.json(service);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = Number(id);

  const existing = await db.service.findUnique({ where: { id: serviceId } });
  if (!existing) return Response.json({ error: "Service not found" }, { status: 404 });

  await db.service.delete({ where: { id: serviceId } });
  return Response.json({ success: true });
}
