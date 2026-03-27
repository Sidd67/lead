import { runLeadAgent } from "./src/agents/leadAgent.js";

async function main() {
  process.env.PORT = "8080";
  console.log("Starting Lead Agent manual run...");
  try {
    const { jobId } = await runLeadAgent("software engineer", "india");
    console.log("Agent job started:", jobId);
    
    // Wait for the async part to finish
    // Since runLeadAgent is async but triggers a background task, 
    // we need to wait until it's done or check status.
    // For this debug, we'll just wait for 20 seconds.
    await new Promise(r => setTimeout(r, 20000));
    console.log("Agent manual run wait complete.");
  } catch (err) {
    console.error("Agent manual run failed:", err);
  }
  process.exit(0);
}

main();
