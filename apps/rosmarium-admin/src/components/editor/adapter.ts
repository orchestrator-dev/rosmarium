import type { JSONContent } from '@tiptap/react';

// Adapter to map Tiptap (ProseMirror) JSON to our backend BlockDocument JSON

export function tiptapToBlockDocument(tiptapJson: JSONContent): Record<string, unknown> {
    if (!tiptapJson || tiptapJson.type !== 'doc') {
        return { version: 1, blocks: [] };
    }

    const blocks = (tiptapJson.content || []).map((node: JSONContent) => {
        // Map common properties
        const block: Record<string, unknown> = {
            id: crypto.randomUUID(), // CRDT or unique addressing
        };

        if (node.type === 'paragraph') {
            block.type = 'paragraph';
            block.children = mapInlineNodes(node.content);
        } else if (node.type === 'heading') {
            block.type = 'heading';
            block.level = node.attrs?.level || 1;
            block.children = mapInlineNodes(node.content);
        } else if (node.type === 'blockquote') {
            block.type = 'quote';
            block.children = mapInlineNodes(node.content);
        } else if (node.type === 'codeBlock') {
            block.type = 'code';
            block.language = node.attrs?.language || '';
            block.code = node.content?.[0]?.text || '';
        } else if (node.type === 'bulletList' || node.type === 'orderedList') {
            block.type = 'list';
            block.style = node.type === 'orderedList' ? 'ordered' : 'unordered';
            block.items = (node.content || []).map((listItem: JSONContent) => {
                // Tiptap list items contain paragraphs usually
                const p = listItem.content?.[0];
                return p ? mapInlineNodes(p.content) : [];
            });
        } else if (node.type === 'image') {
            block.type = 'image';
            block.url = node.attrs?.src || '';
            block.alt = node.attrs?.alt || '';
            block.caption = node.attrs?.title || '';
        } else if (node.type === 'table') {
            block.type = 'table';
            block.rows = (node.content || []).map((row: JSONContent) => {
                return (row.content || []).map((cell: JSONContent) => {
                    const p = cell.content?.[0];
                    return p ? mapInlineNodes(p.content) : [];
                });
            });
        } else if (node.type === 'horizontalRule') {
            block.type = 'divider';
        } else {
            // fallback for unknown blocks
            block.type = 'paragraph';
            block.children = mapInlineNodes(node.content);
        }
        return block;
    });

    return {
        version: 1,
        blocks,
    };
}

function mapInlineNodes(content?: JSONContent[]): Record<string, unknown>[] {
    if (!content) return [];
    return content.map((node) => {
        const inline: Record<string, unknown> = {
            type: 'text',
            text: node.text || '',
        };
        if (node.marks && node.marks.length > 0) {
            inline.marks = node.marks.map((m) => {
                if (m.type === 'bold' || m.type === 'italic' || m.type === 'underline' || m.type === 'strike') {
                    return m.type === 'strike' ? 'strikethrough' : m.type;
                }
                if (m.type === 'code') return 'code';
                return undefined;
            }).filter(Boolean);
            
            // link mark is special, convert to link node type
            const linkMark = node.marks.find((m) => m.type === 'link');
            if (linkMark) {
                inline.type = 'link';
                // the url isn't strictly in inline node schema currently (just text)
                // but we would map it if schema updates
            }
        }
        return inline;
    });
}

export function blockDocumentToTiptap(doc: unknown): JSONContent {
    const docObj = doc as Record<string, unknown>;
    if (!docObj || !docObj.blocks || !Array.isArray(docObj.blocks)) {
        return { type: 'doc', content: [] };
    }

    const content = docObj.blocks.map((blockAny: unknown) => {
        const block = blockAny as Record<string, unknown>;
        const node: JSONContent = {};

        if (block.type === 'paragraph') {
            node.type = 'paragraph';
            node.content = unmapInlineNodes(block.children as unknown[]);
        } else if (block.type === 'heading') {
            node.type = 'heading';
            node.attrs = { level: block.level || 1 };
            node.content = unmapInlineNodes(block.children as unknown[]);
        } else if (block.type === 'quote') {
            node.type = 'blockquote';
            node.content = unmapInlineNodes(block.children as unknown[]);
        } else if (block.type === 'code') {
            node.type = 'codeBlock';
            node.attrs = { language: block.language };
            node.content = [{ type: 'text', text: (block.code as string) || '' }];
        } else if (block.type === 'list') {
            node.type = block.style === 'ordered' ? 'orderedList' : 'bulletList';
            node.content = (block.items as unknown[][]).map((item: unknown[]) => ({
                type: 'listItem',
                content: [{ type: 'paragraph', content: unmapInlineNodes(item) }],
            }));
        } else if (block.type === 'image') {
            node.type = 'image';
            node.attrs = { src: block.url, alt: block.alt, title: block.caption };
        } else if (block.type === 'table') {
            node.type = 'table';
            node.content = (block.rows as unknown[][][]).map((row: unknown[][]) => ({
                type: 'tableRow',
                content: row.map((cell: unknown[]) => ({
                    type: 'tableCell',
                    content: [{ type: 'paragraph', content: unmapInlineNodes(cell) }]
                }))
            }));
        } else if (block.type === 'divider') {
            node.type = 'horizontalRule';
        } else {
            node.type = 'paragraph';
            node.content = unmapInlineNodes(block.children as unknown[]);
        }

        return node;
    });

    return { type: 'doc', content };
}

function unmapInlineNodes(children?: unknown[]): JSONContent[] {
    if (!children) return [];
    return children.map((inlineAny) => {
        const inline = inlineAny as Record<string, unknown>;
        const node: JSONContent = {
            type: 'text',
            text: (inline.text as string) || '',
        };
        
        const marks: { type: string, attrs?: Record<string, unknown> }[] = [];
        if (inline.marks) {
            (inline.marks as string[]).forEach((m: string) => {
                if (m === 'bold' || m === 'italic' || m === 'underline' || m === 'code') {
                    marks.push({ type: m });
                } else if (m === 'strikethrough') {
                    marks.push({ type: 'strike' });
                }
            });
        }
        
        if (inline.type === 'link') {
            marks.push({ type: 'link', attrs: { href: '#' } });
        }
        
        if (marks.length > 0) {
            node.marks = marks;
        }

        return node;
    });
}
