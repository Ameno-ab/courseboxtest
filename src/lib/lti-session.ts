import crypto from "crypto";
import { getDb } from "@/lib/db";

const COLLECTION = "ltiLoginSessions";
const TTL_SECONDS = 600;

export type LtiLoginSession = {
  loginHint: string;
  userId: string;
  userEmail: string;
  userName: string;
  courseExternalId: string;
  targetLinkUri: string;
  createdAt: Date;
};

export async function createLoginSession(input: {
  userId: string;
  userEmail: string;
  userName: string;
  courseExternalId: string;
  targetLinkUri: string;
}): Promise<string> {
  const loginHint = crypto.randomUUID();
  const db = await getDb();
  await db.collection<LtiLoginSession>(COLLECTION).insertOne({
    loginHint,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    courseExternalId: input.courseExternalId,
    targetLinkUri: input.targetLinkUri,
    createdAt: new Date(),
  });
  return loginHint;
}

export async function consumeLoginSession(
  loginHint: string,
): Promise<LtiLoginSession | null> {
  const db = await getDb();
  const session = await db
    .collection<LtiLoginSession>(COLLECTION)
    .findOneAndDelete({ loginHint });
  return session ?? null;
}

export const LTI_LOGIN_TTL_SECONDS = TTL_SECONDS;
export const LTI_LOGIN_COLLECTION = COLLECTION;
