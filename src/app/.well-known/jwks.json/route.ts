import { getPublicJwks } from "@/lib/lti";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getPublicJwks());
}
