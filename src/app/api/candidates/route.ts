import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDb();
  const candidates = await db
    .collection("candidates")
    .find({}, { projection: { name: 1, email: 1, skills: 1 } })
    .sort({ name: 1 })
    .toArray();

  return NextResponse.json({
    candidates: candidates.map((candidate) => ({
      id: String(candidate._id),
      name: candidate.name,
      email: candidate.email,
      skills: candidate.skills ?? [],
    })),
  });
}
