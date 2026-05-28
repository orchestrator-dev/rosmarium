import { db } from "./src/db/index.js";
import { apiKeys, users, contentEntries, graphEdges } from "./src/db/schema/index.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function run() {
  const admin = await db.select().from(users).where(eq(users.email, "admin@rosmarium.local")).limit(1);
  const userId = admin[0].id;
  
  let key = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).limit(1);
  let keyValue = "admin-test-key-123";
  if (key.length === 0) {
    // We can't insert a raw key easily because it's hashed, wait, the API uses Bearer token, we need a valid unhashed key.
    // Instead of creating via DB, let's just make a login request. Oh wait, I can just use a node script to generate and hash it, or I can just login if I know the password, or just use the DB to bypass auth for testing...
  }
}
run();
