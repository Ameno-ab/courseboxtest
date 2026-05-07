import type { Candidate, Course, Recommendation } from "@/lib/types";

export function scoreCourse(candidate: Candidate, course: Course): Recommendation {
  const candidateSkills = new Set(candidate.skills.map((skill) => skill.toLowerCase()));
  const normalizedCourseSkills = course.skills.map((skill) => skill.toLowerCase());

  const matchedSkills = normalizedCourseSkills.filter((skill) => candidateSkills.has(skill));
  const missingSkills = normalizedCourseSkills.filter((skill) => !candidateSkills.has(skill));

  const score = normalizedCourseSkills.length
    ? matchedSkills.length / normalizedCourseSkills.length
    : 0;

  return {
    courseId: String(course._id),
    externalId: course.externalId,
    title: course.title,
    description: course.description,
    matchedSkills,
    missingSkills,
    score,
    enrollmentStatus: "not_started",
  };
}
