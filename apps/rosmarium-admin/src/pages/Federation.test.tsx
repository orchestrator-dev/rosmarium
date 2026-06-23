import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Federation from './Federation';

// Mock fetch API
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([
        { id: "1", name: "Shopify", type: "graphql", endpoint: "https://shopify.com/api", status: "active" }
    ]),
  })
) as any;

describe('Federation Component', () => {
    it('renders the content federation title', async () => {
        render(<Federation />);
        expect(await screen.findByText('Content Federation')).toBeDefined();
    });

    it('renders the remote sources table with data', async () => {
        render(<Federation />);
        const sourceName = await screen.findByText('Shopify');
        expect(sourceName).toBeDefined();
        
        const endpoint = await screen.findByText('https://shopify.com/api');
        expect(endpoint).toBeDefined();
    });

    it('renders the add source button', async () => {
        render(<Federation />);
        expect(await screen.findByText('Add Remote Source')).toBeDefined();
    });
});
