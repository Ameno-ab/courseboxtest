import type { Candidate, Course, Recommendation } from "@/lib/types";

export function scoreCourse(candidate: Candidate, course: Course): Recommendation {
  const missingSkills = new Set(
    candidate.missingSkills.map((skill) => skill.toLowerCase()),
  );
  const courseSkills = course.skills.map((skill) => skill.toLowerCase());

  const addressedSkills = courseSkills.filter((skill) => missingSkills.has(skill));
  const stillMissing = candidate.missingSkills
    .map((s) => s.toLowerCase())
    .filter((skill) => !addressedSkills.includes(skill));

  const score = missingSkills.size
    ? addressedSkills.length / missingSkills.size
    : 0;

  return {
    courseId: String(course._id),
    externalId: course.externalId,
    title: course.title,
    description: course.description,
    addressedSkills,
    remainingSkills: stillMissing,
    score,
    enrollmentStatus: "not_started",
  };
}
