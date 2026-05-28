import { db } from "./index.js";
import { users } from "./schema/index.js";
import { eq, sql } from "drizzle-orm";
import { registry } from "../modules/content/registry.js";
import { contentCrudService } from "../modules/content/crud.service.js";
import { graphService } from "../modules/graph/graph.service.js";
import { analyticsClient } from "../modules/graph/analytics/analytics.client.js";
import { config } from "../config.js";

const themes = ["Vector Search", "RAG", "CMS/APIs", "Graphs", "DevOps"];

function generatePeople() {
    return Array.from({ length: 10 }).map((_, i) => ({
        name: `Person ${i + 1}`,
        slug: `person-${i + 1}`,
        role: `Engineer ${i + 1}`,
        bio: `Bio for person ${i + 1}. They specialize in ${themes[i % 5]}.`,
        organisation: i % 2 === 0 ? "Tech Corp" : "Open Source Org"
    }));
}

function generateConcepts() {
    return Array.from({ length: 15 }).map((_, i) => ({
        title: `Concept ${i + 1}: ${themes[i % 5]}`,
        slug: `concept-${i + 1}`,
        definition: `A comprehensive definition of Concept ${i + 1}.`,
        relatedTerms: `Term A, Term B, Term C`,
        category: themes[i % 5]
    }));
}

function generateArticles() {
    return Array.from({ length: 25 }).map((_, i) => ({
        title: `Article ${i + 1}: Deep Dive into ${themes[i % 5]}`,
        slug: `article-${i + 1}`,
        summary: `This article explores the intricacies of ${themes[i % 5]}.`,
        body: `Here is a detailed rich text body about ${themes[i % 5]}. We cover everything from the basics to advanced implementations.`,
        author: `Person ${(i % 10) + 1}`,
        category: themes[i % 5],
        readingTime: 5 + (i % 10)
    }));
}

async function seedDemo() {
    console.log("🌱 Running Rosmarium Discovery Demo Database Seed...");

    await registry.load();

    const adminRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, config.ADMIN_EMAIL.toLowerCase()))
        .limit(1);

    if (adminRows.length === 0) {
        throw new Error("Admin user not found. Please run `pnpm db:seed` first.");
    }
    const adminId = adminRows[0]!.id;

    // Idempotency check: look for article-1
    let existingEntry = false;
    const articleCt = registry.get("article");
    if (articleCt) {
        const check = await db.execute(sql`
            SELECT id FROM content_entries 
            WHERE content_type_id = ${articleCt.id} 
              AND data->>'slug' = 'article-1'
            LIMIT 1
        `);
        if (check.length > 0) existingEntry = true;
    }

    if (existingEntry) {
        console.log("✅ Demo dataset already seeded. Skipping.");
        process.exit(0);
    }

    console.log("📦 Registering Content Types...");
    
    if (!registry.get("article")) {
        await registry.register({
            name: "article",
            displayName: "Article",
            fields: [
                { name: "title", label: "Title", type: "text", required: true, unique: false, localised: false },
                { name: "slug", label: "Slug", type: "slug", generatedFrom: "title", required: true, unique: true, localised: false },
                { name: "summary", label: "Summary", type: "text", required: false, unique: false, localised: false },
                { name: "body", label: "Body", type: "richText", required: true, unique: false, localised: false },
                { name: "author", label: "Author", type: "text", required: false, unique: false, localised: false },
                { name: "category", label: "Category", type: "select", options: themes.map(t => ({label: t, value: t})), required: false, unique: false, localised: false },
                { name: "readingTime", label: "Reading Time (mins)", type: "number", integer: true, required: false, unique: false, localised: false }
            ],
            settings: {
                aiIntelligence: {
                    enabled: true,
                    operations: ["tag", "ner", "deduplicate"],
                    tagTaxonomy: ["AI", "Database", "Vector Search", "Machine Learning", "Backend", "Frontend", "DevOps", "Data Science", "Security", "Architecture"]
                },
                graph: {
                    enabled: true,
                    allowedEdgeTypes: [
                        { edgeType: "references", label: "References", targetContentTypes: ["article", "concept", "person"] },
                        { edgeType: "relatedTo", label: "Related To", targetContentTypes: ["article"] }
                    ],
                    inferenceStrategies: ["ner", "similarity"]
                }
            },
            createdBy: adminId
        } as Omit<Parameters<typeof registry.register>[0], 'id'>);
    }

    if (!registry.get("concept")) {
        await registry.register({
            name: "concept",
            displayName: "Concept",
            fields: [
                { name: "title", label: "Title", type: "text", required: true, unique: false, localised: false },
                { name: "slug", label: "Slug", type: "slug", generatedFrom: "title", required: true, unique: true, localised: false },
                { name: "definition", label: "Definition", type: "text", required: true, unique: false, localised: false },
                { name: "relatedTerms", label: "Related Terms", type: "text", required: false, unique: false, localised: false },
                { name: "category", label: "Category", type: "select", options: themes.map(t => ({label: t, value: t})), required: false, unique: false, localised: false }
            ],
            settings: {
                aiIntelligence: { enabled: true, operations: ["tag", "ner"] },
                graph: {
                    enabled: true,
                    allowedEdgeTypes: [{ edgeType: "relatedTo", label: "Related To", targetContentTypes: ["concept"] }],
                    inferenceStrategies: ["similarity"]
                }
            },
            createdBy: adminId
        } as Omit<Parameters<typeof registry.register>[0], 'id'>);
    }

    if (!registry.get("person")) {
        await registry.register({
            name: "person",
            displayName: "Person",
            fields: [
                { name: "name", label: "Name", type: "text", required: true, unique: false, localised: false },
                { name: "slug", label: "Slug", type: "slug", generatedFrom: "name", required: true, unique: true, localised: false },
                { name: "role", label: "Role", type: "text", required: false, unique: false, localised: false },
                { name: "bio", label: "Bio", type: "text", required: false, unique: false, localised: false },
                { name: "organisation", label: "Organisation", type: "text", required: false, unique: false, localised: false }
            ],
            settings: {
                aiIntelligence: { enabled: true, operations: ["tag", "ner"] },
                graph: {
                    enabled: true,
                    allowedEdgeTypes: [{ edgeType: "worksWith", label: "Works With", targetContentTypes: ["person"] }],
                    inferenceStrategies: ["ner"]
                }
            },
            createdBy: adminId
        } as Omit<Parameters<typeof registry.register>[0], 'id'>);
    }

    console.log("📝 Creating Entries...");
    const people = generatePeople();
    const concepts = generateConcepts();
    const articles = generateArticles();

    const createdEntries: { id: string, type: string }[] = [];

    for (const p of people) {
        const entry = await contentCrudService.create({ contentTypeName: "person", data: p, createdBy: adminId });
        createdEntries.push({ id: entry.id, type: "person" });
    }
    for (const c of concepts) {
        const entry = await contentCrudService.create({ contentTypeName: "concept", data: c, createdBy: adminId });
        createdEntries.push({ id: entry.id, type: "concept" });
    }
    for (const a of articles) {
        const entry = await contentCrudService.create({ contentTypeName: "article", data: a, createdBy: adminId });
        createdEntries.push({ id: entry.id, type: "article" });
    }

    console.log(`🚀 Publishing ${createdEntries.length} entries to trigger AI pipelines...`);
    for (const e of createdEntries) {
        await contentCrudService.publish(e.id, adminId);
    }

    console.log("⏳ Waiting for AI embeddings to be generated (max 120s)...");
    let attempts = 0;
    while (attempts < 60) {
        try {
            const res = await db.execute(sql`SELECT COUNT(*) as count FROM rosmarium_article_embeddings`);
            const count = Number(res[0]?.count ?? 0);
            if (count >= 25) {
                console.log(`✅ Embeddings generated successfully (${count} found).`);
                break;
            }
        } catch {
            // Table might not exist yet if AI worker is just starting to process
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
    }

    if (attempts >= 60) {
        console.warn("⚠️ Timeout waiting for embeddings. Graph relationships might be incomplete.");
    }

    console.log("🔗 Creating manual graph edges...");
    const articleEntries = createdEntries.filter(e => e.type === "article");
    const conceptEntries = createdEntries.filter(e => e.type === "concept");

    if (articleEntries.length >= 2 && conceptEntries.length >= 2) {
        const manualEdges = [
            { from: articleEntries[0], to: articleEntries[1], type: "relatedTo" },
            { from: articleEntries[1], to: articleEntries[2], type: "relatedTo" },
            { from: articleEntries[2], to: conceptEntries[0], type: "references" },
            { from: articleEntries[3], to: conceptEntries[1], type: "references" },
            { from: articleEntries[4], to: conceptEntries[2], type: "references" },
            { from: articleEntries[5], to: articleEntries[0], type: "references" },
            { from: articleEntries[6], to: conceptEntries[0], type: "references" },
        ];

        for (const edge of manualEdges) {
            try {
                await graphService.createEdge({
                    fromEntryId: edge.from!.id,
                    fromContentType: edge.from!.type,
                    toEntryId: edge.to!.id,
                    toContentType: edge.to!.type,
                    edgeType: edge.type,
                    source: "manual",
                    createdBy: adminId
                });
            } catch (err) {
                console.warn(`Failed to create edge:`, err);
            }
        }
    }

    console.log("🧠 Triggering graph analytics compute...");
    try {
        await analyticsClient.triggerCompute("article", adminId);
        await analyticsClient.triggerCompute("concept", adminId);
        await analyticsClient.triggerCompute("person", adminId);
    } catch (err) {
        console.warn("⚠️ Failed to trigger analytics compute:", err);
    }

    console.log("🎉 Rosmarium Discovery Demo Seed complete!");
    console.log("Check the Admin UI to explore the dataset and AI metadata.");
    process.exit(0);
}

seedDemo().catch((err) => {
    console.error("❌ Demo Seed failed:", err);
    process.exit(1);
});
