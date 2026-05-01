// All shared TypeScript types for the app.
// Score interfaces and criteria live in lib/scores.ts; imported and re-exported here for convenience.
import type { PsScores, ResumeScores } from "./lib/scores";
export type { PsScores, ResumeScores };

// ── Applicant submission form types ──────────────────────────────────────────

export type UploadedFile = { name: string; size?: number; type?: string };

export type EducationItem = {
  id: string;
  institution: string;
  degree: string;
  startYear: string;
  endYear: string;
  gpa: string;
};

export type ExperienceItem = {
  id: string;
  jobTitle: string;
  organization: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
};

export type AwardItem = {
  id: string;
  name: string;
  year: string;
  description: string;
};

export type CommunityItem = {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type LeadershipItem = {
  id: string;
  role: string;
  organization: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type ApplicationData = {
  personalInfo: {
    fullName: string;
    dateOfBirth: string;
    country: string;
    chosenMajor: string;
    university: string;
    gpa: string;
    graduationYear: string;
    ieltsScore: string;
  };
  personalStatement: {
    valuesGoals: string;
    whyMajor: string;
    interests: string;
    summary: string;
    uploadedFile: File[];
  };
  resume: {
    uploadedFile: File[];
    education: EducationItem[];
    experience: ExperienceItem[];
    skills: string[];
    awards: AwardItem[];
    community: CommunityItem[];
    leadership: LeadershipItem[];
  };
  portfolio: {
    links: string[];
    files: File[];
  };
  documents: {
    transcript: File[];
    ielts: File[];
    cvOptional: File[];
    statementOptional: File[];
    additional: File[];
  };
};

// ── Admin / reviewer types ────────────────────────────────────────────────────

export type ApplicantStatus =
  | "Pending"
  | "In Review"
  | "Submitted"
  | "Incomplete"
  | "Evaluated"
  | "Accepted"
  | "Waitlisted"
  | "Rejected";

export interface Applicant {
  id: string;
  name: string;
  status: ApplicantStatus;
  scholarship: string;

  formFields: { label: string; value: string }[];
  answers:    { question: string; answer: string }[];
  documents:  { name: string; uploaded: boolean; url: string }[];

  aiScore:    number;
  aiBreakdown: {
    academic:   number;
    leadership: number;
    financial:  number;
    statement:  number;
    portfolio?: number;
  };
  aiFeedback: string;
  aiSummary: {
    strengths:  string[];
    weaknesses: string[];
  };

  psScores?:     PsScores;
  resumeScores?: ResumeScores;

  portfolio?: {
    summary: string;
    items: { title: string; description: string; url: string }[];
  };
}
