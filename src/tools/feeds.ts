import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TtrssClient } from "../ttrss-client.js";

export function registerFeedTools(server: McpServer, client: TtrssClient) {
  server.tool(
    "get_categories",
    "[Operates only on the user's tt-rss RSS feeds] Get the list of categories. Use when the user explicitly wants to view RSS subscription categories or check the distribution of unread articles.",
    {
      unread_only: z
        .boolean()
        .default(false)
        .describe("Only return categories that have unread articles"),
      enable_nested: z
        .boolean()
        .default(false)
        .describe("Nested mode; only return top-level categories"),
      include_empty: z
        .boolean()
        .default(true)
        .describe("Include empty categories"),
    },
    async (params) => {
      try {
        const categories = await client.getCategories(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(categories, null, 2) }],
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to get categories: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_feeds",
    "[Operates only on the user's tt-rss RSS feeds] Get the list of feeds. Use when the user explicitly wants to view the RSS feed list. Special category IDs: -1=special, -2=labels, -3=all (excluding virtual), -4=all (including virtual), 0=uncategorized",
    {
      cat_id: z
        .number()
        .optional()
        .describe("Category ID; if omitted, returns all"),
      unread_only: z
        .boolean()
        .default(false)
        .describe("Only return feeds that have unread articles"),
      limit: z.number().optional().describe("Maximum number of results"),
      offset: z.number().optional().describe("Skip the first N results"),
      include_nested: z
        .boolean()
        .default(false)
        .describe("Include feeds from subcategories"),
    },
    async (params) => {
      try {
        const feeds = await client.getFeeds(params);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(feeds, null, 2) }],
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to get feeds: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "subscribe_feed",
    "[Operates only on the user's tt-rss RSS feeds] Subscribe to a new RSS feed. Use when the user explicitly wants to add a new RSS subscription.",
    {
      feed_url: z.string().url().describe("URL of the RSS feed"),
      category_id: z
        .number()
        .default(0)
        .describe("Category ID to place it in, default 0 (uncategorized)"),
      login: z.string().optional().describe("Username, if the feed requires authentication"),
      password: z.string().optional().describe("Password, if the feed requires authentication"),
    },
    async (params) => {
      try {
        const result = await client.subscribeToFeed(params);
        const code = result.status.code;
        const messages: Record<number, string> = {
          0: "Subscribed successfully",
          1: "Already subscribed to this feed",
          2: "Invalid URL",
          3: "No RSS feed found at the URL",
          4: "Multiple RSS feeds found at the URL (please specify the exact feed address)",
          5: "Unable to download the URL",
          6: "Duplicate content",
        };
        const msg = messages[code] ?? `Unknown status code: ${code}`;
        if (code !== 0 && code !== 1) {
          return {
            content: [{ type: "text" as const, text: msg }],
            isError: true,
          };
        }
        return { content: [{ type: "text" as const, text: msg }] };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to subscribe: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "unsubscribe_feed",
    "[Operates only on the user's tt-rss RSS feeds] Unsubscribe from a specific RSS feed. Use when the user explicitly wants to cancel an RSS subscription.",
    {
      feed_id: z.number().describe("ID of the feed to unsubscribe from"),
    },
    async ({ feed_id }) => {
      try {
        await client.unsubscribeFeed(feed_id);
        return { content: [{ type: "text" as const, text: "Unsubscribed successfully" }] };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to unsubscribe: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
