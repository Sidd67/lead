import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Search,
  MapPin,
  Briefcase,
  ExternalLink,
  Building2,
  Database,
  Download,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { 
  useGetJobs, 
  useGetAgentStatus,
  getGetJobsQueryKey,
  getGetAgentStatusQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Source badge config ─────────────────────────────────────────────
const SOURCE_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  linkedin: {
    label: "LinkedIn",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  naukri: {
    label: "Naukri",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  internshala: {
    label: "Internshala",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  wellfound: {
    label: "Wellfound",
    className: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  remotive: {
    label: "Remotive",
    className: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  },
  arbeitnow: {
    label: "Arbeitnow",
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  jobicy: {
    label: "Jobicy",
    className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  themuse: {
    label: "The Muse",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  direct: {
    label: "Direct Career Page",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_BADGES[source] ?? {
    label: source,
    className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border w-fit whitespace-nowrap",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

/**
 * Clean location string by removing the company name if it's present at the start
 * (e.g., "Google, Mountain View" -> "Mountain View")
 */
function cleanLocation(location: string, companyName: string): string {
  if (!location || !companyName) return location || "Remote";
  
  const company = companyName.toLowerCase().trim();
  const loc = location.toLowerCase().trim();
  
  // If location starts with company name followed by a separator
  if (loc.startsWith(company)) {
    const remaining = location.slice(companyName.length).replace(/^[\s,·\-|]+/, "").trim();
    return remaining || "Remote";
  }
  
  return location;
}

// ── Dashboard ───────────────────────────────────────────────────────
export default function Dashboard() {
  // All counters live in local React state — they start at 0 on every page
  // load/refresh and are only updated once fresh data arrives from the API.
  const [displayTotal, setDisplayTotal] = useState(0);
  const [displayCompanies, setDisplayCompanies] = useState(0);

  const [roleFilter, setRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  // Fetch job listings from the backend
  const { data, isLoading, isError, refetch, isFetching } = useGetJobs(
    {
      jobRole: roleFilter || undefined,
      location: locationFilter || undefined,
      source: sourceFilter || undefined,
    },
    {
      query: {
        queryKey: getGetJobsQueryKey({
          jobRole: roleFilter || undefined,
          location: locationFilter || undefined,
          source: sourceFilter || undefined,
        }),
        // Auto-refresh every 3 seconds while there are no jobs yet
        refetchInterval: (query: any) => 
          query.state.data?.total === 0 ? 3000 : false,
      },
    }
  );

  // Update local counters only when fresh data arrives (not on page load)
  useEffect(() => {
    if (data && data.jobs) {
      setDisplayTotal(data.total ?? 0);
      const uniqueCompanies = new Set(data.jobs.map((j) => j.companyName)).size;
      setDisplayCompanies(uniqueCompanies);
    }
  }, [data]);

  // FEATURE 4 — Stability: retry silently after 3 seconds on error
  useEffect(() => {
    if (!isError) return;
    const timer = setTimeout(() => {
      refetch();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isError, refetch]);

  // Also poll agent status so we know when to do a final refresh
  const { data: agentStatus } = useGetAgentStatus({
    query: {
      queryKey: getGetAgentStatusQueryKey(),
      refetchInterval: 2000,
    },
  });

  // Effect to trigger refetch when agent stops
  useEffect(() => {
    if (agentStatus && !agentStatus.isRunning) {
      refetch();
    }
  }, [agentStatus?.isRunning, refetch]);

  const jobs = data?.jobs ?? [];

  // Prioritize "Direct" (Official) sources and then sort by date
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.source === "direct" && b.source !== "direct") return -1;
    if (a.source !== "direct" && b.source === "direct") return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // ── CSV Export ───────────────────────────────────────────────────
  // Triggers a browser file download from the export-csv endpoint
  function handleExportCsv() {
    const link = document.createElement("a");
    link.href = "/api/jobs/export-csv";
    link.download = "leadhunter-jobs.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Delete Actions ───────────────────────────────────────────────
  async function handleDeleteJob(id: number) {
    if (!confirm("Are you sure you want to delete this job?")) return;
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (res.ok) refetch();
    } catch (err) {
      console.error("Failed to delete job", err);
    }
  }

  async function handleClearAllJobs() {
    if (!confirm("Are you sure you want to clear ALL jobs from the dashboard?")) return;
    try {
      const res = await fetch("/api/jobs", { method: "DELETE" });
      if (res.ok) {
        // Reset all filters to show a truly empty state
        setRoleFilter("");
        setLocationFilter("");
        setSourceFilter("");
        setDisplayTotal(0);
        setDisplayCompanies(0);
        refetch();
      }
    } catch (err) {
      console.error("Failed to clear jobs", err);
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <Database className="w-8 h-8 text-brand-indigo" />
            Jobs Dashboard
          </h1>
          <p className="text-muted-foreground">
            Browse and export job listings collected by your AI agent.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-background/50 p-2 rounded-xl border border-white/5 backdrop-blur-md">
          {/* Total Jobs counter — starts at 0, updates when data arrives */}
          <div className="px-4 py-2">
            <span className="text-2xl font-bold text-white">{displayTotal}</span>
            <span className="text-sm text-muted-foreground ml-2">Total Jobs</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          {/* Total Companies counter */}
          <div className="px-4 py-2">
            <span className="text-2xl font-bold text-white">{displayCompanies}</span>
            <span className="text-sm text-muted-foreground ml-2">Companies</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              // Global refresh: clear filters and refetch everything
              setRoleFilter("");
              setLocationFilter("");
              setSourceFilter("");
              refetch();
            }}
            disabled={isFetching}
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button 
            variant="ghost" 
            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-400/10" 
            onClick={handleClearAllJobs}
            disabled={sortedJobs.length === 0}
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </Button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden flex-1 flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row gap-3">
          {/* Role / keyword filter */}
          <div className="relative flex-1">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by Job Role..."
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-white/10 text-sm text-white focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all"
            />
          </div>

          {/* Location filter */}
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by Location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-white/10 text-sm text-white focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all"
            />
          </div>

          {/* Source filter */}
          <div className="relative min-w-[160px]">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-white/10 text-sm text-white focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">All Sources</option>
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
              <option value="internshala">Internshala</option>
              <option value="wellfound">Wellfound</option>
              <option value="remotive">Remotive</option>
              <option value="arbeitnow">Arbeitnow</option>
              <option value="jobicy">Jobicy</option>
              <option value="themuse">The Muse</option>
              <option value="direct">Direct Career Page</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-400">Job Title</th>
                <th className="px-6 py-4 font-medium text-gray-400">Company</th>
                <th className="px-6 py-4 font-medium text-gray-400">Location</th>
                <th className="px-6 py-4 font-medium text-gray-400">Category</th>
                <th className="px-6 py-4 font-medium text-gray-400">Source</th>
                <th className="px-6 py-4 font-medium text-gray-400">Date Found</th>
                <th className="px-6 py-4 font-medium text-gray-400">Apply</th>
                <th className="px-6 py-4 font-medium text-gray-400">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {/* Loading skeleton */}
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-40" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-28" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-5 bg-white/10 rounded-full w-20" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-white/10 rounded w-24" /></td>
                    <td className="px-6 py-4"><div className="h-8 bg-white/10 rounded w-16" /></td>
                    <td className="px-6 py-4"><div className="h-8 bg-white/10 rounded w-8" /></td>
                  </tr>
                ))
              ) : isError ? (
                // FEATURE 4 — friendly error message + auto-retry indicator
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin opacity-40" />
                      <p className="text-lg font-medium text-white">Loading job data...</p>
                      <p className="text-sm">Retrying in a moment.</p>
                    </div>
                  </td>
                </tr>
              ) : sortedJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Search className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-white mb-1">No jobs found yet</p>
                      <p>Run the AI agent from the Search page to collect jobs.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedJobs.map((job, index) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.5) }}
                    key={job.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Job Title */}
                    <td className="px-6 py-4">
                      <span className="font-medium text-white group-hover:text-brand-cyan transition-colors whitespace-nowrap">
                        {job.jobTitle}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="w-7 h-7 rounded bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10 shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-brand-cyan" />
                        </div>
                        <span className="text-gray-200">{job.companyName}</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-gray-400 whitespace-nowrap">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {cleanLocation(job.location, job.companyName)}
                      </span>
                    </td>

                    {/* Category (jobRole) */}
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-brand-indigo/10 text-brand-indigo text-xs border border-brand-indigo/20">
                        {job.jobRole}
                      </span>
                    </td>

                    {/* Source badge */}
                    <td className="px-6 py-4">
                      <SourceBadge source={job.source} />
                    </td>

                    {/* Date found */}
                    <td className="px-6 py-4 text-gray-400">
                      {format(new Date(job.createdAt), "MMM d, yyyy")}
                    </td>

                    {/* Apply link */}
                    <td className="px-6 py-4">
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 hover:bg-brand-cyan/20 transition-colors"
                      >
                        Apply <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>

                    {/* Delete action */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Job"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
