# Project Report: LeadHunter AI
**Autonomous Career Sourcing & Lead Generation Agent**

---

## 1. Problem Statement
Job searching and recruiter sourcing today is a highly fragmented and manual process. Recruiters and job seekers must navigate dozens of platforms (LinkedIn, Naukri, Wellfound, etc.), often encountering outdated listings, redundant entries, and "aggregator" links that lead to frustrating loops rather than direct application pages. 

The core challenges are:
- **Platform Fragmentation**: No single source of truth for high-quality leads.
- **Data Decay**: Job listings become inactive rapidly, cluttering dashboards with dead links.
- **Link Quality**: Aggregator sites often hide the original "Direct Career" application page, reducing the success rate for applicants.
- **Manual Overhead**: The constant need to manually refresh searches and filter results leads to significant productivity loss.

## 2. Project Objective
The primary objective of **LeadHunter AI** is to build a fully autonomous web agent that scours the internet to find, validate, and organize high-quality job leads. 

The project aims to:
- **Automate Sourcing**: Use AI to simulate human browsing and discover leads across multiple sources simultaneously.
- **Prioritize Quality**: Identify and extract official "Direct Career Page" links to maximize application conversion.
- **Self-Maintaining Ecosystem**: Implement automated job refreshes and cleanup cycles to ensure the data remains actionable and current.
- **Enhanced Transparency**: Provide a "Team Description" context for recruiters to better communicate their team culture to potential candidates.

## 3. Methodology
The solution is built using a modern, decoupled architecture centered around autonomous AI browsing:

### 3.1 Autonomous Agent (TinyFish API)
We utilized the **TinyFish API** to deploy a web agent that performs deep searches. The agent is configured to:
- Execute multi-platform queries based on industry and location.
- Perform heuristic-based analysis to identify "Direct" application URLs.
- Normalize job roles to ensure consistent filtering and categorization.

### 3.2 Backend Infrastructure
- **API Engine**: Built with Express/TypeScript for robust request handling.
- **Database**: Drizzle ORM paired with SQLite for lightweight, high-performance data persistence.
- **Cron Engine**: Implemented a localized scheduler to handle the 4:00 AM daily job refresh and the automated deletion of records older than 30 days.

### 3.3 Frontend Dashboard
- **React & Vite**: A high-performance SPA (Single Page Application) for real-time data visualization.
- **Framer Motion**: Used for smooth UI transitions and micro-animations to enhance user engagement.
- **State Selection**: Integrated smart "Clear All" and "Global Refresh" behaviors that synchronize database state with UI filtering.

## 4. Scope of the Solution
The LeadHunter AI solution covers the following scope:
- **Cross-Platform Extraction**: Support for LinkedIn, Naukri, Internshala, Wellfound, GitHub, and major aggregator sites.
- **Intelligent Deduplication**: Ensures that the same job from multiple sources is merged into a single high-quality entry.
- **Automated Lifecycle Management**: Handles the entire data lifecycle from discovery to archival (30-day limit).
- **Recruiter Configuration**: Provides tools to configure the agent's target industry, location, and team branding.

## 5. Additional Relevant Details
- **Independence**: The project has been fully decoupled from Replit-specific dependencies, making it ready for standard VPS or containerized deployment.
- **Performance**: The dashboard utilizes aggressive caching and polling logic to ensure that 45+ leads can be browsed with zero lag.
- **Premium Aesthetics**: Designed with a sleek, dark-themed glassmorphism interface to provide a professional enterprise experience.

---
*Created by LeadHunter AI Development Team*
