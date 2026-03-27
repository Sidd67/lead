import React from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Search, LayoutDashboard, Target, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const NavLink = ({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) => {
  const [isActive] = useRoute(href);

  return (
    <Link 
      href={href} 
      className={cn(
        "relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap",
        isActive ? "text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 bg-white/10 rounded-lg -z-10"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      {isActive && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-cyan rounded-t-full shadow-[0_-2px_10px_rgba(0,255,255,0.5)]" />
      )}
    </Link>
  );
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col relative selection:bg-brand-cyan/30">
      {/* Global abstract glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-indigo/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-cyan/10 blur-[120px] pointer-events-none" />

      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-indigo p-[1px] overflow-hidden group-hover:shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-shadow">
                <div className="absolute inset-0 bg-background m-[1px] rounded-[7px] flex items-center justify-center">
                  <Target className="w-4 h-4 text-brand-cyan" />
                </div>
              </div>
              <span className="font-display font-bold text-lg tracking-tight">
                LeadHunter <span className="text-gradient">AI</span>
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-2">
              <NavLink href="/" icon={Home}>Home</NavLink>
              <NavLink href="/search" icon={Search}>Search Agent</NavLink>
              <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
