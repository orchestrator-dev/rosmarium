import { describe, it, expect, vi, beforeEach } from "vitest";
import { templatesService } from "./templates.service.js";
import { db } from "../../db/index.js";

vi.mock("../../db/index.js", () => {
    return {
        db: {
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            select: vi.fn(),
        }
    };
});

describe("templates.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create a template", async () => {
        const mockTemplate = { id: "1", name: "T1", templateData: {} };
        const returningMock = vi.fn().mockResolvedValue([mockTemplate]);
        const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
        vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as void);

        const result = await templatesService.create({ name: "T1", templateData: {} });
        expect(result).toEqual(mockTemplate);
        expect(db.insert).toHaveBeenCalled();
    });

    it("should update a template", async () => {
        const mockTemplate = { id: "1", name: "T2", templateData: {} };
        const returningMock = vi.fn().mockResolvedValue([mockTemplate]);
        const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
        const setMock = vi.fn().mockReturnValue({ where: whereMock });
        vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as void);

        const result = await templatesService.update("1", { name: "T2" });
        expect(result).toEqual(mockTemplate);
    });

    it("should delete a template", async () => {
        const returningMock = vi.fn().mockResolvedValue([{ id: "1" }]);
        const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
        vi.mocked(db.delete).mockReturnValue({ where: whereMock } as unknown as void);

        const result = await templatesService.delete("1");
        expect(result).toBe(true);
    });

    it("should get a template by id", async () => {
        const mockTemplate = { id: "1", name: "T1" };
        const whereMock = vi.fn().mockResolvedValue([mockTemplate]);
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as void);

        const result = await templatesService.getById("1");
        expect(result).toEqual(mockTemplate);
    });

    it("should return null if template not found by id", async () => {
        const whereMock = vi.fn().mockResolvedValue([]);
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as void);

        const result = await templatesService.getById("1");
        expect(result).toBeNull();
    });

    it("should list all templates when no contentTypeId provided", async () => {
        const mockTemplates = [{ id: "1", name: "T1" }];
        const dynamicMock = vi.fn().mockResolvedValue(mockTemplates);
        const fromMock = vi.fn().mockReturnValue({ $dynamic: dynamicMock });
        vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as void);

        const result = await templatesService.list();
        expect(result).toEqual(mockTemplates);
    });

    it("should list scoped templates when contentTypeId provided", async () => {
        const mockTemplates = [{ id: "1", name: "T1" }];
        const whereMock = vi.fn().mockResolvedValue(mockTemplates);
        const dynamicMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({ $dynamic: dynamicMock });
        vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as void);

        const result = await templatesService.list("ct-1");
        expect(result).toEqual(mockTemplates);
    });

    it("create should throw if db returns empty", async () => {
        const returningMock = vi.fn().mockResolvedValue([]);
        const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
        vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as void);

        await expect(templatesService.create({ name: "T1", templateData: {} }))
            .rejects.toThrow("Failed to create template");
    });

    it("update should throw if template not found", async () => {
        const returningMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
        const setMock = vi.fn().mockReturnValue({ where: whereMock });
        vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as void);

        await expect(templatesService.update("1", { name: "T2" }))
            .rejects.toThrow("Template not found");
    });

    it("delete should handle no rows affected", async () => {
        const returningMock = vi.fn().mockResolvedValue([]);
        const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
        vi.mocked(db.delete).mockReturnValue({ where: whereMock } as unknown as void);

        const result = await templatesService.delete("1");
        expect(result).toBe(false); 
    });
});
