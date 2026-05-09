import { getDb } from "@/lib/db";
import type { Candidate } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().min(1),
  candidateEmail: z.string().email().optional(),
  courseExternalId: z.string().min(1),
  status: z.enum(["in_progress", "completed"]).default("completed"),
  score: z.number().optional(),
  completedAt: z.string().datetime().optional(),
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

  const course = await db
    .collection("courses")
    .findOne({ externalId: payload.courseExternalId });

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

  if (payload.candidateEmail) {
    const candidate = await db
      .collection("candidates")
      .findOne({ email: payload.candidateEmail.toLowerCase() });

    if (candidate?._id) {
      candidateId = candidate._id as ObjectId;
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
