import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

function parsePriceCents(price: unknown): number | null {
  const dollars = Number(price);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

export async function GET() {
  const services = await db.service.findMany({ orderBy: { id: "asc" } });
  return Response.json(services);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, emoji, price } = await req.json();

  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const priceCents = parsePriceCents(price);
  if (priceCents === null) {
    return Response.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const service = await db.service.create({
    data: {
      name: trimmedName,
      emoji: String(emoji ?? "").trim(),
      priceCents,
    },
  });

  return Response.json(service, { status: 201 });
}
