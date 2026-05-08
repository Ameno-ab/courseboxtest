import { getDb } from "@/lib/db";
import { buildOidcInitiateLoginUrl, getLtiConfig, isLtiConfigured, missingLtiEnvVars } from "@/lib/lti";
import { createLoginSession } from "@/lib/lti-session";
import type { Candidate, Course } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const launchSchema = z.object({
  candidateId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await context.params;

  if (!ObjectId.isValid(courseId)) {
    return NextResponse.json({ error: "Invalid courseId." }, { status: 400 });
  }

  const body = launchSchema.safeParse(await request.json());

  if (!body.success || !ObjectId.isValid(body.data.candidateId)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = await getDb();

  const course = (await db
    .collection("courses")
    .findOne({ _id: new ObjectId(courseId) })) as Course | null;

  const candidate = (await db
    .collection("candidates")
    .findOne({ _id: new ObjectId(body.data.candidateId) })) as Candidate | null;

  if (!course || !candidate) {
    return NextResponse.json(
      { error: "Candidate or course not found." },
      { status: 404 },
    );
  }

  const now = new Date();

  await db.collection("enrollments").updateOne(
    { candidateId: new ObjectId(body.data.candidateId), courseId: new ObjectId(courseId) },
    {
      $set: {
        status: "in_progress",
        externalCourseId: course.externalId,
        source: "lti",
        updatedAt: now,
      },
      $setOnInsert: {
        candidateId: new ObjectId(body.data.candidateId),
        courseId: new ObjectId(courseId),
        createdAt: now,
      },
    },
    { upsert: true },
  );

  if (isLtiConfigured()) {
    const config = getLtiConfig();
    const targetLinkUri = course.lmsLaunchUrl?.trim() || config.targetLinkUri!;
    const loginHint = await createLoginSession({
      userId: String(candidate._id),
      userEmail: candidate.email,
      userName: candidate.name,
      courseExternalId: course.externalId,
      targetLinkUri,
    });
    const redirectUrl = buildOidcInitiateLoginUrl({ loginHint, targetLinkUri });

    return NextResponse.json(
      { mode: "lti_init", redirectUrl },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const embedBaseUrl = process.env.COURSEBOX_EMBED_BASE_URL?.trim();

  if (!embedBaseUrl) {
    const missing = missingLtiEnvVars();
    return NextResponse.json(
      {
        error: "No launch configuration found.",
        ltiMissing: missing,
        hint:
          missing.length > 0
            ? `LTI is partially configured. Missing on this deployment: ${missing.join(", ")}. Add them in Vercel → Settings → Environment Variables and redeploy.`
            : "Set COURSEBOX_EMBED_BASE_URL or all LTI env vars.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    mode: "direct_url",
    launchUrl: `${embedBaseUrl.replace(/\/$/, "")}/${course.externalId}`,
  });
}
