import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Bot, MapPin, Briefcase, Play, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  useStartAgent, 
  useGetAgentStatus, 
  getGetAgentStatusQueryKey,
  useGetJobSuggestions,
  getGetJobSuggestionsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  industry: z.string().min(2, "Industry must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  teamDescription: z.string().optional(),
});

export default function Search() {
  const { toast } = useToast();
  const [isPolling, setIsPolling] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const locationSuggestionsRef = useRef<HTMLDivElement>(null);

  const { mutate: startAgent, isPending: isStarting } = useStartAgent({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Agent Deployed!",
          description: "The AI is now scouring the web for your leads.",
        });
        setIsPolling(true);
      },
      onError: (error) => {
        toast({
          title: "Deployment Failed",
          description: error?.message || "Could not start the agent.",
          variant: "destructive",
        });
      },
    }
  });

  // Polling logic
  const { data: status } = useGetAgentStatus({
    query: {
      queryKey: getGetAgentStatusQueryKey(),
      refetchInterval: (query) => (isPolling || query.state.data?.isRunning) ? 2000 : false,
    }
  });

  // Stop polling when server says it's done
  useEffect(() => {
    if (status && !status.isRunning && isPolling) {
      setIsPolling(false);
      if (status.lastJobAt) {
        toast({
          title: "Search Complete",
          description: "Agent finished executing its task.",
        });
      }
    }
  }, [status, isPolling, toast]);

  // Fetch job role suggestions once on mount
  const { data: suggestionsData } = useGetJobSuggestions({
    query: { 
      queryKey: getGetJobSuggestionsQueryKey(),
      staleTime: Infinity 
    }
  });
  const allSuggestions = suggestionsData?.suggestions ?? [];

  // Fetch location suggestions
  const [allLocationSuggestions, setAllLocationSuggestions] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/location-suggestions")
      .then(res => res.json())
      .then(data => setAllLocationSuggestions(data.suggestions || []))
      .catch(err => console.error("Failed to fetch location suggestions", err));
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { industry: "", location: "", teamDescription: "" },
  });

  // Watch the industry field value to drive the autocomplete filter
  const industryValue = form.watch("industry");

  // Filter suggestions based on what the user is typing (case-insensitive)
  const filteredSuggestions = industryValue.length >= 1
    ? allSuggestions.filter((s) =>
        s.toLowerCase().includes(industryValue.toLowerCase())
      ).slice(0, 8)
    : [];

  const locationValue = form.watch("location");
  const filteredLocationSuggestions = locationValue.length >= 1
    ? allLocationSuggestions.filter((s) =>
        s.toLowerCase().includes(locationValue.toLowerCase())
      ).slice(0, 8)
    : [];

  // Close suggestions dropdown when clicking outside the input + dropdown area
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (locationSuggestionsRef.current && !locationSuggestionsRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setShowSuggestions(false);
    startAgent({ data: values });
  };

  const isRunning = status?.isRunning || isStarting;

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative">
      <div className="w-full max-w-2xl relative z-10">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-indigo/10 text-brand-cyan mb-6 shadow-[0_0_30px_rgba(0,255,255,0.1)]">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Configure Search Agent
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Define your target criteria. Our AI will automatically find companies, extract founders, and grab contact info.
          </p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-6 sm:p-8"
        >
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">

              {/* ── Industry / Job Role input with autocomplete ── */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand-cyan" />
                  Target Industry
                </label>

                {/* Wrapper captures clicks inside the input + dropdown */}
                <div className="relative" ref={suggestionsRef}>
                  <input
                    {...form.register("industry")}
                    disabled={isRunning}
                    placeholder="e.g., AI Engineer, Full Stack Developer"
                    autoComplete="off"
                    onFocus={() => setShowSuggestions(true)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-background/50 border-2 border-white/10 text-white placeholder:text-gray-500",
                      "focus:outline-none focus:border-brand-cyan/50 focus:ring-4 focus:ring-brand-cyan/10 transition-all",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  />

                  {/* Autocomplete dropdown */}
                  <AnimatePresence>
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <motion.ul
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden"
                      >
                        {filteredSuggestions.map((suggestion) => (
                          <li key={suggestion}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                // mousedown fires before blur — prevent blur from closing first
                                e.preventDefault();
                              }}
                              onClick={() => {
                                form.setValue("industry", suggestion, { shouldValidate: true });
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors flex items-center gap-2"
                            >
                              <Briefcase className="w-3.5 h-3.5 shrink-0 text-brand-cyan/50" />
                              {suggestion}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>

                {form.formState.errors.industry && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.industry.message}</p>
                )}
              </div>

              {/* ── Location input (unchanged) ── */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-cyan" />
                  Target Location
                </label>
                <div className="relative" ref={locationSuggestionsRef}>
                  <input
                    {...form.register("location")}
                    disabled={isRunning}
                    placeholder="e.g., India, San Francisco, London"
                    autoComplete="off"
                    onFocus={() => setShowLocationSuggestions(true)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl bg-background/50 border-2 border-white/10 text-white placeholder:text-gray-500",
                      "focus:outline-none focus:border-brand-cyan/50 focus:ring-4 focus:ring-brand-cyan/10 transition-all",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  />

                  {/* Location Autocomplete dropdown */}
                  <AnimatePresence>
                    {showLocationSuggestions && filteredLocationSuggestions.length > 0 && (
                      <motion.ul
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-50 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden"
                      >
                        {filteredLocationSuggestions.map((suggestion) => (
                          <li key={suggestion}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={() => {
                                form.setValue("location", suggestion, { shouldValidate: true });
                                setShowLocationSuggestions(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors flex items-center gap-2"
                            >
                              <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-cyan/50" />
                              {suggestion}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
                {form.formState.errors.location && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.location.message}</p>
                )}
              </div>

              {/* ── Team Description (New Feature) ── */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-brand-cyan" />
                    Team Description
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    This information helps other users to make a decision whether to join your team.
                  </span>
                </label>
                <textarea
                  {...form.register("teamDescription")}
                  disabled={isRunning}
                  placeholder="Tell potential candidates what makes your team unique..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl bg-background/50 border-2 border-white/10 text-white placeholder:text-gray-500",
                    "focus:outline-none focus:border-brand-cyan/50 focus:ring-4 focus:ring-brand-cyan/10 transition-all min-h-[100px] resize-none",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
            </div>

            {!isRunning && (
              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-14 text-lg mt-4 group"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Deploy AI Agent
              </Button>
            )}
          </form>

          <AnimatePresence mode="wait">
            {isRunning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-6 rounded-2xl bg-brand-cyan/5 border border-brand-cyan/20 overflow-hidden"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 text-brand-cyan animate-spin" />
                    <div className="absolute inset-0 bg-brand-cyan blur-md opacity-40 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Agent is active</h3>
                    <p className="text-sm text-brand-cyan/80">Scanning websites and extracting data...</p>
                  </div>
                </div>
                
                {status?.currentJob && (
                  <div className="bg-background/50 rounded-xl p-4 text-sm mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Target</span>
                        <span className="text-white font-medium">{status.currentJob.industry} in {status.currentJob.location}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Leads Extracted</span>
                        <span className="text-brand-cyan font-bold text-lg">{status.currentJob.leadsFound}</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {(!isRunning && status?.lastJobAt && !isStarting) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-6 p-6 rounded-2xl bg-green-500/5 border border-green-500/20"
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                    <div>
                      <h3 className="font-semibold text-white">Search Completed</h3>
                      <p className="text-sm text-green-400/80">Data saved to database.</p>
                    </div>
                  </div>
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full sm:w-auto border-green-500/30 hover:bg-green-500/10 text-green-400">
                      View Leads <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
