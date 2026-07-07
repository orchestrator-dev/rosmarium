import { describe, it, expect, beforeEach, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

// In-memory mock database store
let mockComponents: any[] = [];

vi.mock("drizzle-orm", () => ({
  eq: (col: any, val: any) => ({ __col: col, __val: val, __type: "eq" }),
}));

vi.mock("../../db/index.js", () => {
  const getColKey = (col: any) => {
    if (typeof col === "string") return col;
    const raw = col.name || col.key || col._name || col.columnName || col;
    return raw.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
  };

  const matchesCond = (item: any, cond: any) => {
    if (!cond) return true;
    if (cond.__type === "eq") {
      const key = getColKey(cond.__col);
      return item[key] === cond.__val;
    }
    return true;
  };

  const db = {
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: async () => {
          const newRecord = {
            id: val.id || createId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...val,
          };
          mockComponents.push(newRecord);
          return [newRecord];
        },
      }),
    }),
    select: () => ({
      from: (table: any) => ({
        orderBy: async (col: any) => {
          return [...mockComponents].sort((a, b) => (a.name > b.name ? 1 : -1));
        },
        where: (cond: any) => ({
          limit: async (n: number) => {
            const filtered = mockComponents.filter((item) => matchesCond(item, cond));
            return filtered.slice(0, n);
          },
          orderBy: async (col: any) => {
            const filtered = mockComponents.filter((item) => matchesCond(item, cond));
            return filtered.sort((a, b) => (a.name > b.name ? 1 : -1));
          },
        }),
      }),
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: (cond: any) => ({
          returning: async () => {
            const updated: any[] = [];
            mockComponents = mockComponents.map((item) => {
              if (matchesCond(item, cond)) {
                const mod = { ...item, ...val, updatedAt: new Date() };
                updated.push(mod);
                return mod;
              }
              return item;
            });
            return updated;
          },
        }),
      }),
    }),
    delete: (table: any) => ({
      where: (cond: any) => ({
        returning: async () => {
          const deleted: any[] = [];
          mockComponents = mockComponents.filter((item) => {
            if (matchesCond(item, cond)) {
              deleted.push(item);
              return false;
            }
            return true;
          });
          return deleted;
        },
      }),
    }),
  };

  return { db };
});

import { componentService } from "./component.service.js";

describe("Component Registry Service (V3 Phase 2)", () => {
  beforeEach(() => {
    mockComponents = [];
  });

  it("should register a new component with props and defaultProps", async () => {
    const comp = await componentService.registerComponent({
      name: "HeroBanner",
      category: "Marketing",
      description: "A large hero banner",
      framework: "react",
      source: "@components/HeroBanner",
      props: [
        { name: "title", type: "text", label: "Title", required: true },
        { name: "subtitle", type: "text", label: "Subtitle", required: false },
      ],
      defaultProps: { title: "Welcome", subtitle: "To our platform" },
    });

    expect(comp.id).toBeDefined();
    expect(comp.name).toBe("HeroBanner");
    expect(comp.category).toBe("Marketing");
    expect(comp.props).toHaveLength(2);
    expect((comp.defaultProps as any).title).toBe("Welcome");
  });

  it("should register a component with variants", async () => {
    const comp = await componentService.registerComponent({
      name: "Button",
      category: "UI",
      description: "Interactive button",
      framework: "react",
      source: "@components/Button",
      props: [{ name: "label", type: "text", label: "Label", required: true }],
      defaultProps: { label: "Click me" },
      variants: [
        { name: "Primary", props: { label: "Primary Action", variant: "primary" } },
        { name: "Secondary", props: { label: "Secondary Action", variant: "secondary" } },
      ],
    });

    expect(comp.variants).toHaveLength(2);
    expect((comp.variants as any)[0].name).toBe("Primary");
  });

  it("should get a component by id", async () => {
    const created = await componentService.registerComponent({
      name: "TestComponent",
      category: "UI",
      description: "Test",
      framework: "vue",
      source: "./test",
      props: [],
      defaultProps: {},
    });

    const fetched = await componentService.getComponentById(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe("TestComponent");
  });

  it("should return undefined when getting a non-existent component by id", async () => {
    const fetched = await componentService.getComponentById("non-existent");
    expect(fetched).toBeUndefined();
  });

  it("should get all registered components ordered by name", async () => {
    await componentService.registerComponent({
      name: "ZebraBanner",
      category: "Marketing",
      description: "Zebra",
      framework: "react",
      source: "./z",
      props: [],
      defaultProps: {},
    });
    await componentService.registerComponent({
      name: "AlphaBanner",
      category: "Marketing",
      description: "Alpha",
      framework: "react",
      source: "./a",
      props: [],
      defaultProps: {},
    });

    const all = await componentService.getComponents();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe("AlphaBanner");
    expect(all[1].name).toBe("ZebraBanner");
  });

  it("should get components filtered by category", async () => {
    await componentService.registerComponent({
      name: "Hero",
      category: "Marketing",
      description: "Hero",
      framework: "react",
      source: "./h",
      props: [],
      defaultProps: {},
    });
    await componentService.registerComponent({
      name: "Navbar",
      category: "Navigation",
      description: "Nav",
      framework: "react",
      source: "./n",
      props: [],
      defaultProps: {},
    });

    const marketing = await componentService.getComponentsByCategory("Marketing");
    expect(marketing).toHaveLength(1);
    expect(marketing[0].name).toBe("Hero");
  });

  it("should update a component's description and props", async () => {
    const created = await componentService.registerComponent({
      name: "Card",
      category: "UI",
      description: "Basic card",
      framework: "react",
      source: "./card",
      props: [],
      defaultProps: {},
    });

    const updated = await componentService.updateComponent(created.id, {
      description: "Updated card description",
      props: [{ name: "elevation", type: "number", label: "Elevation", required: false }],
    });

    expect(updated?.description).toBe("Updated card description");
    expect(updated?.props).toHaveLength(1);
  });

  it("should delete a component and ensure it is removed", async () => {
    const created = await componentService.registerComponent({
      name: "ToDelete",
      category: "UI",
      description: "Test",
      framework: "html",
      source: "./test",
      props: [],
      defaultProps: {},
    });

    const deleted = await componentService.deleteComponent(created.id);
    expect(deleted?.id).toBe(created.id);

    const fetched = await componentService.getComponentById(created.id);
    expect(fetched).toBeUndefined();
  });

  it("should register a component with federated data binding in props", async () => {
    const comp = await componentService.registerComponent({
      name: "ProductCard",
      category: "E-Commerce",
      description: "Displays a Shopify product via federated GraphQL query",
      framework: "react",
      source: "@components/ProductCard",
      props: [
        {
          name: "product",
          type: "federated",
          label: "Shopify Product",
          required: true,
          dataBinding: {
            source: "shopify",
            query: "query ($handle: String!) { shopify_product(handle: $handle) { id title price } }",
            variableMapping: { handle: "page.slug" },
          },
        },
      ],
      defaultProps: {},
    });

    expect(comp.props).toHaveLength(1);
    const prop = (comp.props as any)[0];
    expect(prop.type).toBe("federated");
    expect(prop.dataBinding.source).toBe("shopify");
    expect(prop.dataBinding.variableMapping.handle).toBe("page.slug");
  });
});
