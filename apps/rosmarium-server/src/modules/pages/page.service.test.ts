import { describe, it, expect, beforeEach, vi } from "vitest";
import { createId } from "@paralleldrive/cuid2";

let mockPages: any[] = [];
let mockSections: any[] = [];

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
    transaction: async (cb: any) => cb(db),
    insert: (table: any) => ({
      values: (val: any) => {
        const isSectionTable = Boolean(table?.pageId || table?.componentId || table?.order || (Array.isArray(val) && val[0]?.pageId) || val?.pageId);

        if (isSectionTable) {
          const arr = Array.isArray(val) ? val : [val];
          const inserted = arr.map((item) => ({
            id: item.id || createId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...item,
          }));
          mockSections.push(...inserted);
          return {
            returning: async () => inserted,
            then: (resolve: any, reject: any) => Promise.resolve(inserted).then(resolve, reject),
          };
        } else {
          const arr = Array.isArray(val) ? val : [val];
          const inserted = arr.map((item) => ({
            id: item.id || createId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...item,
          }));
          mockPages.push(...inserted);
          return {
            returning: async () => inserted,
            then: (resolve: any, reject: any) => Promise.resolve(inserted).then(resolve, reject),
          };
        }
      },
    }),
    select: () => ({
      from: (table: any) => {
        const isSectionTable = Boolean(table?.pageId || table?.componentId || table?.order);
        const store = isSectionTable ? mockSections : mockPages;

        return {
          orderBy: async (col: any) => {
            return [...store].sort((a, b) => {
              if (isSectionTable) return (a.order ?? 0) - (b.order ?? 0);
              return a.createdAt > b.createdAt ? 1 : -1;
            });
          },
          where: (cond: any) => {
            const filtered = store.filter((item) => matchesCond(item, cond));
            return {
              limit: async (n: number) => filtered.slice(0, n),
              orderBy: async (col: any) => {
                return [...filtered].sort((a, b) => {
                  if (isSectionTable) return (a.order ?? 0) - (b.order ?? 0);
                  return a.createdAt > b.createdAt ? 1 : -1;
                });
              },
              then: (resolve: any, reject: any) => Promise.resolve(filtered).then(resolve, reject),
            };
          },
          then: (resolve: any, reject: any) => Promise.resolve(store).then(resolve, reject),
        };
      },
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: (cond: any) => {
          const isSectionTable = Boolean(table?.pageId || table?.componentId || table?.order);
          const store = isSectionTable ? mockSections : mockPages;
          const updated: any[] = [];

          if (isSectionTable) {
            mockSections = mockSections.map((item) => {
              if (matchesCond(item, cond)) {
                const mod = { ...item, ...val, updatedAt: new Date() };
                updated.push(mod);
                return mod;
              }
              return item;
            });
          } else {
            mockPages = mockPages.map((item) => {
              if (matchesCond(item, cond)) {
                const mod = { ...item, ...val, updatedAt: new Date() };
                updated.push(mod);
                return mod;
              }
              return item;
            });
          }

          return {
            returning: async () => updated,
            then: (resolve: any, reject: any) => Promise.resolve(updated).then(resolve, reject),
          };
        },
      }),
    }),
    delete: (table: any) => ({
      where: (cond: any) => {
        const isSectionTable = Boolean(table?.pageId || table?.componentId || table?.order);
        const deleted: any[] = [];

        if (isSectionTable) {
          mockSections = mockSections.filter((item) => {
            if (matchesCond(item, cond)) {
              deleted.push(item);
              return false;
            }
            return true;
          });
        } else {
          mockPages = mockPages.filter((item) => {
            if (matchesCond(item, cond)) {
              deleted.push(item);
              // Cascade delete sections for this page
              mockSections = mockSections.filter((s) => s.pageId !== item.id);
              return false;
            }
            return true;
          });
        }

        return {
          returning: async () => deleted,
          then: (resolve: any, reject: any) => Promise.resolve(deleted).then(resolve, reject),
        };
      },
    }),
  };

  return { db };
});

import { pageService } from "./page.service.js";

describe("Page Composition Service (V3 Phase 2)", () => {
  beforeEach(() => {
    mockPages = [];
    mockSections = [];
  });

  it("should create a page without sections", async () => {
    const page = await pageService.createPage({
      slug: "/home",
      title: "Home Page",
      locale: "en",
      template: "default",
      seo: { title: "Home", description: "Welcome home" },
    });

    expect(page).toBeDefined();
    expect(page?.id).toBeDefined();
    expect(page?.slug).toBe("/home");
    expect(page?.title).toBe("Home Page");
    expect(page?.sections).toHaveLength(0);
  });

  it("should create a page with ordered sections and component props", async () => {
    const page = await pageService.createPage({
      slug: "/landing",
      title: "Landing Page",
      locale: "en",
      seo: { title: "Landing", description: "Landing page" },
      sections: [
        { componentId: "comp-hero", props: { title: "Welcome" }, order: 0 },
        { componentId: "comp-features", props: { count: 3 }, order: 1 },
      ],
    });

    expect(page?.sections).toHaveLength(2);
    expect(page?.sections[0].componentId).toBe("comp-hero");
    expect(page?.sections[1].componentId).toBe("comp-features");
    expect((page?.sections[0].props as any).title).toBe("Welcome");
  });

  it("should get all created pages ordered by createdAt", async () => {
    await pageService.createPage({ slug: "/page-1", title: "Page 1", locale: "en", seo: { title: "", description: "" } });
    await pageService.createPage({ slug: "/page-2", title: "Page 2", locale: "en", seo: { title: "", description: "" } });

    const pages = await pageService.getPages();
    expect(pages).toHaveLength(2);
    expect(pages[0].slug).toBe("/page-1");
    expect(pages[1].slug).toBe("/page-2");
  });

  it("should get a page by ID including its ordered sections", async () => {
    const created = await pageService.createPage({
      slug: "/about",
      title: "About Us",
      locale: "en",
      seo: { title: "About", description: "" },
      sections: [
        { componentId: "comp-header", props: {}, order: 0 },
        { componentId: "comp-body", props: {}, order: 1 },
      ],
    });

    const fetched = await pageService.getPageById(created!.id);
    expect(fetched).toBeDefined();
    expect(fetched?.slug).toBe("/about");
    expect(fetched?.sections).toHaveLength(2);
  });

  it("should return null when getting a non-existent page by ID", async () => {
    const fetched = await pageService.getPageById("non-existent-id");
    expect(fetched).toBeNull();
  });

  it("should get a page by slug including its sections", async () => {
    await pageService.createPage({
      slug: "/contact",
      title: "Contact Us",
      locale: "en",
      seo: { title: "Contact", description: "" },
      sections: [{ componentId: "comp-form", props: { email: "contact@example.com" }, order: 0 }],
    });

    const fetched = await pageService.getPageBySlug("/contact");
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe("Contact Us");
    expect(fetched?.sections).toHaveLength(1);
    expect((fetched?.sections[0].props as any).email).toBe("contact@example.com");
  });

  it("should return null when getting a non-existent page by slug", async () => {
    const fetched = await pageService.getPageBySlug("/non-existent-slug");
    expect(fetched).toBeNull();
  });

  it("should update page metadata (title, slug, seo, personalization)", async () => {
    const created = await pageService.createPage({
      slug: "/old-slug",
      title: "Old Title",
      locale: "en",
      seo: { title: "Old", description: "" },
    });

    const updated = await pageService.updatePage(created!.id, {
      title: "New Title",
      slug: "/new-slug",
      seo: { title: "New SEO Title", description: "Updated description" },
    });

    expect(updated?.title).toBe("New Title");
    expect(updated?.slug).toBe("/new-slug");
    expect((updated?.seo as any).title).toBe("New SEO Title");
  });

  it("should replace page sections when updating sections array", async () => {
    const created = await pageService.createPage({
      slug: "/replace-test",
      title: "Replace Test",
      locale: "en",
      seo: { title: "", description: "" },
      sections: [{ componentId: "comp-1", props: { val: 1 }, order: 0 }],
    });

    expect(created?.sections).toHaveLength(1);

    const updated = await pageService.updatePage(created!.id, {
      sections: [
        { componentId: "comp-2", props: { val: 2 }, order: 0 },
        { componentId: "comp-3", props: { val: 3 }, order: 1 },
      ],
    });

    expect(updated?.sections).toHaveLength(2);
    expect(updated?.sections[0].componentId).toBe("comp-2");
    expect(updated?.sections[1].componentId).toBe("comp-3");
  });

  it("should delete a page and cascade delete its sections", async () => {
    const created = await pageService.createPage({
      slug: "/to-delete",
      title: "Delete Me",
      locale: "en",
      seo: { title: "", description: "" },
      sections: [{ componentId: "comp-del", props: {}, order: 0 }],
    });

    expect(mockSections).toHaveLength(1);

    await pageService.deletePage(created!.id);

    const fetched = await pageService.getPageById(created!.id);
    expect(fetched).toBeNull();
    expect(mockSections).toHaveLength(0);
  });

  it("should handle page composition with federated GraphQL data binding on section props", async () => {
    const page = await pageService.createPage({
      slug: "/products/chair",
      title: "Ergonomic Chair",
      locale: "en",
      seo: { title: "Chair", description: "" },
      sections: [
        {
          componentId: "comp-product-showcase",
          props: {
            productData: {
              dataBinding: {
                source: "shopify",
                query: "query ($handle: String!) { shopify_product(handle: $handle) { title price description } }",
                variableMapping: { handle: "page.slug" },
              },
            },
            showPrice: true,
          },
          order: 0,
        },
      ],
    });

    expect(page?.sections).toHaveLength(1);
    const section = page?.sections[0];
    const props = section.props as any;
    expect(props.showPrice).toBe(true);
    expect(props.productData.dataBinding.source).toBe("shopify");
    expect(props.productData.dataBinding.variableMapping.handle).toBe("page.slug");
  });

  it("should handle page composition with personalization rules and audience conditions", async () => {
    const page = await pageService.createPage({
      slug: "/promo",
      title: "Promotion",
      locale: "en",
      seo: { title: "Promo", description: "" },
      sections: [
        {
          componentId: "comp-banner-default",
          props: { title: "Standard Discount" },
          conditions: [],
          order: 0,
        },
        {
          componentId: "comp-banner-vip",
          props: { title: "VIP Exclusive Discount 50%!" },
          conditions: [{ trait: "user.tier", operator: "eq", value: "VIP" }],
          order: 1,
        },
      ],
      personalization: [
        {
          segmentId: "seg-vip-users",
          variants: [
            { id: "var-1", componentId: "comp-banner-vip", props: { title: "VIP Banner" }, order: 0 },
          ],
        },
      ],
    });

    expect(page?.sections).toHaveLength(2);
    expect((page?.sections[1].conditions as any)[0].trait).toBe("user.tier");
    expect((page?.personalization as any)[0].segmentId).toBe("seg-vip-users");
  });
});
