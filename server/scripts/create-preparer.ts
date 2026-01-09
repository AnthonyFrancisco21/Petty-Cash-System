import path from "path";
import dotenv from "dotenv";

// Load .env from repo root (where npm run db:create-preparer is called from)
const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

async function run() {
  try {
    // Dynamic import after env is loaded
    const { hashPassword } = await import("../auth");
    const { storage } = await import("../storage");
    const username = process.env.PREPARER_USERNAME || "preparer";
    const password = process.env.PREPARER_PASSWORD || "preparer";
    const firstName = process.env.PREPARER_FIRSTNAME || "Preparer";
    const lastName = process.env.PREPARER_LASTNAME || "User";

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
      role: "preparer",
    });

    console.log("Created preparer user:", {
      id: user.id,
      username: user.username,
      role: user.role,
    });
    process.exit(0);
  } catch (err) {
    console.error("Failed to create preparer:", err);
    process.exit(1);
  }
}

run();
