/**
 * Resume Match Score route
 *
 * POST /api/resume-match
 *
 * Accepts a resume text and a job description, then returns a keyword-based
 * match score from 0 to 100. No external AI API required — uses term-frequency
 * overlap so the result is deterministic and offline-safe.
 *
 * Algorithm:
 *  1. Tokenise both texts into lowercase words
 *  2. Remove common English stop words
 *  3. Build a keyword set from the job description
 *  4. Count how many unique keywords appear in the resume
 *  5. score = Math.round((matches / totalKeywords) * 100)
 */

import { Router, type IRouter } from "express";

const router: IRouter = Router();

// ── Stop words to filter out ───────────────────────────────────────
const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","shall","can","need",
  "this","that","these","those","it","its","we","our","you","your","they",
  "their","he","his","she","her","i","my","me","us","from","by","as","into",
  "through","during","before","after","above","below","between","each",
  "more","most","other","some","such","no","not","only","own","same","so",
  "than","too","very","s","t","just","don","about","up","out","also",
  "all","am","any","both","few","if","then","there","when","where","which",
  "while","how","what","who","whom","why","because","until","although",
]);

/**
 * Tokenise text into a set of meaningful lowercase words.
 */
function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9#+.\s-]/g, " ") // keep +, #, . for C++, C#, .NET
    .split(/\s+/)
    .map((w) => w.replace(/^[-_.]+|[-_.]+$/g, "")) // trim punctuation
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * POST /api/resume-match
 * Returns a match score 0–100 plus the matched and missing keywords.
 */
router.post("/resume-match", (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body ?? {};
    if (typeof resumeText !== "string" || resumeText.length < 10) {
      res.status(400).json({ error: "resumeText must be a string with at least 10 characters" });
      return;
    }
    if (typeof jobDescription !== "string" || jobDescription.length < 10) {
      res.status(400).json({ error: "jobDescription must be a string with at least 10 characters" });
      return;
    }

    const jobKeywords  = tokenise(jobDescription);
    const resumeTokens = tokenise(resumeText);

    if (jobKeywords.size === 0) {
      res.json({ matchScore: 0, matchedKeywords: [], missingKeywords: [] });
      return;
    }

    const matched: string[]  = [];
    const missing: string[]  = [];

    for (const keyword of jobKeywords) {
      if (resumeTokens.has(keyword)) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    }

    // Base score from keyword overlap
    const rawScore = (matched.length / jobKeywords.size) * 100;

    // Small bonus for longer resume (more content generally means better match opportunity)
    const lengthBonus = Math.min(resumeText.length / 5000, 1) * 5;
    const matchScore = Math.min(100, Math.round(rawScore + lengthBonus));

    console.log(
      `[ResumeMatch] Score: ${matchScore}% | matched ${matched.length}/${jobKeywords.size} keywords`
    );

    res.json({
      matchScore,
      matchedKeywords: matched.slice(0, 20),  // top 20 to keep response lean
      missingKeywords: missing.slice(0, 20),
      totalJobKeywords: jobKeywords.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
