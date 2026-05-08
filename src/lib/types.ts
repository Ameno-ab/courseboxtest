import { ObjectId } from "mongodb";

export type EnrollmentStatus = "suggested" | "in_progress" | "completed";

export type Course = {
  _id?: ObjectId;
  externalId: string;
  title: string;
  description?: string;
  skills: string[];
  lmsLaunchUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type Skill = {
  _id?: ObjectId;
  slug: string;
  label: string;
  createdAt: Date;
};

export type Candidate = {
  _id?: ObjectId;
  name: string;
  email: string;
  missingSkills: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type Enrollment = {
  _id?: ObjectId;
  candidateId: ObjectId;
  courseId: ObjectId;
  status: EnrollmentStatus;
  externalCourseId?: string;
  externalEnrollmentId?: string;
  source: "manual" | "lti" | "zapier";
  score?: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type IntegrationEvent = {
  _id?: ObjectId;
  provider: "zapier";
  eventId: string;
  type: string;
  payload: unknown;
  status: "processed" | "ignored";
  receivedAt: Date;
  processedAt: Date;
};

export type Recommendation = {
  courseId: string;
  externalId: string;
  title: string;
  description?: string;
  addressedSkills: string[];
  remainingSkills: string[];
  score: number;
  enrollmentStatus: EnrollmentStatus | "not_started";
};
