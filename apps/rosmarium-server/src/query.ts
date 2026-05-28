import { db } from './db/index.js';
import { contentEntries } from './db/schema/content-entries.js';
import { eq } from 'drizzle-orm';

async function main() {
  const result = await db.select({
    id: contentEntries.id,
    data: contentEntries.data
  }).from(contentEntries).where(eq(contentEntries.id, 'zu1rl9l5ov9yuy5aabhnp9pq'));
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(console.error);
