/**
 * Job Suggestions route
 *
 * GET /api/job-suggestions
 * Returns a curated list of popular job roles for autocomplete and quick-fill.
 * The frontend can optionally consume this to pre-fill the search form.
 */

import { Router, type IRouter } from "express";
import { GetJobSuggestionsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Full list of popular job roles returned by the API
const JOB_SUGGESTIONS = [
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
  "DevOps Engineer",
  "Cloud Engineer",
  "Site Reliability Engineer",
  "Cloud Architect",
  "Infrastructure Engineer",
  "Platform Engineer",
  "Cybersecurity Analyst",
  "Ethical Hacker",
  "Penetration Tester",
  "Security Engineer",
  "Security Architect",
  "Incident Response Analyst",
  "System Administrator",
  "Network Engineer",
  "Network Security Engineer",
  "Database Administrator",
  "Systems Engineer",
  "Product Manager",
  "Technical Program Manager",
  "IT Consultant",
  "Business Analyst",
  "Solutions Architect",
  "QA Engineer",
  "Software Tester",
  "Automation Test Engineer",
  "Performance Test Engineer",
];

const LOCATION_SUGGESTIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "Indonesia",
  "Japan",
  "France",
  "Spain",
  "Italy",
  "Netherlands",
  "Remote",
  "Bangalore",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Pune",
  "Chennai",
  "San Francisco",
  "London",
  "New York",
  "Berlin",
  "Dubai",
];

/**
 * GET /api/job-suggestions
 * Returns the full list of curated job role suggestions.
 */
router.get("/job-suggestions", (_req, res) => {
  try {
    const response = GetJobSuggestionsResponse.parse({ suggestions: JOB_SUGGESTIONS });
    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/location-suggestions
 * Returns the full list of curated location suggestions.
 */
router.get("/location-suggestions", (_req, res) => {
  try {
    // We reuse the same response format { suggestions: string[] }
    res.json({ suggestions: LOCATION_SUGGESTIONS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
