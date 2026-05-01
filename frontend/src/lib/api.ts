import { supabase } from "./supabase";

// VITE_NODE_API   — Railway backend (set in Vercel project env vars)
// VITE_PYTHON_API — Modal AI scorer (set in Vercel project env vars)
export const NODE_API   = import.meta.env.VITE_NODE_API   || "http://localhost:5000";
const        PYTHON_API = import.meta.env.VITE_PYTHON_API || "http://localhost:8000";

// Adds the current user's auth token to every Railway backend request
export async function adminFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(`${NODE_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}

type ScoredApplicant = {
  personalStatement: { score: Record<string, unknown> } | null;
  resume: { score: Record<string, unknown> } | null;
};

// Averages the personal statement and resume AI scores into a single 0-100 number
export function toLlmScore(a: ScoredApplicant): number | null {
  const scores: number[] = [];
  if (a.personalStatement?.score?.overall_score != null)
    scores.push(a.personalStatement.score.overall_score as number);
  if (a.resume?.score?.overall_score != null)
    scores.push(((a.resume.score.overall_score as number) / 180) * 100);
  if (!scores.length) return null;
  return Math.round(scores.reduce((x, y) => x + y, 0) / scores.length);
}

// Sends a POST request to a given base URL with optional Bearer token auth
async function post(baseUrl: string, path: string, data: unknown, token: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Sends the personal statement to the Modal AI scorer, then saves the result to the Railway backend.
// If Modal is down, submission still saves without a score.
export async function scorePersonalStatement(data: unknown, name?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be logged in to submit your application.");

  const { user: { id: applicantId } } = session;

  let score = null;
  try {
    score = await post(PYTHON_API, "/score/personal-statement", data, null);
  } catch {
    // Modal scorer may be unavailable — continue to save without score
  }

  const saved = await adminFetch("/applicants/submit/personal-statement", {
    method: "POST",
    body: JSON.stringify({ applicantId, name: name || undefined, input: data, score: score ?? {} }),
  }).then((r) => r.json());

  return { score, saved };
}

// Sends the resume text to the Modal AI scorer, then saves the result to the Railway backend.
// If Modal is down, submission still saves without a score.
export async function scoreResume(resumeText: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("You must be logged in to submit your application.");

  const { user: { id: applicantId } } = session;

  let score = null;
  try {
    score = await post(PYTHON_API, "/score/resume", { resume_text: resumeText }, null);
  } catch {
    // Modal scorer may be unavailable — continue to save without score
  }

  const saved = await adminFetch("/applicants/submit/resume", {
    method: "POST",
    body: JSON.stringify({ applicantId, input: { resume_text: resumeText }, score: score ?? {} }),
  }).then((r) => r.json());

  return { score, saved };
}
