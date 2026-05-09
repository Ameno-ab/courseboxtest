import { getDb } from "@/lib/db";
import type { Candidate, Course, Enrollment } from "@/lib/types";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusStyle(status: Enrollment["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "in_progress":
      return "bg-sky-100 text-sky-800";
    case "suggested":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function fmtDate(value?: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString();
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const { candidateId } = await params;
  if (!ObjectId.isValid(candidateId)) notFound();

  const db = await getDb();
  const candidate = (await db
    .collection<Candidate>("candidates")
    .findOne({ _id: new ObjectId(candidateId) })) as Candidate | null;
  if (!candidate) notFound();

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

  const total = enrollments.length;
  const inProgress = enrollments.filter((e) => e.status === "in_progress").length;
  const completed = enrollments.filter((e) => e.status === "completed").length;
  const isComplete = total > 0 && completed === total;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-amber-200/50 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <div>
          <Link href="/candidates" className="text-xs text-slate-500 hover:underline">
            ← All candidates
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {candidate.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{candidate.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isComplete
                ? "bg-emerald-600 text-white"
                : inProgress > 0
                ? "bg-sky-600 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {isComplete ? "All done" : inProgress > 0 ? "In progress" : "Not started"}
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Enrollments" value={total} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Completed" value={completed} />
        <Stat label="Skills still missing" value={candidate.missingSkills?.length ?? 0} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Missing skills</h2>
        <p className="mt-1 text-sm text-slate-500">
          Skills get removed automatically when a Zapier completion event arrives for a
          course that teaches them.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.missingSkills?.length ? (
            candidate.missingSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800"
              >
                {skill}
              </span>
            ))
          ) : (
            <span className="text-sm text-emerald-700">No outstanding gaps. 🎉</span>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Enrollments</h2>
        <p className="mt-1 text-sm text-slate-500">
          Started when this candidate launches a course. Marked completed when Zapier
          posts a course-completed event.
        </p>
        <div className="mt-4 grid gap-3">
          {enrollments.length === 0 ? (
            <p className="text-sm text-slate-500">No enrollments yet.</p>
          ) : (
            enrollments.map((enrollment) => {
              const course = courseById.get(String(enrollment.courseId));
              return (
                <article
                  key={String(enrollment._id)}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {course?.title ?? "(deleted course)"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {course?.externalId ?? enrollment.externalCourseId}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                        enrollment.status,
                      )}`}
                    >
                      {enrollment.status.replace("_", " ")}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-4">
                    <div>
                      <dt className="font-medium text-slate-500">Source</dt>
                      <dd>{enrollment.source}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Started</dt>
                      <dd>{fmtDate(enrollment.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Updated</dt>
                      <dd>{fmtDate(enrollment.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-slate-500">Completed</dt>
                      <dd>{fmtDate(enrollment.completedAt)}</dd>
                    </div>
                  </dl>
                  {enrollment.score != null ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Score: <span className="font-semibold">{enrollment.score}</span>
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
