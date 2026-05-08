import { getDb } from "@/lib/db";
import { getLtiConfig, isLtiConfigured, missingLtiEnvVars } from "@/lib/lti";
import { importPKCS8 } from "jose";
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
          privateKey: await probePrivateKey(),
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

async function probePrivateKey(): Promise<{ ok: boolean; firstLine?: string; lastLine?: string; error?: string }> {
  const pem = getLtiConfig().privateKeyPem;
  if (!pem) return { ok: false, error: "not set" };
  const lines = pem.trim().split("\n");
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  try {
    await importPKCS8(pem, "RS256");
    return { ok: true, firstLine, lastLine };
  } catch (e) {
    return {
      ok: false,
      firstLine,
      lastLine,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}
