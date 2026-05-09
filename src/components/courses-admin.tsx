"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CourseRow = {
  id: string;
  externalId: string;
  title: string;
  description: string;
  skills: string[];
  lmsLaunchUrl: string;
  courseboxCourseId?: string;
};

type SkillRow = { slug: string; label: string };

export default function CoursesAdmin({
  initialCourses,
  initialSkills,
}: {
  initialCourses: CourseRow[];
  initialSkills: SkillRow[];
}) {
  const [courses, setCourses] = useState<CourseRow[]>(initialCourses);
  const [skills, setSkills] = useState<SkillRow[]>(initialSkills);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExternalId, setEditingExternalId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lmsLaunchUrl, setLmsLaunchUrl] = useState("");
  const [courseboxCourseId, setCourseboxCourseId] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  function resetForm() {
    setEditingId(null);
    setEditingExternalId(null);
    setTitle("");
    setDescription("");
    setLmsLaunchUrl("");
    setCourseboxCourseId("");
    setSelectedSkills([]);
  }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const skillSet = useMemo(() => new Set(skills.map((s) => s.slug)), [skills]);

  function toggleSkill(slug: string) {
    setSelectedSkills((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function addNewSkill() {
    const label = newSkill.trim();
    if (!label) return;
    setError(null);
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to add skill.");
      const slug = payload.slug as string;
      if (!skillSet.has(slug)) {
        setSkills((prev) => [...prev, { slug, label: payload.label }].sort((a, b) => a.label.localeCompare(b.label)));
      }
      if (!selectedSkills.includes(slug)) {
        setSelectedSkills((prev) => [...prev, slug]);
      }
      setNewSkill("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          skills: selectedSkills,
          lmsLaunchUrl: lmsLaunchUrl.trim() || undefined,
          courseboxCourseId: courseboxCourseId.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          payload.error ??
            (payload.details ? "Validation failed." : "Failed to save course."),
        );
      }

      const list = await fetch("/api/courses").then((r) => r.json());
      setCourses(list.courses);
      resetForm();
      setSuccess(editingId ? "Course updated." : "Course created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 2500);
    return () => clearTimeout(id);
  }, [success]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <section className="flex items-center justify-between rounded-3xl border border-amber-200/50 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            Courses
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
            Register Coursebox courses, attach a launch URL, and tag the skills they teach.
            Recommendations on the dashboard match these skills against each candidate&apos;s gaps.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Back to dashboard
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit course" : "Add new course"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingId
                ? "Editing an existing course — changes save in place."
                : "Course ID is generated automatically when you save."}
            </p>
            {editingExternalId ? (
              <p className="mt-1 break-all text-xs text-slate-400">
                ID: {editingExternalId}
              </p>
            ) : null}
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="mt-5 grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sales Foundations"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Coursebox launch URL
            </label>
            <input
              type="url"
              value={lmsLaunchUrl}
              onChange={(e) => setLmsLaunchUrl(e.target.value)}
              placeholder="https://my.coursebox.ai/lti/launch?link=..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              From Coursebox &gt; Course &gt; Publish to LMS &gt; copy the Launch URL.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Coursebox Course ID
            </label>
            <input
              type="text"
              value={courseboxCourseId}
              onChange={(e) => setCourseboxCourseId(e.target.value)}
              placeholder="e.g. 456"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              The numeric Course Id Coursebox sends in completion webhooks. Required
              for Zapier completion events to match this course (Coursebox does not
              send the external ID).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Skills</label>
            <div className="flex flex-wrap gap-2">
              {skills.length === 0 ? (
                <span className="text-xs text-slate-500">No skills yet — add one below.</span>
              ) : (
                skills.map((skill) => {
                  const active = selectedSkills.includes(skill.slug);
                  return (
                    <button
                      key={skill.slug}
                      type="button"
                      onClick={() => toggleSkill(skill.slug)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-sky-500 bg-sky-100 text-sky-800"
                          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {skill.label}
                    </button>
                  );
                })
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add new skill"
                className="w-full max-w-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={addNewSkill}
                disabled={!newSkill.trim()}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add skill
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {submitting ? "Saving..." : "Save course"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">All courses</h2>
        <div className="mt-4 grid gap-3">
          {courses.length === 0 ? (
            <p className="text-sm text-slate-500">No courses yet.</p>
          ) : (
            courses.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{course.title}</h3>
                    <p className="break-all text-xs text-slate-500">ID: {course.externalId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(course.id);
                      setEditingExternalId(course.externalId);
                      setTitle(course.title);
                      setDescription(course.description);
                      setLmsLaunchUrl(course.lmsLaunchUrl);
                      setCourseboxCourseId(course.courseboxCourseId ?? "");
                      setSelectedSkills(course.skills);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Edit
                  </button>
                </div>
                {course.description ? (
                  <p className="mt-2 text-sm text-slate-700">{course.description}</p>
                ) : null}
                {course.lmsLaunchUrl ? (
                  <p className="mt-2 break-all text-xs text-slate-500">
                    Launch URL: {course.lmsLaunchUrl}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">
                    No Coursebox launch URL — launches will use the global env-var fallback.
                  </p>
                )}
                {course.courseboxCourseId ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Coursebox Course ID: {course.courseboxCourseId}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">
                    No Coursebox Course ID — Zapier completion events for this course
                    won&apos;t match unless they include candidateEmail + matching externalId.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {course.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
