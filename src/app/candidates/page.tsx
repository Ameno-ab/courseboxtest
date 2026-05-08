import { getDb } from "@/lib/db";
import type { Candidate, Skill } from "@/lib/types";
import CandidatesAdmin from "@/components/candidates-admin";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const db = await getDb();
  const [candidates, skills] = await Promise.all([
    db.collection<Candidate>("candidates").find({}).sort({ updatedAt: -1 }).toArray(),
    db.collection<Skill>("skills").find({}).sort({ label: 1 }).toArray(),
  ]);

  return (
    <CandidatesAdmin
      initialCandidates={candidates.map((candidate) => ({
        id: String(candidate._id),
        name: candidate.name,
        email: candidate.email,
        missingSkills: candidate.missingSkills ?? [],
      }))}
      initialSkills={skills.map((s) => ({ slug: s.slug, label: s.label }))}
    />
  );
}
