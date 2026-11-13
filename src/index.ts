#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TtrssClient } from "./ttrss-client.js";
import { registerFeedTools } from "./tools/feeds.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerReportTools } from "./tools/report.js";

const TT_RSS_URL = process.env.TT_RSS_URL;
const TT_RSS_SID = process.env.TT_RSS_SID;

if (!TT_RSS_URL || !TT_RSS_SID) {
  console.error(
    "Missing required environment variables. Please set TT_RSS_URL and TT_RSS_SID.\n" +
      "  TT_RSS_URL: tt-rss instance address (e.g. https://rss.example.com/tt-rss)\n" +
      "  TT_RSS_SID: tt-rss session ID",
  );
  process.exit(1);
}

const client = new TtrssClient(TT_RSS_URL, TT_RSS_SID);

const server = new McpServer({
  name: "ttrss-mcp",
  version: "1.0.0",
});

// -- System tool --
server.tool(
  "get_config",
  "[Operates only on the user's tt-rss RSS feeds] Get tt-rss server configuration (daemon status, number of feeds, etc.). Use when the user wants to check the tt-rss server status.",
  {},
  async () => {
    try {
      const config = await client.getConfig();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }],
      };
    } catch (e: unknown) {
      return {
        content: [{ type: "text" as const, text: `Failed to get config: ${(e as Error).message}` }],
        isError: true,
      };
    }
  },
);

registerFeedTools(server, client);
registerArticleTools(server, client);
registerLabelTools(server, client);
registerReportTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
