import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Box, Typography } from '@mui/material';

import { MenuBar } from './MenuBar';
import { SlashMenu } from './SlashMenu';
import { blockDocumentToTiptap, tiptapToBlockDocument } from './adapter';
import './BlockEditor.css';

interface BlockEditorProps {
  value: unknown; // Can be string (legacy) or BlockDocument JSON
  onChange: (value: unknown) => void;
  label?: string;
}

export function BlockEditor({ value, onChange, label }: BlockEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: typeof value === 'string' ? value : blockDocumentToTiptap(value),
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const blockDoc = tiptapToBlockDocument(json);
      onChange(blockDoc);
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  if (!editor || !isMounted) {
    return null;
  }

  return (
    <Box className="BlockEditor-container" sx={{ mt: 1, mb: 1 }}>
      {label && (
        <Typography variant="body2" sx={{ p: 1, color: 'text.secondary', borderBottom: '1px solid rgba(255, 255, 255, 0.23)' }}>
          {label}
        </Typography>
      )}
      <MenuBar editor={editor} />
      <SlashMenu editor={editor} />
      <Box className="BlockEditor-content">
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
