import { getDb } from "@/lib/db";
import type { Course } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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
        courseboxCourseId: course.courseboxCourseId ?? "",
        updatedAt: course.updatedAt,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const upsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  skills: z.array(z.string().min(1).max(80)).max(50),
  lmsLaunchUrl: z
    .string()
    .url("lmsLaunchUrl must be a valid URL")
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  courseboxCourseId: z
    .string()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

function extractCourseboxIdFromLaunchUrl(url?: string): string | undefined {
  if (!url) return undefined;
  // Coursebox launch URLs embed the course UUID in either the path or the
  // ?link= query param: /courses/<uuid>/about
  const match = url.match(
    /\/courses\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
  );
  return match?.[1];
}

export async function POST(request: NextRequest) {
  const body = upsertSchema.safeParse(await request.json().catch(() => null));
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
  // Auto-extract Coursebox course UUID from the launch URL if not provided.
  const courseboxCourseId =
    body.data.courseboxCourseId ??
    extractCourseboxIdFromLaunchUrl(body.data.lmsLaunchUrl);

  const db = await getDb();

  if (body.data.id) {
    if (!ObjectId.isValid(body.data.id)) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    const result = await db.collection<Course>("courses").findOneAndUpdate(
      { _id: new ObjectId(body.data.id) },
      {
        $set: {
          title: body.data.title,
          description: body.data.description ?? "",
          skills,
          lmsLaunchUrl: body.data.lmsLaunchUrl,
          courseboxCourseId,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    return NextResponse.json(
      { id: String(result._id), externalId: result.externalId },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const externalId = `cbx-${crypto.randomUUID()}`;
  const insert = await db.collection<Course>("courses").insertOne({
    externalId,
    title: body.data.title,
    description: body.data.description ?? "",
    skills,
    lmsLaunchUrl: body.data.lmsLaunchUrl,
    courseboxCourseId,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(
    { id: String(insert.insertedId), externalId },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}
