import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TtrssClient } from "../ttrss-client.js";

export function registerLabelTools(server: McpServer, client: TtrssClient) {
  server.tool(
    "get_labels",
    "[Operates only on the user's tt-rss RSS feeds] Get the list of all configured labels. Use when the user explicitly wants to view tt-rss article labels. Pass article_id to check whether that article has a given label.",
    {
      article_id: z
        .number()
        .optional()
        .describe("When an article ID is given, the 'checked' field in the result indicates whether that article has the label"),
    },
    async ({ article_id }) => {
      try {
        const labels = await client.getLabels(article_id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(labels, null, 2) }],
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to get labels: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "set_article_label",
    "[Operates only on the user's tt-rss RSS feeds] Assign or remove a label on articles. Use when the user explicitly wants to add or remove a label on tt-rss articles.",
    {
      article_ids: z.string().describe("Comma-separated list of article IDs (e.g. '123,456')"),
      label_id: z.number().describe("Label ID (obtained from get_labels)"),
      assign: z.boolean().describe("true=add label, false=remove label"),
    },
    async (params) => {
      try {
        const result = await client.setArticleLabel(params);
        const action = params.assign ? "Added" : "Removed";
        return {
          content: [{ type: "text" as const, text: `${action} label successfully, updated ${result.updated} article(s)` }],
        };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to set label: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
