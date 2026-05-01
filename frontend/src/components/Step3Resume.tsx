// Step 3 of the application process where applicant fills in their resume
import React, { useState } from "react";
import OcrUploader from "./OcrUploader";

/*This education component needs: 
- unique ID
- instituton 
- degree ? 
- start&end year 
- gpa
*/
interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  startYear: string;
  endYear: string;
  gpa: string;
}

/*This experience component needs:
- unique ID
- job title 
- organization 
- start and end date 
- responsibilities 
*/
interface ExperienceItem {
  id: string;
  jobTitle: string;
  organization: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
}

/*This award component needs:
- unqiue ID 
- name 
- year
- description
 */
interface AwardItem {
  id: string;
  name: string;
  year: string;
  description: string;
}

/*This community component needs: 
- unqiue ID 
- organization 
- role 
- start and end date 
- description
*/
interface CommunityItem {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

/*This leadership component needs: 
- unqiue ID 
- organization 
- role 
- start and end date 
- description
*/
interface LeadershipItem {
  id: string;
  role: string;
  organization: string;
  startDate: string;
  endDate: string;
  description: string;
}

/*This component includes:
- the different items required in resumes (data)
- being able to update, going next, going back, being able to save draft
*/
interface Step3Props {
  data: {
    education: EducationItem[];
    experience: ExperienceItem[];
    skills: string[];
    awards: AwardItem[];
    community: CommunityItem[];
    leadership: LeadershipItem[];
    uploadedFile: File[];
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
}

/* Utilities */
// Generates a unique ID for each new list entry
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Pre-built year options for the education start/end year dropdowns
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(currentYear - i + 5));

/* OCR parsing helpers */
// Maps common resume section keywords to their internal data keys
const SECTION_PATTERNS: { regex: RegExp; key: string }[] = [
  { regex: /\beducation\b/i,                                          key: "education"  },
  { regex: /\bexperience\b|\binternship\b|\bemployment\b/i,          key: "experience" },
  { regex: /\bskills?\b|\bcertification\b|\btechnolog/i,             key: "skills"     },
  { regex: /\baward\b|\brecognition\b|\bhonor\b|\bachievement\b/i,   key: "awards"     },
  { regex: /\bcommunity\b|\bvolunteer\b|\bservice\b/i,               key: "community"  },
  { regex: /\bleadership\b|\bextracurricular\b|\bclub\b|\bactivit/i, key: "leadership" },
];

// matches a known section keyword
function isSectionHeader(trimmed: string): string | null {
  if (!trimmed || trimmed.length > 50) return null;
  if (trimmed.includes(",") || trimmed.includes(".")) return null;
  if (trimmed.split(/\s+/).length > 5) return null;

  const match = SECTION_PATTERNS.find((pattern) => pattern.regex.test(trimmed));
  return match ? match.key : null;
}

// gets each line of the extracted text under their nearest section header
function splitIntoSections(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const sectionKey = isSectionHeader(trimmed);

    if (sectionKey) {
      // Save the previous section before starting a new one
      if (currentKey) {
        result[currentKey] = currentLines.join("\n").trim();
      }
      currentKey = sectionKey;
      currentLines = [];
    } else if (currentKey) {
      currentLines.push(line);
    }
  }

  // Saves the last section
  if (currentKey) {
    result[currentKey] = currentLines.join("\n").trim();
  }

  return result;
}

// Splits a section's text into individual entry blocks, using blank lines as separators
function toBlocks(text: string): string[][] {
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of text.split("\n")) {
    if (!line.trim()) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(line.trim());
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// Extracts a year range like "2021 – 2025" or "2022 – Present" from a line of text
function extractYears(line: string): { startYear: string; endYear: string } | null {
  const match = line.match(/\b(20\d{2})\s*[-–—]\s*(20\d{2}|present)/i);
  if (!match) return null;

  const startYear = match[1];
  const endYear = match[2].toLowerCase() === "present" ? "present" : match[2];
  return { startYear, endYear };
}

// Extracts a month-year range like "Jun 2023 – Jan 2024" and returns values in YYYY-MM format
function extractMonthYear(text: string): { start: string; end: string } {
  const MONTHS: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };

  const pattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d{2})\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d{2}|present)/gi;
  const match = pattern.exec(text);

  if (!match) return { start: "", end: "" };

  const startMonth = MONTHS[match[1].toLowerCase().slice(0, 3)] ?? "01";
  const endMonth   = MONTHS[match[3].toLowerCase().slice(0, 3)] ?? "01";
  const startYear  = match[2];
  const endYear    = match[4];

  return {
    start: `${startYear}-${startMonth}`,
    end: endYear.toLowerCase() === "present" ? "" : `${endYear}-${endMonth}`,
  };
}

// Parses an education block into institution, degree, years, and GPA by pattern-matching each line
function parseEduBlock(lines: string[]): Omit<EducationItem, "id"> {
  let institution = "";
  let degree      = "";
  let startYear   = "";
  let endYear     = "";
  let gpa         = "";

  for (const line of lines) {
    const gpaMatch    = line.match(/gpa[:\s]+([0-9.]+)/i) || line.match(/\b([0-9]\.[0-9]+)\s*\/\s*4/i);
    const degreeMatch = line.match(/\b(bsc|bba|ba|ma|msc|mba|phd|bachelor|master|diploma|associate|b\.sc|m\.sc)/i);
    const yearRange   = extractYears(line);

    if (gpaMatch) {
      gpa = gpaMatch[1];
    } else if (yearRange) {
      startYear = yearRange.startYear;
      endYear   = yearRange.endYear;
    } else if (degreeMatch) {
      degree = line;
    } else if (!institution) {
      institution = line;
    }
  }

  return { institution, degree, startYear, endYear, gpa };
}

// Parses an experience / community / leadership block into title, org, dates, and bullet descriptions
function parseRoleBlock(lines: string[]): {
  title: string;
  org: string;
  startDate: string;
  endDate: string;
  description: string;
} {
  const firstLine = lines[0] ?? "";
  let title = "";
  let org   = "";

  // "Title — Organization" or "Title | Organization"
  const splitMatch = firstLine.match(/^(.+?)\s*[—–|]\s*(.+?)(?:\s*[\|(].*)?$/);
  if (splitMatch) {
    title = splitMatch[1].trim();
    org   = splitMatch[2].trim();
  } else {
    title = firstLine;
  }

  // Remove any trailing date that ended up in the org name
  org = org.replace(/\s*\(?.*(20\d{2}|present).*\)?$/i, "").trim();

  const { start, end } = extractMonthYear(lines.join(" "));

  const bullets = lines
    .slice(1)
    .filter((line) => !extractYears(line) && !extractMonthYear(line).start)
    .filter((line) => line.length > 2)
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);

  return {
    title,
    org,
    startDate: start,
    endDate: end,
    description: bullets.join("\n"),
  };
}

// Parses a single award line — extracts the year and strips it from the name
function parseAwardLine(line: string): Omit<AwardItem, "id"> {
  const yearMatch = line.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : "";
  const name = line
    .replace(/\(?20\d{2}\)?/g, "")
    .replace(/[-–,]/g, " ")
    .trim();

  return { name, year, description: "" };
}

/* Components */

// A section title, subtitle, and an "Add" button in a row
function SectionHeader({
  title,
  subtitle,
  onAdd,
  addLabel,
}: {
  title: string;
  subtitle: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{title}</div>
        <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      <button type="button" className="ghost-btn" onClick={onAdd}>
        + {addLabel}
      </button>
    </div>
  );
}

// Card wrapper for a single resume entry — shows a title and optional Remove button
function EntryCard({
  title,
  canRemove,
  onRemove,
  children,
}: {
  title: string;
  canRemove: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(255,255,255,0.70)", boxShadow: "0 6px 16px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800, color: "var(--navy)" }}>{title}</div>
        {canRemove && (
          <button
            type="button"
            className="ghost-btn"
            onClick={onRemove}
            style={{ borderColor: "rgba(239,68,68,0.30)", color: "#b91c1c" }}
          >
            Remove
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Two-column grid that collapses to one column on mobile
function TwoColGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="step3-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

// Labeled form field wrapper with optional hint text below the input
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

// Enter adds a skill, Backspace removes the last one
function SkillsInput({
  skills,
  onAdd,
  onRemove,
}: {
  skills: string[];
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  const [inputValue, setInputValue] = React.useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      onAdd(inputValue.trim());
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && skills.length > 0) {
      onRemove(skills[skills.length - 1]);
    }
  }

  return (
    /* (FigmaMake, 2025) */
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(255,255,255,0.70)", boxShadow: "0 6px 16px rgba(15,23,42,0.06)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {skills.map((skill) => (
          <span
            key={skill}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--blue)", color: "white", padding: "8px 10px", borderRadius: 12, fontWeight: 800, fontSize: 13 }}
          >
            {skill}
            <button
              type="button"
              onClick={() => onRemove(skill)}
              style={{ border: "none", background: "rgba(255,255,255,0.18)", color: "white", borderRadius: 999, cursor: "pointer", width: 22, height: 22, display: "grid", placeItems: "center", fontWeight: 900 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="input-wrap">
        <input
          className="input"
          placeholder="Type a skill and press Enter (e.g., Python, Leadership, Problem Solving)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
        Press Enter to add • Backspace to remove last tag
      </div>
    </div>
  );
}

// Returns true if at least one item has a non-empty value in any of the given fields
function hasEntry(items: any[], keyFields: string[]): boolean {
  return items.length > 0 && items.some((item) =>
    keyFields.some((field) => String(item[field] || "").trim().length > 0)
  );
}

/* Main component */

export function Step3Resume({ data, onUpdate, onNext, onBack, onSaveDraft }: Step3Props) {
  const [ocrText, setOcrText] = useState("");

  type ListKey = "education" | "experience" | "awards" | "community" | "leadership";

  // to add, remove, and update items in any list section
  function listAdd(key: ListKey, defaults: object) {
    const newItem = { id: uid(), ...defaults };
    const updatedList = [...(data[key] ?? []), newItem];
    onUpdate({ ...data, [key]: updatedList });
  }

  function listRemove(key: ListKey, id: string) {
    const list = data[key] ?? [];
    if (list.length <= 1) return; // always keep at least one entry
    onUpdate({ ...data, [key]: (list as any[]).filter((item) => item.id !== id) });
  }

  function listUpdate(key: ListKey, id: string, field: string, value: string) {
    const updated = (data[key] as any[]).map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onUpdate({ ...data, [key]: updated });
  }

  // Skills aarray so tey can be added/removed 
  function addSkill(skill: string) {
    if (skill && !data.skills.includes(skill)) {
      onUpdate({ ...data, skills: [...data.skills, skill] });
    }
  }

  function removeSkill(skill: string) {
    onUpdate({ ...data, skills: data.skills.filter((s) => s !== skill) });
  }

  // Each section must have at least one entry with a filled key field before the applicant can continue
  const hasValidEducation  = hasEntry(data.education,        ["institution"]);
  const hasValidExperience = hasEntry(data.experience,       ["jobTitle", "organization", "responsibilities"]);
  const hasValidSkills     = data.skills.length > 0;
  const hasValidAwards     = hasEntry(data.awards,           ["name"]);
  const hasValidCommunity  = hasEntry(data.community,        ["organization", "role"]);
  const hasValidLeadership = hasEntry(data.leadership ?? [], ["role", "organization"]);
  const canContinue = hasValidEducation && hasValidExperience && hasValidSkills && hasValidAwards && hasValidCommunity && hasValidLeadership;

  // Takes the OCR text, splits it into sections, parses each one, and fills the structured form fields
  function fillFieldsFromOcr() {
    const sections = splitIntoSections(ocrText);
    const updates: Partial<typeof data> = {};

    // No recognisable section headers — put everything into experience so nothing is lost
    if (Object.keys(sections).length === 0) {
      updates.experience = [{
        id: uid(),
        jobTitle: "",
        organization: "",
        startDate: "",
        endDate: "",
        responsibilities: ocrText.trim(),
      }];
      onUpdate({ ...data, ...updates });
      return;
    }

    if (sections.education) {
      const blocks = toBlocks(sections.education);
      if (blocks.length > 0) {
        updates.education = blocks.map((lines) => ({ id: uid(), ...parseEduBlock(lines) }));
      }
    }

    if (sections.experience) {
      const blocks = toBlocks(sections.experience);
      if (blocks.length > 0) {
        updates.experience = blocks.map((lines) => {
          const parsed = parseRoleBlock(lines);
          return {
            id: uid(),
            jobTitle: parsed.title,
            organization: parsed.org,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            responsibilities: parsed.description,
          };
        });
      }
    }

    if (sections.skills) {
      const tags = sections.skills
        .split(/[,;•|\n]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 1);
      updates.skills = [...new Set([...data.skills, ...tags])];
    }

    if (sections.awards) {
      const lines = sections.awards
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean);
      updates.awards = lines.map((line: string) => ({ id: uid(), ...parseAwardLine(line) }));
    }

    if (sections.community) {
      const blocks = toBlocks(sections.community);
      if (blocks.length > 0) {
        updates.community = blocks.map((lines) => {
          const parsed = parseRoleBlock(lines);
          return {
            id: uid(),
            organization: parsed.org || parsed.title,
            role: parsed.org ? parsed.title : "",
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            description: parsed.description,
          };
        });
      }
    }

    if (sections.leadership) {
      const blocks = toBlocks(sections.leadership);
      if (blocks.length > 0) {
        updates.leadership = blocks.map((lines) => {
          const parsed = parseRoleBlock(lines);
          return {
            id: uid(),
            role: parsed.title,
            organization: parsed.org,
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            description: parsed.description,
          };
        });
      }
    }

    onUpdate({ ...data, ...updates });
  }

  const leadership = data.leadership ?? [];

  return (
    /* (FigmaMake, 2026) */
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Page heading */}
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Step 3 of 6 — Resume / CV</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Upload your resume to extract text automatically, or fill in the structured fields below.
          Scored on: Community Service, Academic Achievement, Awards & Recognition, Skills & Certifications,
          Research & Work Experience, and Leadership & Extracurriculars.
        </div>
      </div>

      {/* OCR upload card */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Upload & Extract Text (PDF only)</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
          Upload a <strong>PDF</strong> of your resume — text will be extracted so you can review it and fill the fields below.
          Only text-based PDFs are supported.
        </div>

        <OcrUploader onExtract={setOcrText} buttonLabel="Upload PDF & Extract Text" />

        {ocrText && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>
              Extracted text — review and edit, then click Fill Fields:
            </label>
            <div className="input-wrap" style={{ alignItems: "stretch" }}>
              <textarea
                className="input"
                style={{ minHeight: 180, resize: "vertical" }}
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={fillFieldsFromOcr} className="primary-btn">
                Fill Fields from Extracted Text
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Structured form */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Structure Your Resume</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6, marginBottom: 6 }}>
          Fill in the fields below for each rubric category. Edit any fields pre-filled by OCR.
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.28)", color: "#92400e", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          All sections are required. If a section is not applicable to you, add one entry and type <strong>"NA"</strong> in the main field.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Academic Achievement */}
          <div>
            <SectionHeader
              title="Academic Achievement"
              subtitle="Education history, honours, and academic awards. Example: BIBF — Diploma in Business Studies (2020–2022)"
              onAdd={() => listAdd("education", { institution: "", degree: "", startYear: "", endYear: "" })}
              addLabel="Add Education"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(data.education ?? []).map((edu, idx) => (
                <EntryCard
                  key={edu.id}
                  title={`Entry ${idx + 1}`}
                  canRemove={(data.education ?? []).length > 1}
                  onRemove={() => listRemove("education", edu.id)}
                >
                  <TwoColGrid>
                    <Field id={`edu_inst_${edu.id}`} label="Institution">
                      <div className="input-wrap">
                        <input
                          id={`edu_inst_${edu.id}`}
                          className="input"
                          placeholder="Institution name"
                          value={edu.institution}
                          onChange={(e) => listUpdate("education", edu.id, "institution", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`edu_degree_${edu.id}`} label="Degree / Program">
                      <div className="input-wrap">
                        <input
                          id={`edu_degree_${edu.id}`}
                          className="input"
                          placeholder="Degree / Program"
                          value={edu.degree}
                          onChange={(e) => listUpdate("education", edu.id, "degree", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`edu_start_${edu.id}`} label="Start year">
                      <div className="input-wrap">
                        <select
                          id={`edu_start_${edu.id}`}
                          className="input"
                          value={edu.startYear}
                          onChange={(e) => listUpdate("education", edu.id, "startYear", e.target.value)}
                        >
                          <option value="" disabled>Select year</option>
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </Field>
                    <Field id={`edu_end_${edu.id}`} label="End year">
                      <div className="input-wrap">
                        <select
                          id={`edu_end_${edu.id}`}
                          className="input"
                          value={edu.endYear}
                          onChange={(e) => listUpdate("education", edu.id, "endYear", e.target.value)}
                        >
                          <option value="" disabled>Select year</option>
                          <option value="present">Present</option>
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </Field>
                  </TwoColGrid>
                </EntryCard>
              ))}
            </div>
          </div>

          {/* Research & Work Experience */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <SectionHeader
              title="Research & Work Experience"
              subtitle="Internships, research roles, part-time jobs, and professional experience."
              onAdd={() => listAdd("experience", { jobTitle: "", organization: "", startDate: "", endDate: "", responsibilities: "" })}
              addLabel="Add Experience"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(data.experience ?? []).map((exp, idx) => (
                <EntryCard
                  key={exp.id}
                  title={`Experience ${idx + 1}`}
                  canRemove={(data.experience ?? []).length > 1}
                  onRemove={() => listRemove("experience", exp.id)}
                >
                  <TwoColGrid>
                    <Field id={`exp_title_${exp.id}`} label="Job / Research title">
                      <div className="input-wrap">
                        <input
                          id={`exp_title_${exp.id}`}
                          className="input"
                          placeholder="Research Assistant, Intern…"
                          value={exp.jobTitle}
                          onChange={(e) => listUpdate("experience", exp.id, "jobTitle", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`exp_org_${exp.id}`} label="Organization / Lab">
                      <div className="input-wrap">
                        <input
                          id={`exp_org_${exp.id}`}
                          className="input"
                          placeholder="Organization or lab name"
                          value={exp.organization}
                          onChange={(e) => listUpdate("experience", exp.id, "organization", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`exp_start_${exp.id}`} label="Start date">
                      <div className="input-wrap">
                        <input
                          id={`exp_start_${exp.id}`}
                          className="input"
                          type="month"
                          value={exp.startDate}
                          onChange={(e) => listUpdate("experience", exp.id, "startDate", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`exp_end_${exp.id}`} label="End date">
                      <div className="input-wrap">
                        <input
                          id={`exp_end_${exp.id}`}
                          className="input"
                          type="month"
                          value={exp.endDate}
                          onChange={(e) => listUpdate("experience", exp.id, "endDate", e.target.value)}
                        />
                      </div>
                    </Field>
                  </TwoColGrid>
                  <Field id={`exp_resp_${exp.id}`} label="Key responsibilities / contributions" hint="Tip: write one bullet per line">
                    <div className="input-wrap" style={{ alignItems: "stretch" }}>
                      <textarea
                        id={`exp_resp_${exp.id}`}
                        className="input"
                        style={{ minHeight: 110, resize: "vertical" }}
                        placeholder={"One per line:\n• Developed ML model for sentiment analysis\n• Published findings in campus journal"}
                        value={exp.responsibilities}
                        onChange={(e) => listUpdate("experience", exp.id, "responsibilities", e.target.value)}
                      />
                    </div>
                  </Field>
                </EntryCard>
              ))}
            </div>
          </div>

          {/* Skills & Certifications */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>Skills & Certifications</div>
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              Technical skills, languages, software, and certifications. Examples: Python, AWS Certified, Arabic, Leadership.
              If not applicable, type "NA" and press Enter.
            </div>
            <SkillsInput skills={data.skills} onAdd={addSkill} onRemove={removeSkill} />
          </div>

          {/* Awards & Recognition */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <SectionHeader
              title="Awards & Recognition"
              subtitle="Scholarships, competition prizes, honours, and other recognitions. Example: Best Capstone Award 2023"
              onAdd={() => listAdd("awards", { name: "", year: "", description: "" })}
              addLabel="Add Award"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(data.awards ?? []).map((award, idx) => (
                <EntryCard
                  key={award.id}
                  title={`Award ${idx + 1}`}
                  canRemove={(data.awards ?? []).length > 1}
                  onRemove={() => listRemove("awards", award.id)}
                >
                  <TwoColGrid>
                    <Field id={`award_name_${award.id}`} label="Award / Prize name">
                      <div className="input-wrap">
                        <input
                          id={`award_name_${award.id}`}
                          className="input"
                          placeholder="Dean's List, National Science Olympiad…"
                          value={award.name}
                          onChange={(e) => listUpdate("awards", award.id, "name", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`award_year_${award.id}`} label="Year">
                      <div className="input-wrap">
                        <input
                          id={`award_year_${award.id}`}
                          className="input"
                          type="number"
                          placeholder="Year"
                          value={award.year}
                          onChange={(e) => listUpdate("awards", award.id, "year", e.target.value)}
                        />
                      </div>
                    </Field>
                  </TwoColGrid>
                  <Field id={`award_desc_${award.id}`} label="Short description">
                    <div className="input-wrap">
                      <input
                        id={`award_desc_${award.id}`}
                        className="input"
                        placeholder="Brief description of the award and its significance"
                        value={award.description}
                        onChange={(e) => listUpdate("awards", award.id, "description", e.target.value)}
                      />
                    </div>
                  </Field>
                </EntryCard>
              ))}
            </div>
          </div>

          {/* Community Service */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <SectionHeader
              title="Community Service"
              subtitle="Volunteer work, social impact initiatives, and community contributions. Example: Bahrain Red Crescent — donation drives"
              onAdd={() => listAdd("community", { organization: "", role: "", startDate: "", endDate: "", description: "" })}
              addLabel="Add Community Work"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(data.community ?? []).map((comm, idx) => (
                <EntryCard
                  key={comm.id}
                  title={`Entry ${idx + 1}`}
                  canRemove={(data.community ?? []).length > 1}
                  onRemove={() => listRemove("community", comm.id)}
                >
                  <TwoColGrid>
                    <Field id={`comm_org_${comm.id}`} label="Organization">
                      <div className="input-wrap">
                        <input
                          id={`comm_org_${comm.id}`}
                          className="input"
                          placeholder="Organization"
                          value={comm.organization}
                          onChange={(e) => listUpdate("community", comm.id, "organization", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`comm_role_${comm.id}`} label="Role">
                      <div className="input-wrap">
                        <input
                          id={`comm_role_${comm.id}`}
                          className="input"
                          placeholder="Role"
                          value={comm.role}
                          onChange={(e) => listUpdate("community", comm.id, "role", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`comm_start_${comm.id}`} label="Start date">
                      <div className="input-wrap">
                        <input
                          id={`comm_start_${comm.id}`}
                          className="input"
                          type="month"
                          value={comm.startDate}
                          onChange={(e) => listUpdate("community", comm.id, "startDate", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`comm_end_${comm.id}`} label="End date">
                      <div className="input-wrap">
                        <input
                          id={`comm_end_${comm.id}`}
                          className="input"
                          type="month"
                          value={comm.endDate}
                          onChange={(e) => listUpdate("community", comm.id, "endDate", e.target.value)}
                        />
                      </div>
                    </Field>
                  </TwoColGrid>
                  <Field id={`comm_desc_${comm.id}`} label="Description & impact">
                    <div className="input-wrap" style={{ alignItems: "stretch" }}>
                      <textarea
                        id={`comm_desc_${comm.id}`}
                        className="input"
                        style={{ minHeight: 110, resize: "vertical" }}
                        placeholder="Describe your contribution, number of people helped, and overall impact"
                        value={comm.description}
                        onChange={(e) => listUpdate("community", comm.id, "description", e.target.value)}
                      />
                    </div>
                  </Field>
                </EntryCard>
              ))}
            </div>
          </div>

          {/* Leadership & Extracurriculars */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <SectionHeader
              title="Leadership & Extracurriculars"
              subtitle="Club leadership, student government, sports, cultural activities, and other extracurriculars."
              onAdd={() => listAdd("leadership", { role: "", organization: "", startDate: "", endDate: "", description: "" })}
              addLabel="Add Entry"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {leadership.map((entry, idx) => (
                <EntryCard
                  key={entry.id}
                  title={`Entry ${idx + 1}`}
                  canRemove={leadership.length > 1}
                  onRemove={() => listRemove("leadership", entry.id)}
                >
                  <TwoColGrid>
                    <Field id={`lead_role_${entry.id}`} label="Role / Position">
                      <div className="input-wrap">
                        <input
                          id={`lead_role_${entry.id}`}
                          className="input"
                          placeholder="President, Captain, Founder…"
                          value={entry.role}
                          onChange={(e) => listUpdate("leadership", entry.id, "role", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`lead_org_${entry.id}`} label="Club / Organization">
                      <div className="input-wrap">
                        <input
                          id={`lead_org_${entry.id}`}
                          className="input"
                          placeholder="Debate Club, Basketball Team…"
                          value={entry.organization}
                          onChange={(e) => listUpdate("leadership", entry.id, "organization", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`lead_start_${entry.id}`} label="Start date">
                      <div className="input-wrap">
                        <input
                          id={`lead_start_${entry.id}`}
                          className="input"
                          type="month"
                          value={entry.startDate}
                          onChange={(e) => listUpdate("leadership", entry.id, "startDate", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field id={`lead_end_${entry.id}`} label="End date">
                      <div className="input-wrap">
                        <input
                          id={`lead_end_${entry.id}`}
                          className="input"
                          type="month"
                          value={entry.endDate}
                          onChange={(e) => listUpdate("leadership", entry.id, "endDate", e.target.value)}
                        />
                      </div>
                    </Field>
                  </TwoColGrid>
                  <Field id={`lead_desc_${entry.id}`} label="Description & achievements">
                    <div className="input-wrap" style={{ alignItems: "stretch" }}>
                      <textarea
                        id={`lead_desc_${entry.id}`}
                        className="input"
                        style={{ minHeight: 110, resize: "vertical" }}
                        placeholder="Describe your responsibilities, accomplishments, and leadership impact"
                        value={entry.description}
                        onChange={(e) => listUpdate("leadership", entry.id, "description", e.target.value)}
                      />
                    </div>
                  </Field>
                </EntryCard>
              ))}
              {leadership.length === 0 && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => listAdd("leadership", { role: "", organization: "", startDate: "", endDate: "", description: "" })}
                  style={{ alignSelf: "flex-start" }}
                >
                  + Add Leadership Entry
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="ghost-btn" onClick={onBack}>← Back</button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {!canContinue && (
            <div style={{ fontSize: 13, color: "#92400e", fontWeight: 600, textAlign: "right" }}>
              {!hasValidEducation  && "Education: add at least one entry. "}
              {!hasValidExperience && "Experience: add at least one entry (or \"NA\"). "}
              {!hasValidSkills     && "Skills: add at least one skill (or \"NA\"). "}
              {!hasValidAwards     && "Awards: add at least one entry (or \"NA\"). "}
              {!hasValidCommunity  && "Community: add at least one entry (or \"NA\"). "}
              {!hasValidLeadership && "Leadership: add at least one entry (or \"NA\")."}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="ghost-btn" onClick={onSaveDraft}>Save Draft</button>
            <button
              type="button"
              className="primary-btn primary-btn-lg"
              onClick={onNext}
              disabled={!canContinue}
              style={!canContinue ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .step3-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

    </div>
  );
}
