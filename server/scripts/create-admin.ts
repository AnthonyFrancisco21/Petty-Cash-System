import path from "path";
import dotenv from "dotenv";

// Load .env from repo root (where npm run db:create-admin is called from)
const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function run() {
  try {
    // ✅ FIX: Add .ts extension in dynamic imports
    const { hashPassword } = await import("../auth.ts");
    const { storage } = await import("../storage.ts");

    const username = process.env.ADMIN_USERNAME || "sample";
    const password = process.env.ADMIN_PASSWORD || "sample";
    const firstName = process.env.ADMIN_FIRSTNAME || "sample";
    const lastName = process.env.ADMIN_LASTNAME || "sample";

    const existing = await storage.getUserByUsername(username);
    if (existing) {
      console.log(`User ${username} already exists, skipping creation.`);
      process.exit(0);
    }

    const hashed = await hashPassword(password);

    const user = await storage.createUser({
      username,
      password: hashed,
      firstName,
      lastName,
      role: "approver",
    });

    console.log("Created admin user:", {
      id: user.id,
      username: user.username,
    });

    process.exit(0);
  } catch (err) {
    console.error("Failed to create admin:", err);
    process.exit(1);
  }
}

run();
