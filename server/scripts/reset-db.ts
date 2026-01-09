import path from "path";
import dotenv from "dotenv";
import fs from "fs";

// Load .env from repo root
const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function run() {
  try {
    const { pool } = await import("../db");
    const sqlPath = path.join(process.cwd(), "server", "sql", "cleanup.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    console.log("Dropping and recreating tables...");
    await pool.query(sql);
    console.log("Database reset complete.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to reset DB:", err);
    process.exit(1);
  }
}

run();
