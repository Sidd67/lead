/**
 * Job Title Normalizer
 *
 * Maps any scraped job title to one of the 47 predefined canonical roles.
 * If the title cannot be matched to a known role it returns null and the
 * calling code should skip that job entirely.
 *
 * Pipeline:
 *  1. Strip seniority / level prefixes  (Senior, Junior, Lead, …)
 *  2. Lowercase + strip punctuation
 *  3. Match against ordered keyword patterns (most specific first)
 *  4. Return the canonical role string, or null if nothing matched
 */

// ── Canonical role list (source of truth) ─────────────────────────
export const PREDEFINED_ROLES = [
  // General engineering
  "Graphic Designer",
  "Software Engineer",
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "Web Developer",
  "Mobile App Developer",
  "Android Developer",
  "iOS Developer",
  "Game Developer",
  "Embedded Systems Developer",
  // AI / Data
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "AI Engineer",
  "NLP Engineer",
  "Computer Vision Engineer",
  "Data Engineer",
  "Business Intelligence Analyst",
  "Deep Learning Engineer",
  "Data Architect",
  // Cloud / DevOps
  "DevOps Engineer",
  "Cloud Engineer",
  "Site Reliability Engineer",
  "Cloud Architect",
  "Infrastructure Engineer",
  "Platform Engineer",
  // Cybersecurity
  "Cybersecurity Analyst",
  "Ethical Hacker",
  "Penetration Tester",
  "Security Engineer",
  "Security Architect",
  "Incident Response Analyst",
  // Systems / Networking
  "System Administrator",
  "Network Engineer",
  "Network Security Engineer",
  "Database Administrator",
  "Systems Engineer",
  // Product / Business
  "Product Manager",
  "Technical Program Manager",
  "IT Consultant",
  "Business Analyst",
  "Solutions Architect",
  // Testing / QA
  "QA Engineer",
  "Software Tester",
  "Automation Test Engineer",
  "Performance Test Engineer",
] as const;

export type PredefinedRole = typeof PREDEFINED_ROLES[number];

// ── Seniority / level prefixes to strip ───────────────────────────
// Listed in strip priority order — longer phrases first to avoid partial matches
const SENIORITY_PREFIXES: string[] = [
  "early-stage", "mid-level", "mid level",
  "principal", "founding", "experienced",
  "associate", "internship", "trainee",
  "fresher", "graduate", "full-stack",
  "senior", "junior", "staff", "lead",
  "intern", "remote",
  "head of", "vp of", "vp", "head",
  "director of", "director",
  "entry level", "entry-level", "entry",
];

/**
 * Strip recognised seniority / level prefixes from a raw title string
 * (already lowercased).
 */
function stripSeniority(lower: string): string {
  let result = lower.trim();
  let changed = true;

  while (changed) {
    changed = false;
    for (const prefix of SENIORITY_PREFIXES) {
      if (result.startsWith(prefix + " ") || result.startsWith(prefix + "-")) {
        result = result.slice(prefix.length).replace(/^[\s-]+/, "");
        changed = true;
        break;
      }
    }
  }

  return result;
}

/**
 * Normalise a raw string: lowercase, collapse punctuation / special chars to
 * spaces, trim, collapse whitespace.
 */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // replace punctuation with space
    .replace(/\s+/g, " ")           // collapse runs of whitespace
    .trim();
}

// ── Keyword → canonical role mapping ──────────────────────────────
// Order matters: more-specific patterns must come before broader ones.
// Each entry: [[...keywords that trigger this role], canonicalRole]
const ROLE_PATTERNS: readonly [string[], PredefinedRole][] = [
  // ── AI / Data (specific first) ────────────────────────────────
  [["nlp engineer", "natural language processing engineer", "nlp developer"], "NLP Engineer"],
  [["computer vision engineer", "cv engineer", "computer vision developer"], "Computer Vision Engineer"],
  [["deep learning engineer", "deep learning developer"], "Deep Learning Engineer"],
  [["machine learning engineer", "ml engineer", "ml developer"], "Machine Learning Engineer"],
  [["ai engineer", "ai ml engineer", "ai developer", "artificial intelligence engineer"], "AI Engineer"],
  [["data scientist", "data science engineer"], "Data Scientist"],
  [["data analyst", "data analysis engineer"], "Data Analyst"],
  [["data architect"], "Data Architect"],
  [["data engineer"], "Data Engineer"],
  [["business intelligence analyst", "bi analyst", "business intelligence developer"], "Business Intelligence Analyst"],

  // ── Cloud / DevOps ─────────────────────────────────────────────
  [["site reliability engineer", "sre", "reliability engineer"], "Site Reliability Engineer"],
  [["cloud architect"], "Cloud Architect"],
  [["cloud engineer", "cloud developer"], "Cloud Engineer"],
  [["devops engineer", "devops developer", "dev ops engineer", "devsecops engineer"], "DevOps Engineer"],
  [["infrastructure engineer", "infra engineer"], "Infrastructure Engineer"],
  [["platform engineer"], "Platform Engineer"],

  // ── Security ───────────────────────────────────────────────────
  [["network security engineer", "network security analyst"], "Network Security Engineer"],
  [["security architect"], "Security Architect"],
  [["incident response analyst", "incident response engineer"], "Incident Response Analyst"],
  [["penetration tester", "pentest engineer", "pen tester"], "Penetration Tester"],
  [["ethical hacker", "ethical hacking engineer"], "Ethical Hacker"],
  [["security engineer", "application security engineer"], "Security Engineer"],
  [["cybersecurity analyst", "cyber security analyst", "information security analyst", "security analyst"], "Cybersecurity Analyst"],

  // ── Systems / Networking ───────────────────────────────────────
  [["database administrator", "database admin", "dba"], "Database Administrator"],
  [["system administrator", "sysadmin", "sys admin", "systems administrator"], "System Administrator"],
  [["network engineer", "network administrator", "network admin"], "Network Engineer"],
  [["systems engineer"], "Systems Engineer"],

  // ── Web / Mobile ───────────────────────────────────────────────
  [["embedded systems developer", "embedded software engineer", "firmware engineer", "embedded engineer"], "Embedded Systems Developer"],
  [["android developer", "android engineer", "android app developer"], "Android Developer"],
  [["ios developer", "ios engineer", "swift developer", "objective c developer"], "iOS Developer"],
  [["game developer", "game engineer", "unity developer", "unreal developer"], "Game Developer"],
  [
    [
      "mobile app developer", "mobile developer", "mobile engineer",
      "react native developer", "flutter developer", "mobile application developer",
    ],
    "Mobile App Developer",
  ],
  [["full stack developer", "fullstack developer", "full stack engineer", "fullstack engineer"], "Full Stack Developer"],
  [
    [
      "frontend developer", "front end developer", "front-end developer",
      "frontend engineer", "front-end engineer", "ui developer", "ui engineer",
      "react developer", "vue developer", "angular developer", "nextjs developer",
      "javascript developer",
    ],
    "Frontend Developer",
  ],
  [
    [
      "backend developer", "back end developer", "back-end developer",
      "backend engineer", "back-end engineer", "api developer",
      "node developer", "nodejs developer", "django developer",
      "flask developer", "rails developer", "spring developer",
    ],
    "Backend Developer",
  ],
  [["web developer", "web engineer", "web application developer"], "Web Developer"],

  // ── QA / Testing ───────────────────────────────────────────────
  [["performance test engineer", "performance testing engineer"], "Performance Test Engineer"],
  [["automation test engineer", "automation testing engineer", "automation qa engineer", "test automation engineer"], "Automation Test Engineer"],
  [["software tester", "software testing engineer", "manual tester"], "Software Tester"],
  [["qa engineer", "quality assurance engineer", "quality engineer", "test engineer"], "QA Engineer"],

  // ── Product / Business ─────────────────────────────────────────
  [["solutions architect", "solution architect"], "Solutions Architect"],
  [["technical program manager", "tpm"], "Technical Program Manager"],
  [["product manager", "product owner"], "Product Manager"],
  [["business analyst", "business analysis"], "Business Analyst"],
  [["it consultant", "technology consultant"], "IT Consultant"],

  // ── Design ─────────────────────────────────────────────────────
  [["graphic designer", "ui ux designer", "ui designer", "ux designer", "visual designer", "product designer"], "Graphic Designer"],

  // ── Broad engineering (last resort) ───────────────────────────
  [["software engineer", "software developer", "swe", "sde", "programmer", "coder"], "Software Engineer"],
];

// ── Public API ────────────────────────────────────────────────────

/**
 * Map a raw scraped job title to a canonical predefined role.
 *
 * Returns the canonical role name (e.g. "AI Engineer") or null if no
 * predefined role could be matched. Callers should skip unmatched jobs.
 *
 * @example
 * normalizeTitle("Senior AI/ML Engineer") // → "AI Engineer"
 * normalizeTitle("React Developer")        // → "Frontend Developer"
 * normalizeTitle("Marketing Coordinator")  // → null
 */
export function normalizeTitle(rawTitle: string): PredefinedRole | null {
  const clean    = normalise(rawTitle);          // lowercase + remove punctuation
  const stripped = stripSeniority(clean);        // remove Senior / Junior / etc.

  // Try each keyword pattern in order (most-specific first)
  for (const [keywords, role] of ROLE_PATTERNS) {
    for (const kw of keywords) {
      if (stripped.includes(kw) || clean.includes(kw)) {
        return role;
      }
    }
  }

  return null; // no match — caller should skip this job
}
