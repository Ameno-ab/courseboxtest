import { getDb } from "@/lib/db";
import { scoreCourse } from "@/lib/recommendation";
import type { Candidate, Course, Enrollment, Recommendation } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const candidateId = request.nextUrl.searchParams.get("candidateId");

  if (!candidateId || !ObjectId.isValid(candidateId)) {
    return NextResponse.json({ error: "candidateId is required." }, { status: 400 });
  }

  const db = await getDb();

  const candidate = (await db
    .collection("candidates")
    .findOne({ _id: new ObjectId(candidateId) })) as Candidate | null;

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const courses = (await db.collection("courses").find().toArray()) as Course[];
  const enrollments = (await db
    .collection("enrollments")
    .find({ candidateId: new ObjectId(candidateId) })
    .toArray()) as Enrollment[];

  const enrollmentByCourseId = new Map(
    enrollments.map((enrollment) => [String(enrollment.courseId), enrollment.status]),
  );

  const recommendations: Recommendation[] = courses
    .map((course) => {
      const recommendation = scoreCourse(candidate, course);
      recommendation.enrollmentStatus =
        enrollmentByCourseId.get(String(course._id)) ?? "not_started";
      return recommendation;
    })
    .filter((recommendation) => recommendation.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return NextResponse.json(
    {
      candidate: {
        id: String(candidate._id),
        name: candidate.name,
        skills: candidate.skills,
      },
      recommendations,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
