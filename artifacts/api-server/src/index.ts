import app from "./app";

const port = Number(process.env["PORT"] || "8080");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

try {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
} catch (error) {
  console.error("Failed to start server:", error);
  process.exit(1);
}
