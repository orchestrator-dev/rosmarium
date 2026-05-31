import { z } from "zod";

export const markSchema = z.enum(["bold", "italic", "underline", "strikethrough", "code"]);
export type Mark = z.infer<typeof markSchema>;

export const inlineNodeSchema = z.object({
    type: z.enum(["text", "link", "mention", "inline-code"]),
    text: z.string(),
    marks: z.array(markSchema).optional(),
});
export type InlineNode = z.infer<typeof inlineNodeSchema>;

const baseBlockSchema = z.object({
    id: z.string(),
});

export const paragraphBlockSchema = baseBlockSchema.extend({
    type: z.literal("paragraph"),
    children: z.array(inlineNodeSchema),
});
export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;

export const headingBlockSchema = baseBlockSchema.extend({
    type: z.literal("heading"),
    level: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
        z.literal(6),
    ]).optional(),
    children: z.array(inlineNodeSchema),
});
export type HeadingBlock = z.infer<typeof headingBlockSchema>;

export const imageBlockSchema = baseBlockSchema.extend({
    type: z.literal("image"),
    url: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
});
export type ImageBlock = z.infer<typeof imageBlockSchema>;

export const codeBlockSchema = baseBlockSchema.extend({
    type: z.literal("code"),
    language: z.string().optional(),
    code: z.string(),
});
export type CodeBlock = z.infer<typeof codeBlockSchema>;

export const quoteBlockSchema = baseBlockSchema.extend({
    type: z.literal("quote"),
    children: z.array(inlineNodeSchema),
});
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;

export const listBlockSchema = baseBlockSchema.extend({
    type: z.literal("list"),
    style: z.enum(["ordered", "unordered"]).optional(),
    items: z.array(z.array(inlineNodeSchema)),
});
export type ListBlock = z.infer<typeof listBlockSchema>;

export const tableBlockSchema = baseBlockSchema.extend({
    type: z.literal("table"),
    rows: z.array(z.array(z.array(inlineNodeSchema))),
});
export type TableBlock = z.infer<typeof tableBlockSchema>;

export const embedBlockSchema = baseBlockSchema.extend({
    type: z.literal("embed"),
    provider: z.string().optional(),
    url: z.string(),
});
export type EmbedBlock = z.infer<typeof embedBlockSchema>;

export const dividerBlockSchema = baseBlockSchema.extend({
    type: z.literal("divider"),
});
export type DividerBlock = z.infer<typeof dividerBlockSchema>;

export const componentBlockSchema = baseBlockSchema.extend({
    type: z.literal("component"),
    componentName: z.string(),
    props: z.record(z.unknown()),
});
export type ComponentBlock = z.infer<typeof componentBlockSchema>;

export const blockSchema = z.discriminatedUnion("type", [
    paragraphBlockSchema,
    headingBlockSchema,
    imageBlockSchema,
    codeBlockSchema,
    quoteBlockSchema,
    listBlockSchema,
    tableBlockSchema,
    embedBlockSchema,
    dividerBlockSchema,
    componentBlockSchema,
]);

export type Block = z.infer<typeof blockSchema>;

export const blockDocumentSchema = z.object({
    version: z.literal(1),
    blocks: z.array(blockSchema),
});

export type BlockDocument = z.infer<typeof blockDocumentSchema>;
