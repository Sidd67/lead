import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const FeatureCard = ({ icon: Icon, title, description, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: "easeOut" }}
    className="glass-panel p-6 rounded-2xl flex flex-col gap-4 group hover:border-brand-cyan/30 transition-colors"
  >
    <div className="w-12 h-12 rounded-xl bg-brand-indigo/20 flex items-center justify-center text-brand-cyan group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <h3 className="text-xl font-bold font-display text-white mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

export default function Home() {
  return (
    <div className="flex-1 flex flex-col relative">
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-30">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="AI Network Background" 
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/80 to-background" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8 border-brand-cyan/30"
          >
            <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />
            <span className="text-sm font-medium text-brand-cyan">v1.0 Agent Now Live</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-white mb-6"
          >
            Unleash the Power of{" "}
            <span className="text-gradient">Autonomous Sourcing</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed"
          >
            Deploy our AI web agent to automatically scour the internet, extract key decision-maker contact info, and build your pipeline while you sleep.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/search">
              <Button size="lg" className="w-full sm:w-auto gap-2 group text-lg h-14">
                Start Lead Search
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 text-lg h-14">
                View Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Bot}
              title="Automated Browsing"
              description="Our TinyFish-powered agent simulates human browsing, analyzing deep pages to find hidden contact information."
              delay={0.4}
            />
            <FeatureCard 
              icon={Target}
              title="Hyper-Targeted"
              description="Simply input an industry and location. The AI figures out the right search queries and validation logic."
              delay={0.5}
            />
            <FeatureCard 
              icon={Zap}
              title="Real-Time Extraction"
              description="Watch leads pour into your dashboard as the agent works, automatically parsing emails and LinkedIn profiles."
              delay={0.6}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
