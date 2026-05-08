import { getDb } from "@/lib/db";
import PrototypeDashboard from "@/components/prototype-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await getDb();

  const candidates = await db
    .collection("candidates")
    .find({}, { projection: { name: 1, email: 1, missingSkills: 1 } })
    .sort({ name: 1 })
    .toArray();

  return (
    <PrototypeDashboard
      candidates={candidates.map((candidate) => ({
        id: String(candidate._id),
        name: candidate.name,
        email: candidate.email,
        missingSkills: candidate.missingSkills ?? [],
      }))}
    />
  );
}
