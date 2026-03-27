import { db, jobsTable } from "@workspace/db";
import { count, desc } from "drizzle-orm";

async function main() {
  const result = await db.select({ value: count() }).from(jobsTable);
  console.log("Total jobs:", result[0].value);
  
  const sources = await db.select({ source: jobsTable.source, c: count() })
    .from(jobsTable)
    .groupBy(jobsTable.source);
  console.log("Sources Found:", JSON.stringify(sources, null, 2));
  
  const samples = await db.select().from(jobsTable).orderBy(desc(jobsTable.id)).limit(10);
  console.log("Last 10 Samples:", JSON.stringify(samples, null, 2));

  process.exit(0);
}

main().catch(console.error);
