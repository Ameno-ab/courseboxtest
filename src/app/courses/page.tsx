import { getDb } from "@/lib/db";
import type { Course, Skill } from "@/lib/types";
import CoursesAdmin from "@/components/courses-admin";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const db = await getDb();
  const [courses, skills] = await Promise.all([
    db.collection<Course>("courses").find({}).sort({ updatedAt: -1 }).toArray(),
    db.collection<Skill>("skills").find({}).sort({ label: 1 }).toArray(),
  ]);

  return (
    <main className="min-h-screen w-full">
      <CoursesAdmin
        initialCourses={courses.map((course) => ({
          id: String(course._id),
          externalId: course.externalId,
          title: course.title,
          description: course.description ?? "",
          skills: course.skills ?? [],
          lmsLaunchUrl: course.lmsLaunchUrl ?? "",
        }))}
        initialSkills={skills.map((s) => ({ slug: s.slug, label: s.label }))}
      />
    </main>
  );
}
