"use client";

import { useMemo, useState } from "react";

type Candidate = {
  id: string;
  name: string;
  email: string;
  skills: string[];
};

type Recommendation = {
  courseId: string;
  externalId: string;
  title: string;
  description?: string;
  matchedSkills: string[];
  missingSkills: string[];
  score: number;
  enrollmentStatus: "not_started" | "suggested" | "in_progress" | "completed";
};

type RecommendationResponse = {
  candidate: {
    id: string;
    name: string;
    skills: string[];
  };
  recommendations: Recommendation[];
};

export default function PrototypeDashboard({
  candidates,
}: {
  candidates: Candidate[];
}) {
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [launchingCourseId, setLaunchingCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embeddedLaunch, setEmbeddedLaunch] = useState<{
    url: string;
    title: string;
    courseId: string;
  } | null>(null);
  const [openingNewTab, setOpeningNewTab] = useState(false);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === candidateId),
    [candidateId, candidates],
  );

  async function loadRecommendations() {
    if (!candidateId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/recommendations?candidateId=${candidateId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load recommendations.");
      }

      setResult(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function launchCourse(courseId: string) {
    if (!candidateId) {
      return;
    }

    setLaunchingCourseId(courseId);
    setError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ candidateId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to launch course.");
      }

      const recommendation = result?.recommendations.find(
        (r) => r.courseId === courseId,
      );
      const title = recommendation?.title ?? "Course";

      if (payload.mode === "direct_url" && payload.launchUrl) {
        setEmbeddedLaunch({ url: payload.launchUrl, title, courseId });
        return;
      }

      if (payload.mode === "lti_init" && payload.redirectUrl) {
        setEmbeddedLaunch({ url: payload.redirectUrl, title, courseId });
        return;
      }
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : "Unknown launch error");
    } finally {
      setLaunchingCourseId(null);
    }
  }

  async function openInNewTab() {
    if (!embeddedLaunch || !candidateId) return;
    setOpeningNewTab(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${embeddedLaunch.courseId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to start a fresh launch.");
      }
      const freshUrl =
        payload.mode === "lti_init"
          ? payload.redirectUrl
          : payload.mode === "direct_url"
          ? payload.launchUrl
          : null;
      if (freshUrl) {
        window.open(freshUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error opening new tab.");
    } finally {
      setOpeningNewTab(false);
    }
  }

  if (embeddedLaunch) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEmbeddedLaunch(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              aria-label="Back to dashboard"
            >
              <span aria-hidden="true">←</span>
              <span>Back</span>
            </button>
            <span className="text-sm font-semibold text-slate-900">{embeddedLaunch.title}</span>
          </div>
          <button
            type="button"
            onClick={openInNewTab}
            disabled={openingNewTab}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {openingNewTab ? "Opening..." : "Open in new tab"}
          </button>
        </div>
        <iframe
          key={embeddedLaunch.url}
          src={embeddedLaunch.url}
          title={embeddedLaunch.title}
          className="h-full w-full flex-1 border-0"
          allow="fullscreen; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 md:px-10">
      <section className="rounded-3xl border border-amber-200/50 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Coursebox Skill-Match Prototype
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Pick a candidate, generate skill-based recommendations, then launch a course
          using LTI or direct fallback while tracking completion updates via Zapier.
        </p>
      </section>

      <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label htmlFor="candidate" className="mb-2 block text-sm font-medium text-slate-700">
            Candidate
          </label>
          <select
            id="candidate"
            value={candidateId}
            onChange={(event) => setCandidateId(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-0 transition focus:border-sky-500"
          >
            {candidates.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.name} ({candidate.email})
              </option>
            ))}
          </select>
          {selectedCandidate ? (
            <p className="mt-2 text-xs text-slate-500">
              Skills: {selectedCandidate.skills.length ? selectedCandidate.skills.join(", ") : "none"}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={loadRecommendations}
          disabled={!candidateId || loading}
          className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? "Matching..." : "Suggest Courses"}
        </button>
      </section>

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4">
        {result?.recommendations?.length ? (
          result.recommendations.map((recommendation) => (
            <article
              key={recommendation.courseId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{recommendation.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{recommendation.description}</p>
                  <p className="mt-2 text-xs text-slate-500">Coursebox ID: {recommendation.externalId}</p>
                </div>
                <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  Match {(recommendation.score * 100).toFixed(0)}%
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Matched Skills
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {recommendation.matchedSkills.length
                      ? recommendation.matchedSkills.join(", ")
                      : "None"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Missing Skills
                  </h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {recommendation.missingSkills.length
                      ? recommendation.missingSkills.join(", ")
                      : "None"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Enrollment: {recommendation.enrollmentStatus}
                </span>
                <button
                  type="button"
                  onClick={() => launchCourse(recommendation.courseId)}
                  disabled={launchingCourseId === recommendation.courseId}
                  className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {launchingCourseId === recommendation.courseId ? "Launching..." : "Launch Course"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Select a candidate and click Suggest Courses.
          </div>
        )}
      </section>

    </div>
  );
}
