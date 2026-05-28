import { getQueueStats } from "./src/modules/jobs/intelligence.jobs.js";

async function run() {
    try {
        console.log("Calling getQueueStats()...");
        const stats = await getQueueStats();
        console.log("Stats:", stats);
        process.exit(0);
    } catch (err) {
        console.error("Failed to get stats:", err);
        process.exit(1);
    }
}

run();
