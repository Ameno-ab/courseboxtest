import { getDb } from "@/lib/db";
import type { Course } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const courses = (await db
    .collection<Course>("courses")
    .find({})
    .sort({ updatedAt: -1 })
    .toArray()) as Course[];

  return NextResponse.json(
    {
      courses: courses.map((course) => ({
        id: String(course._id),
        externalId: course.externalId,
        title: course.title,
        description: course.description ?? "",
        skills: course.skills ?? [],
        lmsLaunchUrl: course.lmsLaunchUrl ?? "",
        updatedAt: course.updatedAt,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const createSchema = z.object({
  externalId: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skills: z.array(z.string().min(1).max(80)).max(50),
  lmsLaunchUrl: z
    .string()
    .url("lmsLaunchUrl must be a valid URL")
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function POST(request: NextRequest) {
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid body.", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date();
  const skills = Array.from(
    new Set(body.data.skills.map((s) => s.trim().toLowerCase()).filter(Boolean)),
  );

  const db = await getDb();
  const result = await db.collection<Course>("courses").findOneAndUpdate(
    { externalId: body.data.externalId },
    {
      $set: {
        title: body.data.title,
        description: body.data.description ?? "",
        skills,
        lmsLaunchUrl: body.data.lmsLaunchUrl,
        updatedAt: now,
      },
      $setOnInsert: {
        externalId: body.data.externalId,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return NextResponse.json(
    {
      id: result ? String(result._id) : null,
      externalId: body.data.externalId,
    },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
