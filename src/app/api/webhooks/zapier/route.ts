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
    platformCandidateId: flexibleString.optional(),
    courseExternalId: flexibleString.optional(),
    courseboxCourseId: flexibleString.optional(),
    platformCourseExternalId: flexibleString.optional(),
    status: z.enum(["in_progress", "completed"]).default("completed"),
    score: z.union([z.number(), z.string()])
      .transform((v) => (typeof v === "string" ? Number(v) : v))
      .pipe(z.number().finite())
      .optional(),
    completedAt: z.string().optional(),
  })
  .refine(
    (v) => v.candidateEmail || v.courseboxUserId || v.platformCandidateId,
    {
      message:
        "Need one of candidateEmail / courseboxUserId / platformCandidateId.",
    },
  )
  .refine(
    (v) => v.courseExternalId || v.courseboxCourseId || v.platformCourseExternalId,
    {
      message:
        "Need one of courseExternalId / courseboxCourseId / platformCourseExternalId.",
    },
  );

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

  // Course match precedence:
  //   1. platformCourseExternalId — set by us in the LTI custom claim,
  //      strongest signal that the event is for this exact course in our DB.
  //   2. courseboxCourseId — Coursebox's own UUID, matches if we've stored it
  //      on our course (auto-extracted from the launch URL).
  //   3. courseExternalId — legacy email-style fallback.
  const courseExternalId =
    payload.platformCourseExternalId ?? payload.courseExternalId;
  const courseQuery = payload.courseboxCourseId
    ? { courseboxCourseId: payload.courseboxCourseId }
    : { externalId: courseExternalId! };
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

  // Candidate match precedence:
  //   1. platformCandidateId — our own Mongo _id passed via the LTI custom
  //      claim. Strongest signal; no email/account confusion possible.
  //   2. courseboxUserId — Coursebox's own internal user id, matches once
  //      we've stored it on the candidate.
  //   3. candidateEmail — fallback for tools that send the learner's email
  //      directly. On a successful email match we also opportunistically
  //      capture the Coursebox user id for future events.
  let candidateId: ObjectId | null = null;

  if (payload.platformCandidateId && ObjectId.isValid(payload.platformCandidateId)) {
    const byPlatformId = await db
      .collection<Candidate>("candidates")
      .findOne({ _id: new ObjectId(payload.platformCandidateId) });
    if (byPlatformId?._id) {
      candidateId = byPlatformId._id as ObjectId;
      if (payload.courseboxUserId && !byPlatformId.courseboxUserId) {
        await db.collection<Candidate>("candidates").updateOne(
          { _id: byPlatformId._id },
          { $set: { courseboxUserId: payload.courseboxUserId, updatedAt: new Date() } },
        );
      }
    }
  }

  if (!candidateId && payload.courseboxUserId) {
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
