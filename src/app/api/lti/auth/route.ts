import { NextRequest, NextResponse } from "next/server";
import { createLtiLaunchToken, getLtiConfig } from "@/lib/lti";
import { consumeLoginSession } from "@/lib/lti-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handle(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const params = new URLSearchParams();
    for (const [k, v] of form.entries()) params.set(k, String(v));
    return handle(params);
  }
  return handle(request.nextUrl.searchParams);
}

async function handle(params: URLSearchParams): Promise<NextResponse> {
  const responseType = params.get("response_type");
  const scope = params.get("scope");
  const responseMode = params.get("response_mode");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const loginHint = params.get("login_hint");
  const nonce = params.get("nonce");
  const state = params.get("state") ?? "";

  if (responseType !== "id_token") {
    return badRequest("response_type must be id_token");
  }
  if (!scope?.split(/\s+/).includes("openid")) {
    return badRequest("scope must include openid");
  }
  if (responseMode && responseMode !== "form_post") {
    return badRequest("response_mode must be form_post");
  }
  if (!clientId || !redirectUri || !loginHint || !nonce) {
    return badRequest("missing required OIDC parameters");
  }

  const config = getLtiConfig();
  if (clientId !== config.clientId) {
    return badRequest("client_id does not match registered platform");
  }

  const session = await consumeLoginSession(loginHint);
  if (!session) {
    return badRequest("unknown or expired login_hint");
  }

  const targetLinkUri = params.get("target_link_uri") ?? undefined;

  const idToken = await createLtiLaunchToken({
    userId: session.userId,
    userEmail: session.userEmail,
    userName: session.userName,
    courseExternalId: session.courseExternalId,
    nonce,
    targetLinkUri,
  });

  return new NextResponse(autoSubmitForm(redirectUri, idToken, state), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

function autoSubmitForm(action: string, idToken: string, state: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Launching...</title></head>
<body onload="document.forms[0].submit()">
<form method="POST" action="${esc(action)}">
<input type="hidden" name="id_token" value="${esc(idToken)}" />
<input type="hidden" name="state" value="${esc(state)}" />
<noscript><button type="submit">Continue</button></noscript>
</form>
</body></html>`;
}
