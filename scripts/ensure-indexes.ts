import { getDb, closeDb } from "../src/lib/db";

async function run() {
  const db = await getDb();

  await db.collection("courses").createIndexes([
    { key: { externalId: 1 }, unique: true },
    { key: { skills: 1 } },
    { key: { updatedAt: -1 } },
  ]);

  await db.collection("candidates").createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { skills: 1 } },
    { key: { updatedAt: -1 } },
  ]);

  await db.collection("enrollments").createIndexes([
    { key: { candidateId: 1, courseId: 1 }, unique: true },
    { key: { status: 1 } },
    { key: { externalCourseId: 1 } },
  ]);

  await db.collection("integrationEvents").createIndexes([
    { key: { provider: 1, eventId: 1 }, unique: true },
    { key: { processedAt: -1 } },
  ]);

  await db.collection("ltiLoginSessions").createIndexes([
    { key: { loginHint: 1 }, unique: true },
    { key: { createdAt: 1 }, expireAfterSeconds: 600 },
  ]);

  console.log("Indexes ensured successfully.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
