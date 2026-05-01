// Single source of truth for AI scoring criteria and score interfaces.
// Used by applicant forms (to display results) and admin/reviewer views (to show breakdowns).

export interface PsScores {
  interests_and_values: number;
  academic_commitment:  number;
  clarity_of_vision:    number;
  organization:         number;
  language_quality:     number;
  overall_score:        number;
  grade_pct?:           number;
  strengths:            string[];
  improvements:         string[];
}

export interface ResumeScores {
  academic_achievement:            number;
  leadership_and_extracurriculars: number;
  community_service:               number;
  research_and_work_experience:    number;
  skills_and_certifications:       number;
  awards_and_recognition:          number;
  overall_score:                   number;
  justification?:                  string;
  strengths:                       string[];
  improvements:                    string[];
}

// 5 criteria × max 30 = 150 total (matches overall_score scale)
export const PS_CRITERIA: { key: keyof PsScores; label: string; max: number }[] = [
  { key: "interests_and_values", label: "Interests & Values",  max: 30 },
  { key: "academic_commitment",  label: "Academic Commitment", max: 30 },
  { key: "clarity_of_vision",    label: "Clarity of Vision",   max: 30 },
  { key: "organization",         label: "Organization",         max: 30 },
  { key: "language_quality",     label: "Language Quality",     max: 30 },
];

// 6 criteria × max 30 = 180 total (matches overall_score scale)
export const RESUME_CRITERIA: { key: keyof ResumeScores; label: string; max: number }[] = [
  { key: "academic_achievement",            label: "Academic Achievement",        max: 30 },
  { key: "leadership_and_extracurriculars", label: "Leadership & Extracurriculars", max: 30 },
  { key: "community_service",               label: "Community Service",            max: 30 },
  { key: "research_and_work_experience",    label: "Research & Work Experience",   max: 30 },
  { key: "skills_and_certifications",       label: "Skills & Certifications",      max: 30 },
  { key: "awards_and_recognition",          label: "Awards & Recognition",         max: 30 },
];
