import { getDb, closeDb } from "../src/lib/db";

function getArg(name: string): string | null {
  const token = `--${name}`;
  const index = process.argv.indexOf(token);

  if (index === -1 || !process.argv[index + 1]) {
    return null;
  }

  return process.argv[index + 1];
}

function parseSkills(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((skill) => skill.toLowerCase().trim())
    .filter(Boolean);
}

async function run() {
  const entity = getArg("entity");
  const id = getArg("id");
  const skills = parseSkills(getArg("skills"));

  if (!entity || !id || !skills.length) {
    throw new Error(
      "Usage: npm run cli:upsert-skills -- --entity candidate|course --id <email|externalId> --skills skill1,skill2",
    );
  }

  const db = await getDb();
  const now = new Date();

  if (entity === "candidate") {
    const result = await db.collection("candidates").updateOne(
      { email: id.toLowerCase() },
      {
        $set: { skills, updatedAt: now },
        $setOnInsert: {
          email: id.toLowerCase(),
          name: id.split("@")[0],
          createdAt: now,
        },
      },
      { upsert: true },
    );

    console.log(`Candidate updated. matched=${result.matchedCount} upserted=${result.upsertedCount}`);
    return;
  }

  if (entity === "course") {
    const result = await db.collection("courses").updateOne(
      { externalId: id },
      {
        $set: { skills, updatedAt: now },
      },
      { upsert: false },
    );

    console.log(`Course updated. matched=${result.matchedCount} modified=${result.modifiedCount}`);
    return;
  }

  throw new Error("--entity must be candidate or course");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
