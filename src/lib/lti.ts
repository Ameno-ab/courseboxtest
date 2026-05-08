import { SignJWT, importPKCS8 } from "jose";
import crypto from "crypto";

type LtiLaunchTokenInput = {
  userId: string;
  userEmail: string;
  userName: string;
  courseExternalId: string;
  nonce: string;
  targetLinkUri?: string;
};

const alg = "RS256";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function readPem(key: string): string | undefined {
  let raw = process.env[key];
  if (!raw) return undefined;
  raw = raw.trim();
  // Strip a single layer of surrounding quotes if someone pasted a quoted .env value.
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1);
  }
  // Convert \n / \r\n escape sequences to real newlines (single-line .env style).
  if (raw.includes("\\n") || raw.includes("\\r")) {
    raw = raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
  }
  // Normalise CRLF → LF and ensure a trailing newline (some PEM parsers are strict).
  raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.endsWith("\n")) raw += "\n";
  return raw;
}

export function getLtiConfig() {
  return {
    platformIssuer: readEnv("LTI_PLATFORM_ISSUER"),
    clientId: readEnv("LTI_TOOL_CLIENT_ID"),
    deploymentId: readEnv("LTI_DEPLOYMENT_ID"),
    targetLinkUri: readEnv("LTI_TARGET_LINK_URI"),
    launchUrl: readEnv("COURSEBOX_LTI_LAUNCH_URL"),
    initiateLoginUrl: readEnv("COURSEBOX_LTI_INITIATE_LOGIN_URL"),
    keyId: readEnv("LTI_KEY_ID"),
    privateKeyPem: readPem("LTI_PLATFORM_PRIVATE_KEY_PEM"),
    jwksJson: readEnv("LTI_PLATFORM_PUBLIC_JWKS"),
  };
}

export function isLtiConfigured(): boolean {
  return missingLtiEnvVars().length === 0;
}

export function missingLtiEnvVars(): string[] {
  const c = getLtiConfig();
  const missing: string[] = [];
  if (!c.platformIssuer) missing.push("LTI_PLATFORM_ISSUER");
  if (!c.clientId) missing.push("LTI_TOOL_CLIENT_ID");
  if (!c.deploymentId) missing.push("LTI_DEPLOYMENT_ID");
  if (!c.targetLinkUri) missing.push("LTI_TARGET_LINK_URI");
  if (!c.launchUrl) missing.push("COURSEBOX_LTI_LAUNCH_URL");
  if (!c.initiateLoginUrl) missing.push("COURSEBOX_LTI_INITIATE_LOGIN_URL");
  if (!c.keyId) missing.push("LTI_KEY_ID");
  if (!c.privateKeyPem) missing.push("LTI_PLATFORM_PRIVATE_KEY_PEM");
  return missing;
}

export function buildOidcInitiateLoginUrl(input: {
  loginHint: string;
  targetLinkUri?: string;
}): string {
  const config = getLtiConfig();
  if (!config.initiateLoginUrl || !config.platformIssuer || !config.clientId || !config.deploymentId || !config.targetLinkUri) {
    throw new Error("LTI not fully configured.");
  }

  const url = new URL(config.initiateLoginUrl);
  url.searchParams.set("iss", config.platformIssuer);
  url.searchParams.set("login_hint", input.loginHint);
  url.searchParams.set("target_link_uri", input.targetLinkUri ?? config.targetLinkUri);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("lti_deployment_id", config.deploymentId);
  url.searchParams.set("lti_message_hint", "LtiResourceLinkRequest");
  return url.toString();
}

export async function createLtiLaunchToken(input: LtiLaunchTokenInput): Promise<string> {
  const config = getLtiConfig();

  if (
    !config.platformIssuer ||
    !config.clientId ||
    !config.deploymentId ||
    !config.targetLinkUri ||
    !config.privateKeyPem ||
    !config.keyId
  ) {
    throw new Error("Missing required LTI environment variables.");
  }

  const privateKey = await importPKCS8(config.privateKeyPem, alg);
  const now = Math.floor(Date.now() / 1000);
  const targetLinkUri = input.targetLinkUri ?? config.targetLinkUri;

  return await new SignJWT({
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": config.deploymentId,
    "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": targetLinkUri,
    "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
      id: input.courseExternalId,
      title: input.courseExternalId,
    },
    "https://purl.imsglobal.org/spec/lti/claim/roles": [
      "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
    ],
    name: input.userName,
    email: input.userEmail,
    nonce: input.nonce,
  })
    .setProtectedHeader({ alg, kid: config.keyId, typ: "JWT" })
    .setIssuer(config.platformIssuer)
    .setAudience(config.clientId)
    .setSubject(input.userId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

export function getPublicJwks() {
  const jwksJson = readEnv("LTI_PLATFORM_PUBLIC_JWKS");

  if (!jwksJson) {
    return { keys: [] };
  }

  try {
    return JSON.parse(jwksJson) as { keys: unknown[] };
  } catch {
    return { keys: [] };
  }
}
