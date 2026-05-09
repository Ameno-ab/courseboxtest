import { getDb } from "@/lib/db";
import type { Candidate } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const flexibleString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().min(1));

const payloadSchema = z
  .object({
    eventId: flexibleString,
    type: z.string().min(1),
    candidateEmail: z.string().email().optional(),
    courseboxUserId: flexibleString.optional(),
    courseExternalId: flexibleString.optional(),
    courseboxCourseId: flexibleString.optional(),
    status: z.enum(["in_progress", "completed"]).default("completed"),
    score: z.union([z.number(), z.string()])
      .transform((v) => (typeof v === "string" ? Number(v) : v))
      .pipe(z.number().finite())
      .optional(),
    completedAt: z.string().optional(),
  })
  .refine((v) => v.candidateEmail || v.courseboxUserId, {
    message: "Either candidateEmail or courseboxUserId is required.",
  })
  .refine((v) => v.courseExternalId || v.courseboxCourseId, {
    message: "Either courseExternalId or courseboxCourseId is required.",
  });

function authorized(request: NextRequest): boolean {
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const incoming = request.headers.get("x-zapier-secret");
  return incoming === secret;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const body = payloadSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: body.error.issues },
      { status: 400 },
    );
  }

  const db = await getDb();
  const payload = body.data;

  const existingEvent = await db
    .collection("integrationEvents")
    .findOne({ provider: "zapier", eventId: payload.eventId });

  if (existingEvent) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const courseQuery = payload.courseboxCourseId
    ? { courseboxCourseId: payload.courseboxCourseId }
    : { externalId: payload.courseExternalId! };
  const course = await db.collection("courses").findOne(courseQuery);

  if (!course) {
    await db.collection("integrationEvents").insertOne({
      provider: "zapier",
      eventId: payload.eventId,
      type: payload.type,
      payload,
      status: "ignored",
      receivedAt: new Date(),
      processedAt: new Date(),
    });

    return NextResponse.json({ ok: true, ignored: "course_not_found" });
  }

  let candidateId: ObjectId | null = null;

  if (payload.courseboxUserId) {
    const byUserId = await db
      .collection<Candidate>("candidates")
      .findOne({ courseboxUserId: payload.courseboxUserId });
    if (byUserId?._id) candidateId = byUserId._id as ObjectId;
  }

  if (!candidateId && payload.candidateEmail) {
    const byEmail = await db
      .collection<Candidate>("candidates")
      .findOne({ email: payload.candidateEmail.toLowerCase() });

    if (byEmail?._id) {
      candidateId = byEmail._id as ObjectId;
      // Capture Coursebox user id for next time so future events can match by id even if emails diverge.
      if (payload.courseboxUserId && !byEmail.courseboxUserId) {
        await db.collection<Candidate>("candidates").updateOne(
          { _id: byEmail._id },
          { $set: { courseboxUserId: payload.courseboxUserId, updatedAt: new Date() } },
        );
      }
    }
  }

  if (!candidateId) {
    await db.collection("integrationEvents").insertOne({
      provider: "zapier",
      eventId: payload.eventId,
      type: payload.type,
      payload,
      status: "ignored",
      receivedAt: new Date(),
      processedAt: new Date(),
    });

    return NextResponse.json({ ok: true, ignored: "candidate_not_found" });
  }

  const now = new Date();

  await db.collection("enrollments").updateOne(
    {
      candidateId,
      courseId: course._id as ObjectId,
    },
    {
      $set: {
        status: payload.status,
        source: "zapier",
        score: payload.score,
        completedAt:
          payload.status === "completed"
            ? payload.completedAt
              ? new Date(payload.completedAt)
              : now
            : undefined,
        updatedAt: now,
      },
      $setOnInsert: {
        candidateId,
        courseId: course._id as ObjectId,
        externalCourseId: course.externalId,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  let acquiredSkills: string[] = [];
  if (payload.status === "completed" && Array.isArray(course.skills) && course.skills.length) {
    acquiredSkills = course.skills.map((s: string) => s.toLowerCase());
    await db.collection<Candidate>("candidates").updateOne(
      { _id: candidateId },
      {
        $pull: { missingSkills: { $in: acquiredSkills } },
        $set: { updatedAt: now },
      },
    );
  }

  await db.collection("integrationEvents").insertOne({
    provider: "zapier",
    eventId: payload.eventId,
    type: payload.type,
    payload,
    status: "processed",
    receivedAt: now,
    processedAt: now,
  });

  return NextResponse.json({
    ok: true,
    enrollment: { status: payload.status },
    acquiredSkills,
  });
}
