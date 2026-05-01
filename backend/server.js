import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import archiver from "archiver";
import "dotenv/config";
import { createLogger, format, transports } from "winston";

// express application instance 
const app = express();
//port server listened on - local (for deployment to fall back)
const PORT = process.env.PORT || 5000;

//log setup - using winston library
// https://github.com/winstonjs/winston
const logger = createLogger({
   // only at info severity and above
  level: process.env.LOG_LEVEL || "info",
    //sends logs to terminal 
  transports: [
    new transports.Console({
       // to follow a specidic template for log messages 
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      ),
    }),
  ],
});

// Supabase client setup
// https://supabase.com/docs/guides/auth/jwts
// https://supabase.com/docs/guides/functions/auth-legacy-jwt
// "super client": can bypass all RLS policies for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// "logged-in user": need to provide their JWT token and RLS policies apply to them 
function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/* MIDDLEWARE */

//security headers 
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || /^https:\/\/.*\.vercel\.app$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// size limit parser
app.use(express.json({ limit: "50mb" }));

// request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// General rate limit: 200 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(generalLimiter);

// Stricter limit for submission endpoints
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Submission rate limit exceeded. Please wait a moment." },
});

//  Authentication Middleware 
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid or expired token." });

  req.user = user;
  next();
}

// (Helper) checks what role the user has and if they have the right role to access the endpoint
async function loadProfile(userId) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data;
}

// checks what each role is allowed (for when requesting a specific routes)
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required." });
    const profile = await loadProfile(req.user.id);
    if (!profile || !roles.includes(profile.role)) {
      logger.warn(`Unauthorized access attempt by user ${req.user.id} (role: ${profile?.role}) to ${req.path}`);
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    req.userRole = profile.role;
    next();
  };
}

//middleware arrays for different levels of access control
const requireAdmin = [authenticate, requireRole("admin")];
const requireReviewer = [authenticate, requireRole("reviewer", "admin")];

// Scores for personal statement & resume 
const PS_KEYS = [
  "interests_and_values",
  "academic_commitment",
  "clarity_of_vision",
  "organization",
  "language_quality",
];

const RESUME_KEYS = [
  "academic_achievement",
  "leadership_and_extracurriculars",
  "community_service",
  "research_and_work_experience",
  "skills_and_certifications",
  "awards_and_recognition",
];

// Normalize PS & RESUME scores so they are on the same scale (/100)
function normalizePsScore(score) {
  if (!score || typeof score !== "object") return score;
  let flat = { ...score };
  if (flat.criteria && typeof flat.criteria === "object") {
    flat = { ...flat, ...flat.criteria };
  }
  const total = PS_KEYS.reduce((sum, k) => sum + (Number(flat[k]) || 0), 0);
  if (total > 0) {
    flat.overall_score = total;
    flat.grade_pct = parseFloat(((total / 150) * 100).toFixed(1));
  }
  return flat;
}

function normalizeResumeScore(score) {
  if (!score || typeof score !== "object") return score;
  const flat = { ...score };
  const total = RESUME_KEYS.reduce((sum, k) => sum + (Number(flat[k]) || 0), 0);
  if (total > 0) {
    flat.overall_score = total;
    flat.grade_pct = parseFloat(((total / 180) * 100).toFixed(1));
  }
  return flat;
}

// extracts applicant row from the database and puts it in a suitable format for the frontend 
async function toApplicantShape(app, db = supabase) {
  const [{ data: assignments }, { data: profile }, { data: evaluations }] = await Promise.all([
    db.from("reviewer_assignments").select("reviewer_id").eq("application_id", app.id),
    db.from("profiles").select("name").eq("id", app.applicant_id).single(),
    db.from("reviewer_evaluations").select("*").eq("application_id", app.id),
  ]);

  const psInput = app.personal_statement_input || {}; 
  const portfolioUrl = psInput._portfolio_url || null;
  const portfolioName = psInput._portfolio_name || null;
  const interviewAt = psInput._interview_at || null;
  const interviewMessage = psInput._interview_message || "";
  const decisionVisible = psInput._decision_visible === true;
  const docs = psInput._documents || null;

  return {
    id: app.id,
    applicantId: app.applicant_id,
    cycleId: app.cycle_id || null,
    name: profile?.name || "Applicant",
    submittedAt: app.submitted_at || app.created_at,
    status: app.status,
    finalDecision: app.final_decision || "Pending",
    decisionNotes: app.decision_notes || "",
    decisionAt: app.decision_at || null,
    decisionVisible,
    interviewAt,
    interviewMessage,
    assignedReviewerIds: assignments?.map((a) => a.reviewer_id) || [],
    reviewerEvaluations: evaluations || [],
    personalStatement: app.personal_statement_input
      ? {
          input: app.personal_statement_input,
          score: normalizePsScore(app.personal_statement_score) || {},
        }
      : null,
    resume: app.resume_input
      ? {
          input: app.resume_input,
          score: normalizeResumeScore(app.resume_score) || {},
        }
      : null,
    portfolio: portfolioUrl
      ? {
          summary: portfolioName || "Portfolio",
          items: [{ title: portfolioName || "Portfolio", description: "", url: portfolioUrl }],
        }
      : null,
    documents: docs || null,
  };
}

// takes the rows in db and converts them to be placed in a csv 
function toCSV(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

// determines which database client it is based on user token 
function reqDb(req) {
  const token = req.headers.authorization?.split(" ")[1];
  return token ? userClient(token) : supabase;
}

// adds a application record for an applicant (inserts or updates)
async function upsertApplication(db, applicantId, fields) {
  // finds the active cycle 
  const { data: activeCycle } = await supabase
    .from("cycles").select("id").eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const cycleId = activeCycle?.id || null;

  // checks if there is an application or not
  let q = db.from("applications").select("id").eq("applicant_id", applicantId);
  q = cycleId ? q.eq("cycle_id", cycleId) : q.is("cycle_id", null);
  const { data: existing } = await q.maybeSingle();
  // if it exists, updates the existing row 
  if (existing) {
    const { data, error } = await db.from("applications")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", existing.id).select().single();
    if (error) throw error;
    return data;
  // creates a new application if not found 
  } else {
    const { data, error } = await db.from("applications")
      .insert({ applicant_id: applicantId, cycle_id: cycleId, submitted_at: new Date().toISOString(), ...fields })
      .select().single();
    if (error) throw error;
    return data;
  }
}

// (helper) consistent format for logs
function auditLog(action, userId, details = {}) {
  logger.info(`AUDIT: ${action}`, { userId, ...details });
}

/* ENDPOINTS */
//https://supabase.com/docs/reference/javascript/select
//https://supabase.com/docs/reference/javascript/insert
//https://supabase.com/docs/reference/javascript/update
//https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
//https://supabase.com/docs/reference/javascript/db-csv

/* (APPLICANT) */

/* (Claude Code, 2026) 
I want a skeleton code for endpoints to do the following: 
1. (app.get) getting applicaton: must get it from the current active cycle, if a decision has been made (visible/hidden) based on admin 
2. (app.patch) retrieving saved data: saves application draft to current cycle only if it exists 
3. (app.post) submit personal statement with score, updates application status 
4. (app.post) submit resume with score, updates application status 
5. (app.post) accepts URL & file, needs to be saved in supabase storage 
6. (app.post) needs to be able to accept multiple uploads categorized by section and store them 
*/

/* 
- fetches the applicant application from the active cycle 
- hides decision notes unless admin makes it visible 
*/
app.get("/applicants/:applicantId/application", authenticate, async (req, res) => {
  try {
    const { data: activeCycle, error: cycleErr } = await supabase
      .from("cycles").select("id").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (cycleErr || !activeCycle?.id) return res.json(null);

    const { data, error } = await supabase
      .from("applications").select("*")
      .eq("applicant_id", req.params.applicantId)
      .eq("cycle_id", activeCycle.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    const shaped = await toApplicantShape(data);

    if (!shaped.decisionVisible) {
      shaped.finalDecision = null;
      shaped.decisionNotes = null;
    }
    res.json(shaped);
  } catch (err) {
    logger.error("Error fetching applicant application", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- saves draft of application (only if application has not been submitted)
 */
app.patch("/applicants/:applicantId/draft", authenticate, async (req, res) => {
  try {
    const { draftData } = req.body;
    const { applicantId } = req.params;
    if (!applicantId) return res.status(400).json({ error: "applicantId required" });

    const db = reqDb(req);

    const { data: activeCycle } = await supabase
      .from("cycles").select("id").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const cycleId = activeCycle?.id || null;

    let q = db.from("applications").select("id, status").eq("applicant_id", applicantId);
    q = cycleId ? q.eq("cycle_id", cycleId) : q.is("cycle_id", null);
    const { data: existing } = await q.maybeSingle();

    if (existing?.status && existing.status !== "Draft") {
      return res.json({ ok: true, skipped: true });
    }

    const fields = {
      personal_statement_input: { _draft: draftData },
      status: "Draft",
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await db.from("applications").update(fields).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("applications")
        .insert({ applicant_id: applicantId, cycle_id: cycleId, ...fields });
      if (error) throw error;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error("Error saving draft", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/*
- submits personal statement and its score
- updated application with submitted status
*/
app.post("/applicants/submit/personal-statement", authenticate, submitLimiter, async (req, res) => {
  try {
    const { applicantId, input, score, name } = req.body;
    if (!applicantId) return res.status(400).json({ error: "applicantId required" });
    const db = reqDb(req);
    if (name) await db.from("profiles").update({ name }).eq("id", applicantId);
    const data = await upsertApplication(db, applicantId, {
      personal_statement_input: input,
      personal_statement_score: score,
      status: "Submitted",
    });
    auditLog("SUBMIT_PERSONAL_STATEMENT", applicantId);
    res.json({ ok: true, applicant: await toApplicantShape(data, db) });
  } catch (err) {
    logger.error("Error submitting personal statement", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/*
- submits resume and its score
- updated application with submitted status  
*/
app.post("/applicants/submit/resume", authenticate, submitLimiter, async (req, res) => {
  try {
    const { applicantId, input, score } = req.body;
    if (!applicantId) return res.status(400).json({ error: "applicantId required" });
    const db = reqDb(req);
    const data = await upsertApplication(db, applicantId, {
      resume_input: input,
      resume_score: score,
      status: "Submitted",
    });
    auditLog("SUBMIT_RESUME", applicantId);
    res.json({ ok: true, applicant: await toApplicantShape(data, db) });
  } catch (err) {
    logger.error("Error submitting resume", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/*
- accepts a file/URL 
- if file uploads it to supabase storage, if URL stores URL  
*/
app.post("/applicants/submit/portfolio", authenticate, async (req, res) => {
  try {
    const { applicantId, portfolioUrl: clientUrl, portfolioName: clientName,
            fileData, fileName, mimeType } = req.body;
    if (!applicantId) return res.status(400).json({ error: "applicantId required" });
    if (!clientUrl && !fileData) return res.status(400).json({ error: "fileData or portfolioUrl required" });

    let finalUrl = clientUrl || null;
    let finalName = clientName || fileName || "Portfolio";

    if (fileData && fileName) {
      const buffer = Buffer.from(fileData, "base64");
      const path = `${applicantId}/${Date.now()}_${fileName}`;

      await supabase.storage.createBucket("portfolios", { public: true }).catch(() => {});

      const { error: uploadErr } = await supabase.storage
        .from("portfolios")
        .upload(path, buffer, { contentType: mimeType || "application/octet-stream", upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("portfolios").getPublicUrl(path);
      finalUrl = urlData.publicUrl;
      finalName = fileName;
    }

    const { data: activeCycle } = await supabase
      .from("cycles").select("id").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    let q = supabase.from("applications").select("id, personal_statement_input")
      .eq("applicant_id", applicantId);
    q = activeCycle?.id ? q.eq("cycle_id", activeCycle.id) : q.is("cycle_id", null);
    const { data: existing, error: findErr } = await q.maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "No application found for this applicant" });

    const updatedInput = {
      ...(existing.personal_statement_input || {}),
      _portfolio_url: finalUrl,
      _portfolio_name: finalName,
    };

    const { error: updateErr } = await supabase
      .from("applications")
      .update({ personal_statement_input: updatedInput, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateErr) throw updateErr;

    res.json({ ok: true, portfolioUrl: finalUrl });
  } catch (err) {
    logger.error("Error submitting portfolio", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/*
- uploading categorized documents   
*/
app.post("/applicants/submit/documents", authenticate, async (req, res) => {
  try {
    const { applicantId, documents } = req.body;
    if (!applicantId) return res.status(400).json({ error: "applicantId required" });
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.json({ ok: true, message: "No documents to upload" });
    }

    await supabase.storage.createBucket("documents", { public: false }).catch(() => {});

    const uploadedDocs = {};

    for (const doc of documents) {
      const { category, fileData, fileName, mimeType } = doc;
      if (!fileData || !fileName || !category) continue;

      const buffer = Buffer.from(fileData, "base64");
      const path = `${applicantId}/${category}/${Date.now()}_${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, buffer, { contentType: mimeType || "application/octet-stream", upsert: true });

      if (uploadErr) {
        logger.warn(`Failed to upload document ${fileName}`, { error: uploadErr.message });
        continue;
      }

      const { data: signedData } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, 60 * 60 * 24);

      if (!uploadedDocs[category]) uploadedDocs[category] = [];
      uploadedDocs[category].push({
        name: fileName,
        path,
        url: signedData?.signedUrl || null,
        uploadedAt: new Date().toISOString(),
      });
    }

    const { data: activeCycle } = await supabase
      .from("cycles").select("id").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    let q = supabase.from("applications").select("id, personal_statement_input")
      .eq("applicant_id", applicantId);
    q = activeCycle?.id ? q.eq("cycle_id", activeCycle.id) : q.is("cycle_id", null);
    const { data: existing, error: findErr } = await q.maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "No application found" });

    const updatedInput = {
      ...(existing.personal_statement_input || {}),
      _documents: uploadedDocs,
    };

    const { error: updateErr } = await supabase
      .from("applications")
      .update({ personal_statement_input: updatedInput, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateErr) throw updateErr;

    auditLog("SUBMIT_DOCUMENTS", applicantId, { categories: Object.keys(uploadedDocs) });
    res.json({ ok: true, documents: uploadedDocs });
  } catch (err) {
    logger.error("Error submitting documents", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/*(ADMIN) */

/* (Claude Code, 2026) 
Using (app.get) I need to be able to view submitted document from a different view. 
In supabase the uploaded documents were stored using signed URLs
*/

/*
- Retrieves URL for applicant documents to be able to retrieve from admin
*/
app.get("/admin/applicants/:id/documents/refresh", ...requireAdmin, async (req, res) => {
  try {
    const { data: app, error } = await supabase
      .from("applications")
      .select("personal_statement_input")
      .eq("id", req.params.id)
      .single();
    if (error || !app) return res.status(404).json({ error: "Not found" });

    const docs = app.personal_statement_input?._documents;
    if (!docs) return res.json({ documents: {} });

    const refreshed = {};
    for (const [category, files] of Object.entries(docs)) {
      refreshed[category] = await Promise.all(
        files.map(async (f) => {
          if (!f.path) return f;
          const { data: signedData } = await supabase.storage
            .from("documents")
            .createSignedUrl(f.path, 60 * 60 * 24);
          return { ...f, url: signedData?.signedUrl || f.url };
        })
      );
    }

    res.json({ documents: refreshed });
  } catch (err) {
    logger.error("Error refreshing document URLs", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* (Claude Code, 2026) 
I want to create a endpoint that does the following: 
1. (app.get) to get the existing cycles to put in a list 
2. (app.post) to create a new cycle 
3. (app.patch) to change a cycle status to archive 
4. (app.get) to get a zip file with a .csv of (applications & scores)
*/

/* Gets the existing cycles (in order new to old) */
app.get("/admin/cycles", ...requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cycles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    logger.error("Error listing cycles", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* Creates a new cycle with a name */
app.post("/admin/cycles", ...requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const { data, error } = await supabase
      .from("cycles")
      .insert({ name: name.trim() })
      .select()
      .single();
    if (error) throw error;
    auditLog("CREATE_CYCLE", req.user.id, { name: name.trim() });
    res.json({ ok: true, cycle: data });
  } catch (err) {
    logger.error("Error creating cycle", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* Changes cycle status to archive, adds a ended_at record */
app.patch("/admin/cycles/:id/end", ...requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cycles")
      .update({ status: "archived", ended_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    auditLog("END_CYCLE", req.user.id, { cycleId: req.params.id });
    res.json({ ok: true, cycle: data });
  } catch (err) {
    logger.error("Error ending cycle", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* Gnerates a ZIP file that has the applications & scores as a .csv for all the applications*/
app.get("/admin/cycles/:id/download", ...requireAdmin, async (req, res) => {
  try {
    const { data: cycle, error: cycleErr } = await supabase
      .from("cycles").select("*").eq("id", req.params.id).single();
    if (cycleErr || !cycle) return res.status(404).json({ error: "Cycle not found" });

    const { data: apps = [] } = await supabase
      .from("applications").select("*")
      .eq("cycle_id", req.params.id)
      .order("submitted_at", { ascending: true });

    const appIds = apps.map((a) => a.id);
    const applicantIds = [...new Set(apps.map((a) => a.applicant_id))];

    const [{ data: profiles = [] }, { data: { users = [] } }, { data: evaluations = [] }] =
      await Promise.all([
        supabase.from("profiles").select("id, name").in("id", applicantIds.length ? applicantIds : ["_"]),
        supabase.auth.admin.listUsers({ perPage: 1000 }),
        appIds.length
          ? supabase.from("reviewer_evaluations").select("*").in("application_id", appIds)
          : Promise.resolve({ data: [] }),
      ]);

    const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
    const emailMap   = Object.fromEntries(users.map((u) => [u.id, u.email]));
    const evalMap    = Object.fromEntries(evaluations.map((e) => [e.application_id, e]));

    const appHeaders = [
      "Name", "Email", "Submitted At", "Status", "Final Decision", "Decision Notes",
      "Personal Statement", "Leadership Experience", "Career Goals", "Academic Goals", "Resume Text",
    ];
    const appRows = apps.map((a) => {
      const ps = a.personal_statement_input || {};
      const re = a.resume_input || {};
      return [
        profileMap[a.applicant_id] || "",
        emailMap[a.applicant_id]   || "",
        a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "",
        a.status || "",
        a.final_decision || "",
        a.decision_notes || "",
        ps.personal_statement      || "",
        ps.leadership_experience   || "",
        ps.career_goals            || "",
        ps.academic_goals          || "",
        re.resume_text             || "",
      ];
    });

    const scoreHeaders = [
      "Name", "Email",
      "PS: Interests & Values (/30)", "PS: Academic Commitment (/30)", "PS: Clarity of Vision (/30)",
      "PS: Organization (/30)", "PS: Language Quality (/30)", "PS: Overall (/150)",
      "Resume: Academic Achievement (/30)", "Resume: Leadership (/30)", "Resume: Community Service (/30)",
      "Resume: Research & Work (/30)", "Resume: Skills (/30)", "Resume: Awards (/30)", "Resume: Overall (/180)",
      "Reviewer Recommendation", "Reviewer Notes", "Reviewer Score (/100)", "Final Decision",
    ];
    const scoreRows = apps.map((a) => {
      const ps = normalizePsScore(a.personal_statement_score) || {};
      const re = normalizeResumeScore(a.resume_score) || {};
      const ev = evalMap[a.id] || {};
      const revScores = ev.scores || {};
      const vals = Object.entries(revScores)
        .filter(([k]) => !k.startsWith("_"))
        .map(([, v]) => (typeof v === "number" ? v : 0));
      const revScore = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10)
        : "";
      return [
        profileMap[a.applicant_id] || "",
        emailMap[a.applicant_id]   || "",
        ps.interests_and_values    ?? "",
        ps.academic_commitment     ?? "",
        ps.clarity_of_vision       ?? "",
        ps.organization            ?? "",
        ps.language_quality        ?? "",
        ps.overall_score           ?? "",
        re.academic_achievement              ?? "",
        re.leadership_and_extracurriculars   ?? "",
        re.community_service                 ?? "",
        re.research_and_work_experience      ?? "",
        re.skills_and_certifications         ?? "",
        re.awards_and_recognition            ?? "",
        re.overall_score                     ?? "",
        ev.recommendation || "",
        ev.notes          || "",
        revScore,
        a.final_decision  || "",
      ];
    });

    const appCsv   = toCSV(appHeaders, appRows);
    const scoreCsv = toCSV(scoreHeaders, scoreRows);
    const safeName = cycle.name.replace(/[^a-zA-Z0-9\-_]/g, "_");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { if (!res.headersSent) res.status(500).end(err.message); });
    archive.pipe(res);
    archive.append(appCsv,   { name: "applications.csv" });
    archive.append(scoreCsv, { name: "scores.csv" });
    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/* (Claude Code, 2026) 
I want to create a endpoint that does the following: 
1. (app.get) to list all applications, and whether applicant has applied before, should be able to be filtered by cycle
2. (app.delete) deletes application with reviewer evaluations 
3. (app.get) full application history with reviewer recommendation and status per cycle 
4. (app.get) get a full application 
5. (app.patch) to assign remove a reviewer
6. (app.get) count by status, should be filterable by cycle 
7. (app.patch) store interview and message
8. (app.patch) sets decision and whether applicant can see it or not
/* 

- listing applicants
- filtering by cycle 
- flag returning applicants 
*/
app.get("/admin/applicants", ...requireAdmin, async (req, res) => {
  try {
    const cycleId = req.query.cycleId;

    let query = supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (cycleId) query = query.eq("cycle_id", cycleId);
    const { data, error } = await query;

    if (error) throw error;

    const applicants = await Promise.all(data.map((a) => toApplicantShape(a)));

    if (data.length > 0) {
      const allIds = [...new Set(data.map((a) => a.applicant_id))];
      const { data: allApps = [] } = await supabase
        .from("applications").select("applicant_id").in("applicant_id", allIds);
      const countMap = {};
      allApps.forEach((a) => { countMap[a.applicant_id] = (countMap[a.applicant_id] || 0) + 1; });
      applicants.forEach((ap, i) => {
        ap.returning = (countMap[data[i].applicant_id] || 0) > 1;
      });
    }

    res.json(applicants);
  } catch (err) {
    logger.error("Error listing applicants", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- deletes an application with all reviewer assignments & evaluations
*/
app.delete("/admin/applicants/:id", ...requireAdmin, async (req, res) => {
  try {
    const appId = req.params.id;

    const { error: evalErr } = await supabase
      .from("reviewer_evaluations").delete().eq("application_id", appId);
    if (evalErr) throw evalErr;

    const { error: assignErr } = await supabase
      .from("reviewer_assignments").delete().eq("application_id", appId);
    if (assignErr) throw assignErr;

    const { error: appErr } = await supabase
      .from("applications").delete().eq("id", appId);
    if (appErr) throw appErr;

    auditLog("DELETE_APPLICATION", req.user.id, { applicationId: appId });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Error deleting applicant", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- shows application history (if a applicant applies in multiple cycles)
*/
app.get("/admin/history/:applicantUserId", ...requireAdmin, async (req, res) => {
  try {
    const { data: apps, error } = await supabase
      .from("applications")
      .select("*")
      .eq("applicant_id", req.params.applicantUserId)
      .order("submitted_at", { ascending: false });
    if (error) throw error;

    const cycleIds = [...new Set((apps || []).map((a) => a.cycle_id).filter(Boolean))];
    const { data: cycles = [] } = cycleIds.length
      ? await supabase.from("cycles").select("id, name, status").in("id", cycleIds)
      : { data: [] };
    const cycleMap = Object.fromEntries(cycles.map((c) => [c.id, c]));

    const { data: evals = [] } = apps?.length
      ? await supabase.from("reviewer_evaluations")
          .select("application_id, recommendation, status")
          .in("application_id", apps.map((a) => a.id))
      : { data: [] };
    const evalMap = {};
    evals.forEach((e) => { evalMap[e.application_id] = e; });

    const history = (apps || []).map((a) => ({
      id: a.id,
      cycle: a.cycle_id ? (cycleMap[a.cycle_id] || { id: a.cycle_id, name: "Unknown", status: "archived" }) : null,
      submittedAt: a.submitted_at || a.created_at,
      status: a.status,
      finalDecision: a.final_decision || "Pending",
      decisionNotes: a.decision_notes || "",
      reviewerRecommendation: evalMap[a.id]?.recommendation || null,
      reviewerStatus: evalMap[a.id]?.status || null,
    }));

    res.json(history);
  } catch (err) {
    logger.error("Error fetching applicant history", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- retrieves an application 
*/
app.get("/admin/applicants/:id", ...requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });

    res.json(await toApplicantShape(data));
  } catch (err) {
    logger.error("Error fetching applicant", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- assigns applicant to reviewer 
- changes status to "under review"
*/
app.patch("/admin/applicants/:id/assign", ...requireAdmin, async (req, res) => {
  try {
    const { reviewerId } = req.body;

    const { error: upsertErr } = await supabase.from("reviewer_assignments").upsert({
      application_id: req.params.id,
      reviewer_id: reviewerId,
    });
    if (upsertErr) throw upsertErr;

    const { error: updateErr } = await supabase
      .from("applications")
      .update({ status: "Under Review", updated_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (updateErr) throw updateErr;

    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("id", req.params.id)
      .single();

    auditLog("ASSIGN_REVIEWER", req.user.id, { applicationId: req.params.id, reviewerId });
    res.json({ ok: true, applicant: await toApplicantShape(data) });
  } catch (err) {
    logger.error("Error assigning reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- removes assigned reviewer from application
- changes status 
*/
app.patch("/admin/applicants/:id/unassign", ...requireAdmin, async (req, res) => {
  try {
    const { reviewerId } = req.body;

    const { error: deleteErr } = await supabase
      .from("reviewer_assignments")
      .delete()
      .eq("application_id", req.params.id)
      .eq("reviewer_id", reviewerId);
    if (deleteErr) throw deleteErr;

    const { data: remaining } = await supabase
      .from("reviewer_assignments")
      .select("reviewer_id")
      .eq("application_id", req.params.id);

    if (!remaining || remaining.length === 0) {
      await supabase
        .from("applications")
        .update({ status: "Submitted", updated_at: new Date().toISOString() })
        .eq("id", req.params.id);
    }

    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("id", req.params.id)
      .single();

    res.json({ ok: true, applicant: await toApplicantShape(data) });
  } catch (err) {
    logger.error("Error unassigning reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- application breakdown by status 
- count of reviewer 
- can be filtered per cycle 
*/
app.get("/admin/stats", ...requireAdmin, async (req, res) => {
  try {
    const cycleId = req.query.cycleId;

    let appsQuery = supabase.from("applications").select("status");
    if (cycleId) appsQuery = appsQuery.eq("cycle_id", cycleId);

    const [{ data: apps }, { data: reviewerProfiles }] = await Promise.all([
      appsQuery,
      supabase.from("profiles").select("id").eq("role", "reviewer"),
    ]);

    const appList = apps || [];
    res.json({
      total: appList.length,
      submitted: appList.filter((a) => a.status === "Submitted").length,
      underReview: appList.filter((a) => a.status === "Under Review").length,
      evaluated: appList.filter((a) => a.status === "Evaluated").length,
      accepted: appList.filter((a) => a.status === "Accepted").length,
      waitlisted: appList.filter((a) => a.status === "Waitlisted").length,
      rejected: appList.filter((a) => a.status === "Rejected").length,
      reviewers: reviewerProfiles?.length || 0,
    });
  } catch (err) {
    logger.error("Error fetching stats", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- updates/saves the interview date with message (if added)
*/
app.patch("/admin/applicants/:id/interview", ...requireAdmin, async (req, res) => {
  try {
    const { interviewAt, message } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from("applications")
      .select("personal_statement_input")
      .eq("id", req.params.id)
      .single();
    if (fetchErr) throw fetchErr;

    const updatedInput = {
      ...(existing?.personal_statement_input || {}),
      _interview_at: interviewAt || null,
      _interview_message: message || "",
    };

    const { data, error } = await supabase
      .from("applications")
      .update({
        personal_statement_input: updatedInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    auditLog("SCHEDULE_INTERVIEW", req.user.id, { applicationId: req.params.id, interviewAt });
    res.json({ ok: true, applicant: await toApplicantShape(data) });
  } catch (err) {
    logger.error("Error scheduling interview", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- saves final decision 
- notes 
- whether decision is visible to the applicant or not 
*/
app.patch("/admin/applicants/:id/decision", ...requireAdmin, async (req, res) => {
  try {
    const { decision, notes, visible } = req.body;

    const { data: current, error: fetchErr } = await supabase
      .from("applications").select("personal_statement_input").eq("id", req.params.id).single();
    if (fetchErr) { logger.error("Decision fetch error:", fetchErr); throw fetchErr; }

    const psInput = { ...(current.personal_statement_input || {}), _decision_visible: visible === true };

    const { data, error } = await supabase
      .from("applications")
      .update({
        final_decision: decision,
        decision_notes: notes || "",
        decision_at: new Date().toISOString(),
        personal_statement_input: psInput,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) { logger.error("Decision save error:", error); throw error; }
    auditLog("SET_DECISION", req.user.id, { applicationId: req.params.id, decision, visible });
    res.json({ ok: true, applicant: await toApplicantShape(data) });
  } catch (err) {
    logger.error("Decision route exception:", err);
    res.status(500).json({ error: err.message });
  }
});

/* 
- show all reviewers as a list 
- status of reviewers 
*/
app.get("/reviewers", ...requireAdmin, async (_req, res) => {
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, active")
      .eq("role", "reviewer");

    const { data: { users } } = await supabase.auth.admin.listUsers();

    const reviewerIds = profiles?.map((p) => p.id) || [];
    const reviewers = users
      .filter((u) => reviewerIds.includes(u.id))
      .map((u) => {
        const profile = profiles?.find((p) => p.id === u.id);
        return {
          id: u.id,
          name: profile?.name || u.email,
          email: u.email,
          active: profile?.active !== false,
        };
      });

    res.json(reviewers);
  } catch (err) {
    logger.error("Error listing reviewers", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- create new reviewer account in supabase 
- checks if they are already there or not 
*/
app.post("/reviewers", ...requireAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "name, email and password required" });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "reviewer" },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("already") ||
        error.message.toLowerCase().includes("exists")
      )
        return res.status(409).json({ error: "A reviewer with this email already exists." });
      throw error;
    }

    await supabase
      .from("profiles")
      .upsert({ id: data.user.id, name, role: "reviewer", active: true }, { onConflict: "id" });

    auditLog("CREATE_REVIEWER", req.user.id, { reviewerId: data.user.id, email });
    res.json({ ok: true, reviewer: { id: data.user.id, name, email, active: true } });
  } catch (err) {
    logger.error("Error creating reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- deactivates a reviewer
*/
app.patch("/reviewers/:id/deactivate", ...requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ active: false })
      .eq("id", req.params.id);
    if (error) throw error;
    auditLog("DEACTIVATE_REVIEWER", req.user.id, { reviewerId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Error deactivating reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- activates a reviewer
*/
app.patch("/reviewers/:id/reactivate", ...requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ active: true })
      .eq("id", req.params.id);
    if (error) throw error;
    auditLog("REACTIVATE_REVIEWER", req.user.id, { reviewerId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Error reactivating reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- deletes reviewer from supabase auth 
*/
app.delete("/reviewers/:id", ...requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.id);
    if (error) return res.status(404).json({ error: "Not found" });
    auditLog("DELETE_REVIEWER", req.user.id, { reviewerId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Error deleting reviewer", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* (REVIEWER) */

/* 
- shows reviewers ONLY their assigned applicants 
- when a cycle ends list no longer shows 
*/
app.get("/reviewer/:reviewerId/applicants", ...requireReviewer, async (req, res) => {
  try {
    // Reviewers can only fetch their own assigned applicants
    if (req.userRole === "reviewer" && req.user.id !== req.params.reviewerId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const db = reqDb(req);

    const { data: assignments, error: assignErr } = await db
      .from("reviewer_assignments")
      .select("application_id")
      .eq("reviewer_id", req.params.reviewerId);

    if (assignErr) throw assignErr;
    if (!assignments || assignments.length === 0) return res.json([]);

    const appIds = assignments.map((a) => a.application_id);

    const { data: apps, error } = await supabase
      .from("applications")
      .select("*")
      .in("id", appIds);

    if (error) throw error;

    const { data: activeCycles } = await supabase
      .from("cycles")
      .select("id")
      .eq("status", "active");
    const activeCycleIds = new Set((activeCycles || []).map((c) => c.id));

    const accessibleApps = (apps || []).filter(
      (a) => !a.cycle_id || activeCycleIds.has(a.cycle_id)
    );

    const applicants = await Promise.all(accessibleApps.map((a) => toApplicantShape(a, db)));
    res.json(applicants);
  } catch (err) {
    logger.error("Error fetching reviewer applicants", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- gets evaluation for a specific applicaion 
*/
app.get("/reviewer/:reviewerId/applications/:appId/evaluation", ...requireReviewer, async (req, res) => {
  try {
    if (req.userRole === "reviewer" && req.user.id !== req.params.reviewerId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { data, error } = await supabase
      .from("reviewer_evaluations")
      .select("*")
      .eq("application_id", req.params.appId)
      .eq("reviewer_id", req.params.reviewerId)
      .maybeSingle();

    if (error) throw error;
    res.json(data || null);
  } catch (err) {
    logger.error("Error fetching evaluation", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/* 
- saves/updates reviewers evaluation 
- updates status 
*/
app.patch("/reviewer/:reviewerId/applications/:appId/evaluation", ...requireReviewer, async (req, res) => {
  try {
    if (req.userRole === "reviewer" && req.user.id !== req.params.reviewerId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { recommendation, notes, scores, status } = req.body;

    if (recommendation && recommendation !== "Yes" && recommendation !== "No") {
      return res.status(400).json({ error: "Recommendation must be 'Yes' or 'No'." });
    }

    const { data, error } = await supabase
      .from("reviewer_evaluations")
      .upsert(
        {
          application_id: req.params.appId,
          reviewer_id: req.params.reviewerId,
          recommendation: recommendation || "",
          notes: notes || "",
          scores: scores || {},
          status: status || "draft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id,reviewer_id" }
      )
      .select()
      .single();

    if (error) throw error;

    if (status === "submitted") {
      await supabase
        .from("applications")
        .update({ status: "Evaluated", updated_at: new Date().toISOString() })
        .eq("id", req.params.appId);
      auditLog("SUBMIT_EVALUATION", req.params.reviewerId, { applicationId: req.params.appId });
    }

    res.json({ ok: true, evaluation: data });
  } catch (err) {
    logger.error("Error saving evaluation", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
