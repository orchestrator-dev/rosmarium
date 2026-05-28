import { dispatchIntelligenceJob, getQueueStats } from "./src/modules/jobs/intelligence.jobs.js";

async function run() {
    try {
        console.log("Dispatching test intelligence job...");
        await dispatchIntelligenceJob({
            contentEntryId: "dummy-id-for-zset-test-123",
            contentType: "article",
            fields: [{ fieldName: "content", text: "This is some dummy text to analyze." }],
            locale: "en",
            candidateLabels: ["dummy"],
            operations: ["tag"]
        });
        console.log("Job dispatched successfully! Waiting 10 seconds for the worker to process it...");
        await new Promise((resolve) => setTimeout(resolve, 10000));

        console.log("Calling getQueueStats()...");
        const stats = await getQueueStats();
        console.log("Stats after job:", stats);
        process.exit(0);
    } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
    }
}

run();
