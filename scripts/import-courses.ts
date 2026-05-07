import fs from "fs";
import path from "path";
import { getDb, closeDb } from "../src/lib/db";
import { z } from "zod";

const courseSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  skills: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const payloadSchema = z.array(courseSchema);

function getArg(name: string): string | null {
  const token = `--${name}`;
  const index = process.argv.indexOf(token);

  if (index === -1 || !process.argv[index + 1]) {
    return null;
  }

  return process.argv[index + 1];
}

async function run() {
  const fileArg = getArg("file");

  if (!fileArg) {
    throw new Error("Missing --file path. Example: npm run cli:import-courses -- --file ./data/courses.json");
  }

  const fullPath = path.resolve(fileArg);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = payloadSchema.parse(JSON.parse(raw));

  const db = await getDb();
  const now = new Date();

  const operations = parsed.map((course) => ({
    updateOne: {
      filter: { externalId: course.externalId },
      update: {
        $set: {
          title: course.title,
          description: course.description,
          skills: course.skills.map((skill) => skill.toLowerCase().trim()),
          metadata: course.metadata ?? {},
          updatedAt: now,
        },
        $setOnInsert: {
          externalId: course.externalId,
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));

  if (!operations.length) {
    console.log("No courses to import.");
    return;
  }

  const result = await db.collection("courses").bulkWrite(operations, { ordered: false });
  console.log(
    `Import complete. matched=${result.matchedCount} modified=${result.modifiedCount} upserted=${result.upsertedCount}`,
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
