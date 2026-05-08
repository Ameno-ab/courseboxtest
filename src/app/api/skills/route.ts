import { getDb } from "@/lib/db";
import type { Skill } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ");
}

export async function GET() {
  const db = await getDb();
  const skills = (await db
    .collection<Skill>("skills")
    .find({}, { projection: { _id: 0, slug: 1, label: 1 } })
    .sort({ label: 1 })
    .toArray()) as Pick<Skill, "slug" | "label">[];

  return NextResponse.json(
    { skills },
    { headers: { "cache-control": "no-store" } },
  );
}

const createSchema = z.object({
  label: z.string().min(1).max(80),
});

export async function POST(request: NextRequest) {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const slug = toSlug(body.data.label);
  if (!slug) {
    return NextResponse.json({ error: "Label cannot be empty." }, { status: 400 });
  }

  const db = await getDb();
  await db.collection<Skill>("skills").updateOne(
    { slug },
    {
      $setOnInsert: {
        slug,
        label: body.data.label.trim(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json(
    { slug, label: body.data.label.trim() },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
