import React from 'react';
import { Editor } from '@tiptap/react';
// @ts-expect-error: Module resolution is set to node in base tsconfig
import { FloatingMenu as TiptapFloatingMenu } from '@tiptap/react/menus';
import { Paper, MenuList, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import {
  Title,
  Image,
  Code,
  FormatListBulleted,
  FormatQuote,
  TableChart,
} from '@mui/icons-material';

interface SlashMenuProps {
  editor: Editor;
}

export function SlashMenu({ editor }: SlashMenuProps) {
  if (!editor) {
    return null;
  }

  return (
    <TiptapFloatingMenu editor={editor} tippyOptions={{ duration: 100, placement: 'right' }}>
      <Paper elevation={3} sx={{ minWidth: 200, maxHeight: 300, overflow: 'auto' }}>
        <MenuList dense>
          <MenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <ListItemIcon><Title fontSize="small" /></ListItemIcon>
            <ListItemText>Heading 1</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <ListItemIcon><Title fontSize="small" /></ListItemIcon>
            <ListItemText>Heading 2</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <ListItemIcon><FormatListBulleted fontSize="small" /></ListItemIcon>
            <ListItemText>Bullet List</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <ListItemIcon><FormatQuote fontSize="small" /></ListItemIcon>
            <ListItemText>Quote</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <ListItemIcon><Code fontSize="small" /></ListItemIcon>
            <ListItemText>Code Block</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => {
            const url = window.prompt('URL');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}>
            <ListItemIcon><Image fontSize="small" /></ListItemIcon>
            <ListItemText>Image</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
            <ListItemText>Table</ListItemText>
          </MenuItem>
        </MenuList>
      </Paper>
    </TiptapFloatingMenu>
  );
}
