import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllServices } from "@/lib/serviceData";
import { parseDurationMinutes, parsePriceCents } from "@/lib/service";
import { NextRequest } from "next/server";

/** Archived services included — the only consumer is the admin page. */
export async function GET() {
  return Response.json(await getAllServices());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, emoji, price, durationMinutes } = await req.json();

  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const priceCents = parsePriceCents(price);
  if (priceCents === null) {
    return Response.json({ error: "Price must be a positive number" }, { status: 400 });
  }

  const duration = parseDurationMinutes(durationMinutes);
  if (duration === null) {
    return Response.json(
      { error: "Length must be a whole number of minutes between 5 and 480" },
      { status: 400 }
    );
  }

  const service = await db.service.create({
    data: {
      name: trimmedName,
      emoji: String(emoji ?? "").trim(),
      priceCents,
      durationMinutes: duration,
    },
  });

  return Response.json(service, { status: 201 });
}
