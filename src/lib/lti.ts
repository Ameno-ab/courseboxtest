import { SignJWT, importPKCS8 } from "jose";
import crypto from "crypto";

type LtiLaunchTokenInput = {
  userId: string;
  userEmail: string;
  userName: string;
  courseExternalId: string;
  nonce: string;
};

const alg = "RS256";

function readEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function readPem(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  if (!raw) return undefined;
  // Local .env stores PEMs as single-line with \n escapes; Vercel preserves real newlines.
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function getLtiConfig() {
  return {
    platformIssuer: readEnv("LTI_PLATFORM_ISSUER"),
    clientId: readEnv("LTI_TOOL_CLIENT_ID"),
    deploymentId: readEnv("LTI_DEPLOYMENT_ID"),
    targetLinkUri: readEnv("LTI_TARGET_LINK_URI"),
    launchUrl: readEnv("COURSEBOX_LTI_LAUNCH_URL"),
    keyId: readEnv("LTI_KEY_ID"),
    privateKeyPem: readPem("LTI_PLATFORM_PRIVATE_KEY_PEM"),
    jwksJson: readEnv("LTI_PLATFORM_PUBLIC_JWKS"),
  };
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

  return await new SignJWT({
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": config.deploymentId,
    "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": config.targetLinkUri,
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
