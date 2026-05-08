import { getDb } from "@/lib/db";
import { isLtiConfigured, missingLtiEnvVars } from "@/lib/lti";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const ping = await db.admin().ping();
    const [candidateCount, courseCount] = await Promise.all([
      db.collection("candidates").estimatedDocumentCount(),
      db.collection("courses").estimatedDocumentCount(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        database: ping.ok === 1 ? "up" : "degraded",
        dbName: db.databaseName,
        counts: { candidates: candidateCount, courses: courseCount },
        lti: {
          configured: isLtiConfigured(),
          missing: missingLtiEnvVars(),
        },
        timestamp: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: "down",
        error: error instanceof Error ? error.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
