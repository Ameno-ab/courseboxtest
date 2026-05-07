import { getDb, closeDb } from "../src/lib/db";

async function run() {
  const db = await getDb();
  const now = new Date();

  await db.collection("candidates").deleteMany({});
  await db.collection("courses").deleteMany({});
  await db.collection("enrollments").deleteMany({});
  await db.collection("integrationEvents").deleteMany({});

  await db.collection("candidates").insertMany([
    {
      name: "Alice Candidate",
      email: "alice@example.com",
      skills: ["communication", "sales", "crm"],
      createdAt: now,
      updatedAt: now,
    },
    {
      name: "Ben Candidate",
      email: "ben@example.com",
      skills: ["safety", "compliance", "risk"],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection("courses").insertMany([
    {
      externalId: "cbx-sales-101",
      title: "Sales Foundations",
      description: "Build core consultative sales skills.",
      skills: ["sales", "communication", "negotiation"],
      metadata: { level: "beginner", durationMinutes: 90 },
      createdAt: now,
      updatedAt: now,
    },
    {
      externalId: "cbx-safe-201",
      title: "Workplace Safety Essentials",
      description: "Learn baseline safety and compliance expectations.",
      skills: ["safety", "compliance", "incident response"],
      metadata: { level: "beginner", durationMinutes: 60 },
      createdAt: now,
      updatedAt: now,
    },
    {
      externalId: "cbx-crm-301",
      title: "CRM Workflow Mastery",
      description: "Improve pipeline quality and CRM hygiene.",
      skills: ["crm", "sales", "process"],
      metadata: { level: "intermediate", durationMinutes: 80 },
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("Seed data created.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
