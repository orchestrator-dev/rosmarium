import type { BlockDocument, InlineNode } from "@orchestrator.dev/types";

function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function serializeInlineNodesHtml(nodes: InlineNode[]): string {
    return nodes
        .map((node) => {
            let content = escapeHtml(node.text);
            if (node.type === "link") {
                content = `<a href="#">${content}</a>`;
            } else if (node.type === "mention") {
                content = `<span class="mention">${content}</span>`;
            } else if (node.type === "inline-code") {
                content = `<code>${content}</code>`;
            }

            if (node.marks) {
                for (const mark of node.marks) {
                    if (mark === "bold") content = `<strong>${content}</strong>`;
                    if (mark === "italic") content = `<em>${content}</em>`;
                    if (mark === "underline") content = `<u>${content}</u>`;
                    if (mark === "strikethrough") content = `<s>${content}</s>`;
                    if (mark === "code") content = `<code>${content}</code>`;
                }
            }
            return content;
        })
        .join("");
}

export function serializeToHtml(doc: BlockDocument): string {
    return doc.blocks
        .map((block) => {
            switch (block.type) {
                case "paragraph":
                    return `<p>${serializeInlineNodesHtml(block.children)}</p>`;
                case "heading": {
                    const level = block.level || 1;
                    return `<h${level}>${serializeInlineNodesHtml(block.children)}</h${level}>`;
                }
                case "image": {
                    const alt = block.alt ? ` alt="${escapeHtml(block.alt)}"` : "";
                    const img = `<img src="${escapeHtml(block.url)}"${alt} />`;
                    if (block.caption) {
                        return `<figure>${img}<figcaption>${escapeHtml(block.caption)}</figcaption></figure>`;
                    }
                    return img;
                }
                case "code":
                    return `<pre><code${block.language ? ` class="language-${escapeHtml(block.language)}"` : ""}>${escapeHtml(block.code)}</code></pre>`;
                case "quote":
                    return `<blockquote>${serializeInlineNodesHtml(block.children)}</blockquote>`;
                case "list": {
                    const tag = block.style === "ordered" ? "ol" : "ul";
                    const items = block.items
                        .map((item) => `<li>${serializeInlineNodesHtml(item)}</li>`)
                        .join("");
                    return `<${tag}>${items}</${tag}>`;
                }
                case "table": {
                    const rows = block.rows
                        .map(
                            (row) =>
                                `<tr>${row
                                    .map(
                                        (cell) =>
                                            `<td>${serializeInlineNodesHtml(cell)}</td>`,
                                    )
                                    .join("")}</tr>`,
                        )
                        .join("");
                    return `<table>${rows}</table>`;
                }
                case "embed":
                    return `<div class="embed" data-url="${escapeHtml(block.url)}"${block.provider ? ` data-provider="${escapeHtml(block.provider)}"` : ""}></div>`;
                case "divider":
                    return `<hr />`;
                case "component":
                    return `<div class="component" data-component="${escapeHtml(block.componentName)}"></div>`;
                default:
                    return "";
            }
        })
        .join("\n");
}

function serializeInlineNodesMarkdown(nodes: InlineNode[]): string {
    return nodes
        .map((node) => {
            let content = node.text;
            if (node.type === "link") {
                content = `[${content}](#)`;
            } else if (node.type === "mention") {
                content = `@${content}`;
            } else if (node.type === "inline-code") {
                content = `\`${content}\``;
            }

            if (node.marks) {
                for (const mark of node.marks) {
                    if (mark === "bold") content = `**${content}**`;
                    if (mark === "italic") content = `_${content}_`;
                    if (mark === "strikethrough") content = `~~${content}~~`;
                    if (mark === "code") content = `\`${content}\``;
                }
            }
            return content;
        })
        .join("");
}

export function serializeToMarkdown(doc: BlockDocument): string {
    return doc.blocks
        .map((block) => {
            switch (block.type) {
                case "paragraph":
                    return `${serializeInlineNodesMarkdown(block.children)}\n`;
                case "heading": {
                    const level = block.level || 1;
                    return `${"#".repeat(level)} ${serializeInlineNodesMarkdown(block.children)}\n`;
                }
                case "image": {
                    let img = `![${block.alt || ""}](${block.url})`;
                    if (block.caption) img += `\n*${block.caption}*`;
                    return `${img}\n`;
                }
                case "code":
                    return `\`\`\`${block.language || ""}\n${block.code}\n\`\`\`\n`;
                case "quote":
                    return `> ${serializeInlineNodesMarkdown(block.children)}\n`;
                case "list": {
                    return (
                        block.items
                            .map((item, i) => {
                                const prefix = block.style === "ordered" ? `${i + 1}.` : "-";
                                return `${prefix} ${serializeInlineNodesMarkdown(item)}`;
                            })
                            .join("\n") + "\n"
                    );
                }
                case "table": {
                    const firstRow = block.rows[0];
                    if (!firstRow) return "";
                    const headers = firstRow.map((cell) => serializeInlineNodesMarkdown(cell));
                    const separator = headers.map(() => "---");
                    const rows = [headers, separator, ...block.rows.slice(1).map(row => row.map(cell => serializeInlineNodesMarkdown(cell)))]
                    return rows.map(r => `| ${r.join(" | ")} |`).join("\n") + "\n";
                }
                case "embed":
                    return `[Embed${block.provider ? ` from ${block.provider}` : ""}](${block.url})\n`;
                case "divider":
                    return `---\n`;
                case "component":
                    return `[Component: ${block.componentName}]\n`;
                default:
                    return "";
            }
        })
        .join("\n");
}

function serializeInlineNodesPlainText(nodes: InlineNode[]): string {
    return nodes.map((node) => node.text).join("");
}

export function serializeToPlainText(doc: BlockDocument): string {
    return doc.blocks
        .map((block) => {
            switch (block.type) {
                case "paragraph":
                case "heading":
                case "quote":
                    return serializeInlineNodesPlainText(block.children);
                case "image":
                    return `[Image${block.alt ? `: ${block.alt}` : ""}]`;
                case "code":
                    return block.code;
                case "list":
                    return block.items
                        .map((item) => serializeInlineNodesPlainText(item))
                        .join("\n");
                case "table":
                    return block.rows
                        .map((row) =>
                            row
                                .map((cell) => serializeInlineNodesPlainText(cell))
                                .join(" ")
                        )
                        .join("\n");
                case "embed":
                    return `[Embed: ${block.url}]`;
                case "component":
                    return `[Component: ${block.componentName}]`;
                case "divider":
                    return "";
                default:
                    return "";
            }
        })
        .filter((text) => text.length > 0)
        .join("\n\n");
}
