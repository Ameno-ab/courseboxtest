import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const db = await getDb();
  const admin = db.admin();
  const ping = await admin.ping();

  return NextResponse.json({
    ok: true,
    database: ping.ok === 1 ? "up" : "degraded",
    timestamp: new Date().toISOString(),
  });
}
