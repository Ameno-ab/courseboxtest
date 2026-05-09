import { getDb } from "@/lib/db";
import type { Candidate, Course, Enrollment } from "@/lib/types";
import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ candidateId: string }> },
) {
  const { candidateId } = await context.params;
  if (!ObjectId.isValid(candidateId)) {
    return NextResponse.json({ error: "Invalid candidateId." }, { status: 400 });
  }

  const db = await getDb();
  const candidate = (await db
    .collection<Candidate>("candidates")
    .findOne({ _id: new ObjectId(candidateId) })) as Candidate | null;

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const enrollments = (await db
    .collection<Enrollment>("enrollments")
    .find({ candidateId: new ObjectId(candidateId) })
    .sort({ updatedAt: -1 })
    .toArray()) as Enrollment[];

  const courseIds = enrollments.map((e) => e.courseId);
  const courses = courseIds.length
    ? ((await db
        .collection<Course>("courses")
        .find({ _id: { $in: courseIds } })
        .toArray()) as Course[])
    : [];

  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  const summary = {
    total: enrollments.length,
    inProgress: enrollments.filter((e) => e.status === "in_progress").length,
    completed: enrollments.filter((e) => e.status === "completed").length,
  };

  return NextResponse.json(
    {
      candidate: {
        id: String(candidate._id),
        name: candidate.name,
        email: candidate.email,
        missingSkills: candidate.missingSkills ?? [],
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      },
      summary,
      enrollments: enrollments.map((enrollment) => {
        const course = courseById.get(String(enrollment.courseId));
        return {
          id: String(enrollment._id),
          courseId: String(enrollment.courseId),
          courseTitle: course?.title ?? "(deleted course)",
          courseExternalId: course?.externalId ?? enrollment.externalCourseId ?? "",
          courseSkills: course?.skills ?? [],
          status: enrollment.status,
          score: enrollment.score ?? null,
          source: enrollment.source,
          startedAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
          completedAt: enrollment.completedAt ?? null,
        };
      }),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
