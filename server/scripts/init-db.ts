import path from "path";
import dotenv from "dotenv";
import fs from "fs";

// Load .env from repo root (where npm run db:init is called from)
const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function run() {
  try {
    // Dynamic import after env is loaded
    const { pool } = await import("../db");
    const sqlPath = path.join(process.cwd(), "server", "sql", "init.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    console.log("Running DB init SQL...");
    await pool.query(sql);
    console.log("Database initialized.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  }
}

run();
