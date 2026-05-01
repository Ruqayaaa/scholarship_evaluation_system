// Step 1 of the application form: Personal Information
import React from "react";
import { InfoCard } from "./InfoCard";

// Info data needs: name, date of birth, country, chosen major, school, GPA, graduation year, IELTS score.
export type PersonalInfoData = {
  fullName: string;
  dateOfBirth: string;
  country: string;
  chosenMajor: string;
  school: string;
  gpa: string;
  graduationYear: string;
  ieltsScore: string;
};

// requires: the current data, update function, next step function, and save draft function
type Step1Props = {
  data: PersonalInfoData;
  onUpdate: (next: PersonalInfoData) => void;
  onNext: () => void;
  onSaveDraft: () => void;
};

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
      {hint ? <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{hint}</div> : null}
    </div>
  );
}

// parse GPA input 
function parseGpaNum(raw: string): { num: number; isPct: boolean } | null {
  const v = raw.trim();
  if (!v) return null;
  const isPct = v.endsWith("%");
  const num = parseFloat(isPct ? v.slice(0, -1) : v);
  if (isNaN(num)) return null;
  // Auto-detect: > 4.0 without % sign → treat as percentage
  return { num, isPct: isPct || num > 4.0 };
}

// checks if the GPA is in a valid format 
function isValidGpa(raw: string): boolean {
  const p = parseGpaNum(raw);
  if (!p) return false;
  return p.isPct ? p.num >= 0 && p.num <= 100 : p.num >= 0 && p.num <= 4.0;
}

// Eligibility: 90% or 3.6/4.0 equivalent
function isEligibleGpa(raw: string): boolean {
  const p = parseGpaNum(raw);
  if (!p) return false;
  return p.isPct ? p.num >= 90 : p.num >= 3.6;
}


export function Step1PersonalInfo({ data, onUpdate, onNext, onSaveDraft }: Step1Props) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => String(currentYear + i));

  // update a specific field in the personal info data when an input changes
  const setField = <K extends keyof PersonalInfoData>(field: K, value: string) => {
    onUpdate({ ...data, [field]: value });
  };

  // required fields for validation to ensure all necessary information is provided before allowing the applicant to proceed to the next step of the application 
  const requiredFields: (keyof PersonalInfoData)[] = [
    "fullName",
    "dateOfBirth",
    "country",
    "chosenMajor",
    "school",
    "gpa",
    "graduationYear",
    "ieltsScore",
  ];

  // check if all required fields are filled and if GPA and IELTS scores meet the eligibility criteria to enable the "Next" button for proceeding to the next step of the application form
  const allFilled = requiredFields.every((k) => String(data[k]).trim().length > 0);
  const ieltsNum = parseFloat(data.ieltsScore);
  const ieltsOk = !data.ieltsScore || isNaN(ieltsNum) || ieltsNum >= 6.0;
  const gpaFilled = data.gpa.trim().length > 0;
  const gpaFormatOk   = !gpaFilled || isValidGpa(data.gpa);
  const gpaEligible   = !gpaFilled || isEligibleGpa(data.gpa);
  const canContinue = allFilled && !isNaN(ieltsNum) && ieltsNum >= 6.0 && gpaFilled && isValidGpa(data.gpa) && isEligibleGpa(data.gpa);

  return (
    /* (FigmaMake 2025) */

    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>
          Step 1 of 6 — Personal Information
        </div>
        <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Tell us a bit about yourself. These details help us verify eligibility.
        </div>
      </div>

      {/* Main Card */}
      <div className="card" style={{ width: "100%" }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 14 }}>
          Applicant Information
        </div>

        <form className="form" onSubmit={(e) => e.preventDefault()}>
          {/* Personal Information */}
          <div>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Personal Information</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <Field id="fullName" label="Full Name *">
                <div className="input-wrap">
                  <input
                    id="fullName"
                    className="input"
                    placeholder="Enter your full name"
                    value={data.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                  />
                </div>
              </Field>

              <Field id="dob" label="Date of Birth *">
                <div className="input-wrap">
                  <input
                    id="dob"
                    className="input"
                    type="date"
                    value={data.dateOfBirth}
                    onChange={(e) => setField("dateOfBirth", e.target.value)}
                  />
                </div>
              </Field>

              <Field id="country" label="Country *">
                <div className="input-wrap">
                  <input
                    id="country"
                    className="input"
                    placeholder="e.g., Bahrain, United States"
                    value={data.country}
                    onChange={(e) => setField("country", e.target.value)}
                  />
                </div>
              </Field>
            </div>
          </div>

          {/* Academic Information */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 6 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Academic Information</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <Field id="chosenMajor" label="Chosen Major *">
                <div className="input-wrap">
                  <input
                    id="chosenMajor"
                    className="input"
                    placeholder="e.g., Computer Science, Business Administration"
                    value={data.chosenMajor}
                    onChange={(e) => setField("chosenMajor", e.target.value)}
                  />
                </div>
              </Field>

              <Field id="university" label="School Name *">
                <div className="input-wrap">
                  <input
                    id="university"
                    className="input"
                    placeholder="Enter your school name"
                    value={data.school}
                    onChange={(e) => setField("school", e.target.value)}
                  />
                </div>
              </Field>

              <Field
                id="gpa"
                label="GPA *"
                hint="Decimal: 3.6–4.0 · Percentage: 90–100 (e.g., 90 or 90%) · Minimum 90% required"
              >
                <div className="input-wrap">
                  <input
                    id="gpa"
                    className="input"
                    placeholder="e.g., 3.8 or 90%"
                    value={data.gpa}
                    onChange={(e) => setField("gpa", e.target.value)}
                    style={gpaFilled && (!gpaFormatOk || !gpaEligible) ? { borderColor: "#ef4444" } : undefined}
                  />
                </div>
                {gpaFilled && !gpaFormatOk && (
                  <div style={{ color: "#ef4444", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                    Invalid GPA format. Use decimal (e.g., 3.8) or percentage (e.g., 90 or 90%).
                  </div>
                )}
                {gpaFilled && gpaFormatOk && !gpaEligible && (
                  <div style={{ color: "#ef4444", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                    GPA does not meet the minimum requirement of 90% (or 3.6/4.0). You must have a GPA of 90% or above to be eligible.
                  </div>
                )}
              </Field>

              <Field id="gradYear" label="Expected Graduation Year *">
                <div className="input-wrap">
                  <select
                    id="gradYear"
                    className="input"
                    value={data.graduationYear}
                    onChange={(e) => setField("graduationYear", e.target.value)}
                  >
                    <option value="" disabled>
                      Select year
                    </option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>

              <Field
                id="ieltsScore"
                label="IELTS Overall Score *"
                hint="Minimum required overall score: 6.0. Example: 6.5"
              >
                <div className="input-wrap">
                  <input
                    id="ieltsScore"
                    className="input"
                    type="number"
                    step="0.5"
                    min="0"
                    max="9"
                    placeholder="e.g., 6.5"
                    value={data.ieltsScore}
                    onChange={(e) => setField("ieltsScore", e.target.value)}
                    style={data.ieltsScore && !ieltsOk ? { borderColor: "#ef4444" } : undefined}
                  />
                </div>
                {data.ieltsScore && !ieltsOk && (
                  <div style={{ color: "#ef4444", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                    IELTS score must be 6.0 or above to be eligible.
                  </div>
                )}
              </Field>
            </div>
          </div>
        </form>
      </div>

      {/* Eligibility Info */}
      <InfoCard type="info">
        <p style={{ margin: 0, fontWeight: 900 }}>
          To qualify for the AUBH Scholarship, students must have:
        </p>
        <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>A GPA of 90% or higher</li>
          <li>An IELTS score of 6.0+ with no band below 5</li>
          <li>Strong personal and academic achievements</li>
        </ul>
      </InfoCard>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <button type="button" className="ghost-btn" onClick={onSaveDraft}>
          Save Draft
        </button>

        <button
          className="primary-btn"
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          style={!canContinue ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
          title={
            !allFilled
              ? "Please fill all required fields"
              : !gpaFormatOk
              ? "Enter a valid GPA (decimal 0–4.0 or percentage 0–100)"
              : !gpaEligible
              ? "GPA must be 90% or above (3.6/4.0) to be eligible"
              : !ieltsOk
              ? "IELTS score must be 6.0 or above"
              : undefined
          }
        >
          Next →
        </button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .step1-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
