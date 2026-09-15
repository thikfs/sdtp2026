// One MCP tool that exposes the product to agents. Session 8 replaces the stub with a real capability.
// npm install @modelcontextprotocol/sdk zod tsx
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'our-product', version: '0.1.0' });

server.registerTool(
  'product_statement',
  {
    description: 'Returns the one-sentence product statement and the baseline metric from docs/PRODUCT.md',
    inputSchema: {},
  },
  async () => ({ content: [{ type: 'text', text: readFileSync('docs/PRODUCT.md', 'utf8') }] }),
);

// ponytail: replace this stub in session 8 with one real capability, e.g. search_items({ query })
server.registerTool(
  'search_items',
  { description: 'Search the product data. Stub until session 8.', inputSchema: { query: z.string() } },
  async ({ query }) => ({ content: [{ type: 'text', text: `No data yet for "${query}". Wire this to Supabase.` }] }),
);

await server.connect(new StdioServerTransport());
