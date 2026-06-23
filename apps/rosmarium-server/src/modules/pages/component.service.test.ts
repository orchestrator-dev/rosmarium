import { describe, it, expect, beforeEach } from "vitest";
import { componentService } from "./component.service.js";
import { db } from "../../db/index.js";
import { components } from "../../db/schema/pages.js";

describe("Component Registry Service", () => {
    beforeEach(async () => {
        await db.delete(components);
    });

    it("should register a new component", async () => {
        const comp = await componentService.registerComponent({
            name: "HeroBanner",
            category: "Marketing",
            description: "A large hero banner",
            framework: "react",
            source: "@components/HeroBanner",
            props: [
                { name: "title", type: "text", label: "Title", required: true }
            ],
            defaultProps: { title: "Welcome" }
        });

        expect(comp.id).toBeDefined();
        expect(comp.name).toBe("HeroBanner");
        expect(comp.category).toBe("Marketing");
    });

    it("should get a component by id", async () => {
        const comp = await componentService.registerComponent({
            name: "TestComponent",
            category: "UI",
            description: "Test",
            framework: "vue",
            source: "./test",
            props: [],
            defaultProps: {}
        });

        const fetched = await componentService.getComponentById(comp.id);
        expect(fetched).toBeDefined();
        expect(fetched?.name).toBe("TestComponent");
    });

    it("should delete a component", async () => {
        const comp = await componentService.registerComponent({
            name: "ToDelete",
            category: "UI",
            description: "Test",
            framework: "html",
            source: "./test",
            props: [],
            defaultProps: {}
        });

        await componentService.deleteComponent(comp.id);
        const fetched = await componentService.getComponentById(comp.id);
        expect(fetched).toBeUndefined();
    });
});
