import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Hoisted mocks for services and DB
const {
    mockContentCrudService,
    mockSearchService,
    mockGraphService,
    mockIntelligenceService,
    mockWorkflowService,
    mockSchedulerService,
    mockRegistry,
    mockI18nService,
    mockDb,
    mockPluginRegistry,
} = vi.hoisted(() => {
    return {
        mockContentCrudService: {
            findMany: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            publish: vi.fn(),
            unpublish: vi.fn(),
            delete: vi.fn(),
        },
        mockSearchService: {
            search: vi.fn(),
        },
        mockGraphService: {
            getEdgesForEntry: vi.fn(),
        },
        mockIntelligenceService: {
            summarize: vi.fn(),
            tagEntry: vi.fn(),
        },
        mockWorkflowService: {
            getHistory: vi.fn(),
            transition: vi.fn(),
            getWorkflows: vi.fn(),
        },
        mockSchedulerService: {
            scheduleAction: vi.fn(),
            cancelScheduled: vi.fn(),
            getScheduledJobs: vi.fn(),
        },
        mockRegistry: {
            getAll: vi.fn(),
        },
        mockI18nService: {
            getLocales: vi.fn(),
            getFallbackChain: vi.fn(),
        },
        mockDb: {
            query: {
                contentTypes: {
                    findMany: vi.fn(),
                    findFirst: vi.fn(),
                },
            },
        },
        mockPluginRegistry: {
            getAll: vi.fn(),
        },
    };
});

vi.mock("../modules/content/crud.service.js", () => ({
    contentCrudService: mockContentCrudService,
}));
vi.mock("../modules/search/search.service.js", () => ({
    searchService: mockSearchService,
}));
vi.mock("../modules/graph/graph.service.js", () => ({
    graphService: mockGraphService,
}));
vi.mock("../modules/intelligence/intelligence.service.js", () => ({
    intelligenceService: mockIntelligenceService,
}));
vi.mock("../modules/workflow/workflow.service.js", () => ({
    workflowService: mockWorkflowService,
}));
vi.mock("../modules/content/scheduler.service.js", () => ({
    schedulerService: mockSchedulerService,
}));
vi.mock("../modules/content/registry.js", () => ({
    registry: mockRegistry,
}));
vi.mock("../modules/i18n/i18n.service.js", () => ({
    i18nService: mockI18nService,
}));
vi.mock("../db/index.js", () => ({
    db: mockDb,
}));
vi.mock("../plugins/plugin-registry.js", () => ({
    pluginRegistry: mockPluginRegistry,
}));

// Import modules under test after mocks are registered
import { registerContentTools } from "./tools/content.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerSearchTools } from "./tools/search.js";
import { registerAiTools } from "./tools/ai.js";
import { registerWorkflowTools } from "./tools/workflow.js";
import { registerResources } from "./resources/index.js";
import { registerPluginMcpTools } from "./plugin-bridge.js";
import { mcpAuth } from "./auth.js";

function createMockServer() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const tools = new Map<string, { description: string; schema: unknown; handler: Function }>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const resources = new Map<string, { uri: string; opts: unknown; handler: Function }>();

    return {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        tool: vi.fn((name: string, description: string, schema: unknown, handler: Function) => {
            tools.set(name, { description, schema, handler });
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        resource: vi.fn((name: string, uri: string, opts: unknown, handler: Function) => {
            resources.set(name, { uri, opts, handler });
        }),
        tools,
        resources,
    };
}

describe("MCP Server Tools & Resources", () => {
    let server: ReturnType<typeof createMockServer>;

    beforeEach(() => {
        vi.clearAllMocks();
        server = createMockServer();
    });

    // ── Group 1: Content Tools ──────────────────────────────────────────
    describe("Content Tools", () => {
        beforeEach(() => {
            registerContentTools(server as unknown as McpServer);
        });

        it("content_list returns paginated results", async () => {
            mockContentCrudService.findMany.mockResolvedValueOnce({
                entries: [{ id: "entry-1", title: "Test" }],
                nextCursor: "cursor-1",
                total: 1,
            });

            const handler = server.tools.get("content_list")!.handler;
            const res = await handler({ contentType: "article", limit: 10 });

            expect(mockContentCrudService.findMany).toHaveBeenCalledWith({
                contentTypeName: "article",
                pagination: { limit: 10, cursor: undefined },
                locale: undefined,
                status: undefined,
                filters: undefined,
            });
            expect(res.content[0].text).toContain("entry-1");
        });

        it("content_get returns a single entry", async () => {
            mockContentCrudService.findOne.mockResolvedValueOnce({
                id: "entry-1",
                title: "Test",
            });

            const handler = server.tools.get("content_get")!.handler;
            const res = await handler({
                contentType: "article",
                id: "entry-1",
                populate: true,
            });

            expect(mockContentCrudService.findOne).toHaveBeenCalledWith({
                contentTypeName: "article",
                id: "entry-1",
                locale: undefined,
                populate: true,
            });
            expect(res.content[0].text).toContain("entry-1");
        });

        it("content_create creates and returns entry", async () => {
            mockContentCrudService.create.mockResolvedValueOnce({
                id: "entry-2",
                title: "New Article",
            });

            const handler = server.tools.get("content_create")!.handler;
            const res = await handler({
                contentType: "article",
                data: { title: "New Article" },
                locale: "en",
                createdBy: "agent",
            });

            expect(mockContentCrudService.create).toHaveBeenCalledWith({
                contentTypeName: "article",
                data: { title: "New Article" },
                locale: "en",
                createdBy: "agent",
            });
            expect(res.content[0].text).toContain("entry-2");
        });

        it("content_update updates an entry", async () => {
            mockContentCrudService.update.mockResolvedValueOnce({
                id: "entry-1",
                title: "Updated Title",
            });

            const handler = server.tools.get("content_update")!.handler;
            const res = await handler({
                id: "entry-1",
                contentType: "article",
                data: { title: "Updated Title" },
                updatedBy: "agent",
            });

            expect(mockContentCrudService.update).toHaveBeenCalledWith({
                id: "entry-1",
                contentTypeName: "article",
                data: { title: "Updated Title" },
                updatedBy: "agent",
            });
            expect(res.content[0].text).toContain("Updated Title");
        });

        it("content_publish publishes an entry", async () => {
            mockContentCrudService.publish.mockResolvedValueOnce({
                id: "entry-1",
                status: "published",
            });

            const handler = server.tools.get("content_publish")!.handler;
            const res = await handler({ id: "entry-1", publishedBy: "agent" });

            expect(mockContentCrudService.publish).toHaveBeenCalledWith("entry-1", "agent");
            expect(res.content[0].text).toContain("published");
        });

        it("content_delete deletes an entry", async () => {
            mockContentCrudService.delete.mockResolvedValueOnce();

            const handler = server.tools.get("content_delete")!.handler;
            const res = await handler({
                id: "entry-1",
                contentType: "article",
                deletedBy: "agent",
            });

            expect(mockContentCrudService.delete).toHaveBeenCalledWith("entry-1", "article", "agent");
            expect(res.content[0].text).toContain("success");
        });
    });

    // ── Group 2: Schema Tools ───────────────────────────────────────────
    describe("Schema Tools", () => {
        beforeEach(() => {
            registerSchemaTools(server as unknown as McpServer);
        });

        it("schema_list returns all content types", async () => {
            mockDb.query.contentTypes.findMany.mockResolvedValueOnce([
                { slug: "article", name: "Article" },
            ]);

            const handler = server.tools.get("schema_list")!.handler;
            const res = await handler({});

            expect(mockDb.query.contentTypes.findMany).toHaveBeenCalled();
            expect(res.content[0].text).toContain("article");
        });

        it("schema_get returns specific content type by slug", async () => {
            mockDb.query.contentTypes.findFirst.mockResolvedValueOnce({
                slug: "article",
                name: "Article",
            });

            const handler = server.tools.get("schema_get")!.handler;
            const res = await handler({ slug: "article" });

            expect(mockDb.query.contentTypes.findFirst).toHaveBeenCalled();
            expect(res.content[0].text).toContain("Article");
        });
    });

    // ── Group 3: Search Tools ───────────────────────────────────────────
    describe("Search Tools", () => {
        beforeEach(() => {
            registerSearchTools(server as unknown as McpServer);
        });

        it("search_hybrid calls search service with correct params", async () => {
            mockSearchService.search.mockResolvedValueOnce({
                data: [{ id: "res-1", title: "Found" }],
                meta: { total: 1 },
            });

            const handler = server.tools.get("search_hybrid")!.handler;
            const res = await handler({
                query: "test",
                limit: 5,
                status: "published",
                alpha: 0.5,
            });

            expect(mockSearchService.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: "test",
                    limit: 5,
                    status: "published",
                    alpha: 0.5,
                    user: expect.objectContaining({ id: "mcp-system" }),
                })
            );
            expect(res.content[0].text).toContain("res-1");
        });

        it("search_graph returns edges for entry", async () => {
            mockGraphService.getEdgesForEntry.mockResolvedValueOnce([
                { id: "edge-1", from: "entry-1", to: "entry-2" },
            ]);

            const handler = server.tools.get("search_graph")!.handler;
            const res = await handler({ entryId: "entry-1", direction: "both" });

            expect(mockGraphService.getEdgesForEntry).toHaveBeenCalledWith({
                entryId: "entry-1",
                direction: "both",
            });
            expect(res.content[0].text).toContain("edge-1");
        });
    });

    // ── Group 4: AI Tools ───────────────────────────────────────────────
    describe("AI Tools", () => {
        beforeEach(() => {
            registerAiTools(server as unknown as McpServer);
        });

        it("ai_summarize calls intelligence service", async () => {
            mockContentCrudService.findOne.mockResolvedValueOnce({
                id: "entry-1",
                data: { body: "Long text here" },
            });
            mockIntelligenceService.summarize.mockResolvedValueOnce({
                summary: "Short text",
                word_count: 2,
            });

            const handler = server.tools.get("ai_summarize")!.handler;
            const res = await handler({
                entryId: "entry-1",
                contentType: "article",
                style: "brief",
            });

            expect(mockIntelligenceService.summarize).toHaveBeenCalledWith(
                expect.objectContaining({
                    entryId: "entry-1",
                    text: JSON.stringify({ body: "Long text here" }),
                    style: "brief",
                })
            );
            expect(res.content[0].text).toContain("Short text");
        });

        it("ai_tag calls intelligence service with labels", async () => {
            mockContentCrudService.findOne.mockResolvedValueOnce({
                id: "entry-1",
                data: { title: "AI topic" },
            });
            mockIntelligenceService.tagEntry.mockResolvedValueOnce({
                tags: [{ label: "Tech", score: 0.95 }],
                latencyMs: 50,
            });

            const handler = server.tools.get("ai_tag")!.handler;
            const res = await handler({
                entryId: "entry-1",
                contentType: "article",
                labels: ["Tech", "Sports"],
            });

            expect(mockIntelligenceService.tagEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    entryId: "entry-1",
                    labels: ["Tech", "Sports"],
                })
            );
            expect(res.content[0].text).toContain("Tech");
        });
    });

    // ── Group 5: Workflow Tools ─────────────────────────────────────────
    describe("Workflow Tools", () => {
        beforeEach(() => {
            registerWorkflowTools(server as unknown as McpServer);
        });

        it("workflow_status returns history", async () => {
            mockWorkflowService.getHistory.mockResolvedValueOnce([
                { id: "hist-1", toState: "review" },
            ]);

            const handler = server.tools.get("workflow_status")!.handler;
            const res = await handler({ entryId: "entry-1" });

            expect(mockWorkflowService.getHistory).toHaveBeenCalledWith("entry-1");
            expect(res.content[0].text).toContain("review");
        });

        it("workflow_transition transitions entry state", async () => {
            mockWorkflowService.transition.mockResolvedValueOnce({ success: true });

            const handler = server.tools.get("workflow_transition")!.handler;
            const res = await handler({
                entryId: "entry-1",
                toState: "published",
                userId: "user-1",
                comment: "LGTM",
            });

            expect(mockWorkflowService.transition).toHaveBeenCalledWith(
                "entry-1",
                "published",
                "user-1",
                "LGTM"
            );
            expect(res.content[0].text).toContain("true");
        });

        it("schedule_publish schedules future publication", async () => {
            mockSchedulerService.scheduleAction.mockResolvedValueOnce("job-123");

            const handler = server.tools.get("schedule_publish")!.handler;
            const futureDate = "2026-12-01T10:00:00.000Z";
            const res = await handler({
                entryId: "entry-1",
                scheduledAt: futureDate,
                action: "publish",
                userId: "user-1",
                contentTypeName: "article",
            });

            expect(mockSchedulerService.scheduleAction).toHaveBeenCalledWith(
                "entry-1",
                "publish",
                new Date(futureDate),
                "user-1",
                "article"
            );
            expect(res.content[0].text).toContain("job-123");
        });
    });

    // ── Group 6: Resources ──────────────────────────────────────────────
    describe("Resources", () => {
        beforeEach(() => {
            registerResources(server as unknown as McpServer);
        });

        it("content-types resource returns registry types", async () => {
            mockRegistry.getAll.mockReturnValueOnce([
                { name: "article", fields: [{ name: "title", type: "text" }] },
            ]);

            const handler = server.resources.get("content-types")!.handler;
            const res = await handler(new URL("rosmarium://content-types"));

            expect(mockRegistry.getAll).toHaveBeenCalled();
            expect(res.contents[0].text).toContain("article");
        });

        it("locales resource returns locales with fallback chains", async () => {
            mockI18nService.getLocales.mockResolvedValueOnce([
                { code: "en", isDefault: true },
            ]);
            mockI18nService.getFallbackChain.mockResolvedValueOnce(["en"]);

            const handler = server.resources.get("locales")!.handler;
            const res = await handler(new URL("rosmarium://locales"));

            expect(mockI18nService.getLocales).toHaveBeenCalled();
            expect(res.contents[0].text).toContain("en");
        });

        it("workflows resource returns workflow definitions", async () => {
            mockWorkflowService.getWorkflows.mockResolvedValueOnce([
                { id: "wf-1", name: "Default Workflow", isDefault: true, definition: {} },
            ]);

            const handler = server.resources.get("workflows")!.handler;
            const res = await handler(new URL("rosmarium://workflows"));

            expect(mockWorkflowService.getWorkflows).toHaveBeenCalled();
            expect(res.contents[0].text).toContain("Default Workflow");
        });
    });

    // ── Group 7: Auth ───────────────────────────────────────────────────
    describe("Auth", () => {
        it("validateApiKey checks environment variable", () => {
            process.env.MCP_API_KEY = "secret-key-123";
            expect(mcpAuth.validateApiKey("secret-key-123")).toBe(true);
            expect(mcpAuth.validateApiKey("wrong-key")).toBe(false);
            delete process.env.MCP_API_KEY;
        });

        it("getDefaultContext returns default context", () => {
            process.env.MCP_USER_ID = "test-user";
            process.env.MCP_TENANT_ID = "test-tenant";
            const ctx = mcpAuth.getDefaultContext();
            expect(ctx.userId).toBe("test-user");
            expect(ctx.tenantId).toBe("test-tenant");
            delete process.env.MCP_USER_ID;
            delete process.env.MCP_TENANT_ID;
        });
    });

    // ── Group 8: Plugin Bridge ──────────────────────────────────────────
    describe("Plugin Bridge", () => {
        it("registers tools defined by loaded plugins", async () => {
            const mockToolHandler = vi.fn().mockResolvedValue({
                content: [{ type: "text", text: "plugin output" }],
            });

            mockPluginRegistry.getAll.mockReturnValueOnce([
                {
                    name: "seo-plugin",
                    version: "1.0.0",
                    mcpTools: [
                        {
                            name: "analyze_seo",
                            description: "Analyze SEO for text",
                            inputSchema: {},
                            handler: mockToolHandler,
                        },
                    ],
                },
            ]);

            registerPluginMcpTools(server as unknown as McpServer);

            expect(server.tools.has("plugin_seo-plugin_analyze_seo")).toBe(true);
            const handler = server.tools.get("plugin_seo-plugin_analyze_seo")!.handler;
            const res = await handler({ text: "hello" });
            expect(res.content[0].text).toBe("plugin output");
            expect(mockToolHandler).toHaveBeenCalledWith({ text: "hello" });
        });
    });
});
