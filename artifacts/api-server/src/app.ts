import express, { type Express } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { startCronScheduler } from "./cron/scheduler.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Start the daily job refresh cron scheduler
// Runs every day at 02:00 AM for: software engineer, ai engineer,
// data scientist, frontend developer
startCronScheduler();

export default app;
