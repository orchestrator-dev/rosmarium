import { describe, it, expect } from "vitest";
import type { BlockDocument } from "@orchestrator.dev/types";
import {
    serializeToHtml,
    serializeToMarkdown,
    serializeToPlainText,
} from "./block-serializer.js";

const sampleDoc: BlockDocument = {
    version: 1,
    blocks: [
        {
            type: "heading",
            id: "h1",
            level: 1,
            children: [{ type: "text", text: "Hello World" }],
        },
        {
            type: "paragraph",
            id: "p1",
            children: [
                { type: "text", text: "This is a " },
                { type: "text", text: "bold", marks: ["bold"] },
                { type: "text", text: " text." },
            ],
        },
        {
            type: "image",
            id: "img1",
            url: "https://example.com/img.png",
            alt: "Example Image",
            caption: "This is a caption",
        },
        {
            type: "code",
            id: "code1",
            language: "javascript",
            code: "console.log('Hello');",
        },
        {
            type: "quote",
            id: "q1",
            children: [{ type: "text", text: "To be or not to be" }],
        },
        {
            type: "list",
            id: "l1",
            style: "unordered",
            items: [
                [{ type: "text", text: "Item 1" }],
                [{ type: "text", text: "Item 2" }],
            ],
        },
        {
            type: "divider",
            id: "div1",
        },
    ],
};

describe("block-serializer", () => {
    it("should serialize to HTML correctly", () => {
        const html = serializeToHtml(sampleDoc);
        expect(html).toContain("<h1>Hello World</h1>");
        expect(html).toContain("<p>This is a <strong>bold</strong> text.</p>");
        expect(html).toContain(
            '<figure><img src="https://example.com/img.png" alt="Example Image" /><figcaption>This is a caption</figcaption></figure>',
        );
        expect(html).toContain(
            '<pre><code class="language-javascript">console.log(&#039;Hello&#039;);</code></pre>',
        );
        expect(html).toContain("<blockquote>To be or not to be</blockquote>");
        expect(html).toContain("<ul><li>Item 1</li><li>Item 2</li></ul>");
        expect(html).toContain("<hr />");
    });

    it("should serialize to Markdown correctly", () => {
        const md = serializeToMarkdown(sampleDoc);
        expect(md).toContain("# Hello World");
        expect(md).toContain("This is a **bold** text.");
        expect(md).toContain("![Example Image](https://example.com/img.png)");
        expect(md).toContain("*This is a caption*");
        expect(md).toContain("```javascript\nconsole.log('Hello');\n```");
        expect(md).toContain("> To be or not to be");
        expect(md).toContain("- Item 1");
        expect(md).toContain("- Item 2");
        expect(md).toContain("---");
    });

    it("should serialize to Plain Text correctly", () => {
        const text = serializeToPlainText(sampleDoc);
        expect(text).toContain("Hello World");
        expect(text).toContain("This is a bold text.");
        expect(text).toContain("[Image: Example Image]");
        expect(text).toContain("console.log('Hello');");
        expect(text).toContain("To be or not to be");
        expect(text).toContain("Item 1\nItem 2");
        expect(text).not.toContain("---");
        expect(text).not.toContain("<");
        expect(text).not.toContain("*");
    });
});
