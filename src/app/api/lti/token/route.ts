import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "expected application/x-www-form-urlencoded" },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const clientAssertionType = String(form.get("client_assertion_type") ?? "");
  const clientAssertion = String(form.get("client_assertion") ?? "");
  const scope = String(form.get("scope") ?? "");

  if (grantType !== "client_credentials") {
    return tokenError("unsupported_grant_type");
  }
  if (
    clientAssertionType !==
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
  ) {
    return tokenError("invalid_client", "client_assertion_type must be jwt-bearer");
  }
  if (!clientAssertion) {
    return tokenError("invalid_client", "client_assertion is required");
  }

  // NOTE: Production implementations should fetch the tool's JWKS and verify
  // the client_assertion JWT. This stub accepts any well-formed assertion so
  // Coursebox's registration validation succeeds. AGS / NRPS service calls
  // are not implemented yet; the issued token is a placeholder.
  const accessToken = crypto.randomUUID();

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

function tokenError(error: string, description?: string): NextResponse {
  return NextResponse.json(
    description
      ? { error, error_description: description }
      : { error },
    { status: 400 },
  );
}
