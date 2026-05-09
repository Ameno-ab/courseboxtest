"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CandidateRow = {
  id: string;
  name: string;
  email: string;
  missingSkills: string[];
};

type SkillRow = { slug: string; label: string };

export default function CandidatesAdmin({
  initialCandidates,
  initialSkills,
}: {
  initialCandidates: CandidateRow[];
  initialSkills: SkillRow[];
}) {
  const [candidates, setCandidates] = useState<CandidateRow[]>(initialCandidates);
  const [skills, setSkills] = useState<SkillRow[]>(initialSkills);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const skillSet = useMemo(() => new Set(skills.map((s) => s.slug)), [skills]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setSelectedSkills([]);
  }

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
        setSkills((prev) =>
          [...prev, { slug, label: payload.label }].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        );
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

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name: name.trim(),
          email: email.trim(),
          missingSkills: selectedSkills,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save candidate.");
      }

      const list = await fetch("/api/candidates").then((r) => r.json());
      setCandidates(list.candidates);
      resetForm();
      setSuccess(editingId ? "Candidate updated." : "Candidate created.");
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
      <section className="rounded-3xl border border-amber-200/50 bg-linear-to-r from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Candidates
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Add a learner and tag the skills they need to acquire. The dashboard recommends
          courses that close those specific gaps.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit candidate" : "Add new candidate"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingId
                ? "Editing in place — no new candidate is created."
                : "Email is the unique identifier."}
            </p>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alice Candidate"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Missing skills
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Skills this learner needs to acquire. Recommendations match these against
              what each course teaches.
            </p>
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
              {submitting ? "Saving..." : editingId ? "Save changes" : "Create candidate"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">All candidates</h2>
        <div className="mt-4 grid gap-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-slate-500">No candidates yet.</p>
          ) : (
            candidates.map((candidate) => (
              <article key={candidate.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{candidate.name}</h3>
                    <p className="text-xs text-slate-500">{candidate.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/candidates/${candidate.id}`}
                      className="rounded-md px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                    >
                      View status
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(candidate.id);
                        setName(candidate.name);
                        setEmail(candidate.email);
                        setSelectedSkills(candidate.missingSkills);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {candidate.missingSkills.length === 0 ? (
                    <span className="text-xs text-slate-400">no missing skills</span>
                  ) : (
                    candidate.missingSkills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                      >
                        {skill}
                      </span>
                    ))
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
