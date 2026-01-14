import path from "path";
import dotenv from "dotenv";

// Load .env from repo root (where npm run db:create-approver is called from)
const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function run() {
  try {
    // Dynamic import after env is loaded
    const { hashPassword } = await import("../auth");
    const { storage } = await import("../storage");
    const username = process.env.APPROVER_USERNAME || "approver";
    const password = process.env.APPROVER_PASSWORD || "approver";
    const firstName = process.env.APPROVER_FIRSTNAME || "Approver";
    const lastName = process.env.APPROVER_LASTNAME || "User";

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

    console.log("Created approver user:", {
      id: user.id,
      username: user.username,
      role: user.role,
    });
    process.exit(0);
  } catch (err) {
    console.error("Failed to create approver:", err);
    process.exit(1);
  }
}

run();
