import { db, jobsTable, leadsTable } from "@workspace/db";

async function main() {
  console.log("Wiping all jobs and leads to clear corrupted data...");
  await db.delete(jobsTable);
  await db.delete(leadsTable);
  console.log("Database cleared successfully.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
