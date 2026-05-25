import { db } from "./src/db/index.js";
import { users, contentEntries, graphEdges } from "./src/db/schema/index.js";
import { apiKeyService } from "./src/modules/auth/api-key.service.js";
import { eq } from "drizzle-orm";

async function run() {
  const admin = await db.select().from(users).where(eq(users.email, "admin@cortex.local")).limit(1);
  const userId = admin[0].id;
  
  // Create an API Key
  const { rawKey } = await apiKeyService.create({ userId, name: "manual-test-key", scopes: ["*"] });
  console.log("API_KEY=" + rawKey);

  // Check if we have entries
  let entries = await db.select().from(contentEntries).limit(2);
  
  if (entries.length < 2) {
    // Insert some dummy entries
    const id1 = "entry-test-1";
    const id2 = "entry-test-2";
    await db.insert(contentEntries).values([
      { id: id1, workspaceId: "workspace-1", contentTypeId: "article", title: "Article 1", status: "published", version: 1, createdBy: userId, updatedBy: userId },
      { id: id2, workspaceId: "workspace-1", contentTypeId: "article", title: "Article 2", status: "published", version: 1, createdBy: userId, updatedBy: userId },
    ]).onConflictDoNothing();
    
    entries = await db.select().from(contentEntries).limit(2);
  }

  const id1 = entries[0].id;
  const id2 = entries[1].id;
  
  console.log("ENTRY_1=" + id1);
  console.log("ENTRY_2=" + id2);

  // Insert edge
  await db.insert(graphEdges).values({
    fromEntryId: id1,
    toEntryId: id2,
    fromContentType: "article",
    toContentType: "article",
    edgeType: "relatedTo",
    weight: 1.0,
    isAccepted: "accepted"
  }).onConflictDoNothing();
  
  console.log("DONE");
  process.exit(0);
}

run();
