import { getDb } from "@/lib/db";
import type { Candidate } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const candidates = await db
    .collection<Candidate>("candidates")
    .find({}, { projection: { name: 1, email: 1, missingSkills: 1, courseboxUserId: 1 } })
    .sort({ name: 1 })
    .toArray();

  return NextResponse.json(
    {
      candidates: candidates.map((candidate) => ({
        id: String(candidate._id),
        name: candidate.name,
        email: candidate.email,
        missingSkills: candidate.missingSkills ?? [],
        courseboxUserId: candidate.courseboxUserId ?? "",
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  missingSkills: z.array(z.string().min(1).max(80)).max(50),
  courseboxUserId: z
    .string()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function POST(request: NextRequest) {
  const body = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid body.", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date();
  const missingSkills = Array.from(
    new Set(body.data.missingSkills.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  );

  const db = await getDb();

  if (body.data.id) {
    if (!ObjectId.isValid(body.data.id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    const result = await db.collection<Candidate>("candidates").findOneAndUpdate(
      { _id: new ObjectId(body.data.id) },
      {
        $set: {
          name: body.data.name,
          email: body.data.email.toLowerCase(),
          missingSkills,
          courseboxUserId: body.data.courseboxUserId,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }
    return NextResponse.json(
      { id: String(result._id) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const existing = await db
    .collection<Candidate>("candidates")
    .findOne({ email: body.data.email.toLowerCase() });
  if (existing) {
    return NextResponse.json(
      { error: "A candidate with that email already exists." },
      { status: 409 },
    );
  }

  const insert = await db.collection<Candidate>("candidates").insertOne({
    name: body.data.name,
    email: body.data.email.toLowerCase(),
    missingSkills,
    courseboxUserId: body.data.courseboxUserId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { id: String(insert.insertedId) },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
