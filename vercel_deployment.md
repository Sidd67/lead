# Vercel Deployment Guide: LeadHunter AI

Follow these steps to make your project live on Vercel:

## 1. Database Setup (Crucial)
Vercel uses a read-only filesystem, so the local `sqlite.db` will not save data permanently.
1.  **Create a Turso Database**: Sign up at [Turso](https://turso.tech/) (free tier).
2.  **Get Connection Details**: You will get a `DATABASE_URL` (e.g., `libsql://your-db.turso.io`) and a `DATABASE_AUTH_TOKEN`.
3.  **Add to Vercel**: In your Vercel project settings, add these as Environment Variables.

## 2. Environment Variables
Add the following variables in the Vercel Dashboard:
- `DATABASE_URL`: Your Turso DB URL.
- `DATABASE_AUTH_TOKEN`: Your Turso Auth Token.
- `TINYFISH_API_KEY`: Your TinyFish API key for the autonomous agent.
- `PORT`: Set to `8080`.
- `BASE_PATH`: Set to `/`.

## 3. Deployment Steps
1.  **Push to GitHub**: Push your latest local changes to a GitHub repository.
2.  **Import to Vercel**: Select your repository in the Vercel dashboard.
3.  **Monorepo Settings**:
    - **Framework Preset**: Vite.
    - **Root Directory**: Leave as `.` (the project root).
    - **Build Command**: `pnpm build`.
    - **Output Directory**: `artifacts/leadhunter-ai/dist/public`.

## 4. Scheduled Maintenance (Refresh)
Vercel Serverless Functions cannot run long-running background cron jobs. 
To keep the 4:00 AM refresh active:
1.  **Vercel Cron**: Use `vercel.json` to define a cron job that hits an API endpoint.
2.  *Alternative*: Use a service like [Cron-job.org](https://cron-job.org/) to hit `https://your-vercel-app.com/api/refresh` every day.

## Summary of Files Added
- `vercel.json`: Manages monorepo routing and build output.
- `api/index.ts`: Bridges the Express backend to Vercel Serverless Functions.
- `lib/db/src/index.ts`: Updated to support remote LibSQL connections.
