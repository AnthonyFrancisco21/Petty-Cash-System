import { db } from "../db";
import { voucherAttachments } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function updateUploadPathsBack() {
  try {
    // Update all file paths from "server/upload" to "server/uploads"
    await db
      .update(voucherAttachments)
      .set({
        filePath: sql`REPLACE(${voucherAttachments.filePath}, 'server\\\\upload', 'server\\\\uploads')`,
      })
      .where(sql`${voucherAttachments.filePath} LIKE '%server\\\\upload%'`);

    console.log(
      "Successfully updated upload paths back to uploads in database"
    );
  } catch (error) {
    console.error("Error updating upload paths:", error);
  } finally {
    process.exit(0);
  }
}

updateUploadPathsBack();
