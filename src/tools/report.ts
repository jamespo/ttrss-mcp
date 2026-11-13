import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TtrssClient } from "../ttrss-client.js";
import type { TtrssHeadline } from "../types.js";

export function registerReportTools(server: McpServer, client: TtrssClient) {
  server.tool(
    "generate_daily_report",
    "[Operates only on the user's tt-rss RSS feeds] Generate a daily report: summarize the user's recent tt-rss articles, grouped by category and feed. Use when the user explicitly asks for an RSS reading digest. By default it fetches unread articles; a time range can be specified.",
    {
      hours: z.number().default(24).describe("Fetch articles from the last N hours, default 24"),
      limit: z.number().default(200).describe("Maximum number of articles to fetch"),
      view_mode: z
        .enum(["all_articles", "unread", "adaptive", "marked", "updated"])
        .default("all_articles")
        .describe("Filter mode"),
      include_content: z.boolean().default(false).describe("Whether to include article excerpts"),
    },
    async (params) => {
      try {
        const cutoffTime = Math.floor(Date.now() / 1000) - params.hours * 3600;

        const headlines = await client.getHeadlines({
          feed_id: -4,
          limit: params.limit,
          view_mode: params.view_mode,
          show_excerpt: params.include_content,
          order_by: "feed_dates",
        });

        const filtered = headlines.filter((h) => h.updated >= cutoffTime);

        if (filtered.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `No ${params.view_mode === "unread" ? "unread " : ""}articles in the last ${params.hours} hours.`,
            }],
          };
        }

        const grouped = groupByFeed(filtered);
        const report = formatReport(grouped, params.hours, params.include_content);
        return { content: [{ type: "text" as const, text: report }] };
      } catch (e: unknown) {
        return {
          content: [{ type: "text" as const, text: `Failed to generate daily report: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}

interface GroupedArticles {
  [feedTitle: string]: TtrssHeadline[];
}

function groupByFeed(headlines: TtrssHeadline[]): GroupedArticles {
  const groups: GroupedArticles = {};
  for (const h of headlines) {
    const key = h.feed_title || "Unknown source";
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  }
  return groups;
}

function formatReport(
  grouped: GroupedArticles,
  hours: number,
  includeContent: boolean,
): string {
  const totalArticles = Object.values(grouped).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const feedCount = Object.keys(grouped).length;

  const lines: string[] = [
    `# Daily Report (last ${hours} hours)`,
    "",
    `${totalArticles} article(s) from ${feedCount} feed(s).`,
    "",
  ];

  const sortedFeeds = Object.entries(grouped).sort(
    ([, a], [, b]) => b.length - a.length,
  );

  for (const [feedTitle, articles] of sortedFeeds) {
    lines.push(`## ${feedTitle} (${articles.length})`);
    lines.push("");

    const sorted = articles.sort((a, b) => b.updated - a.updated);

    for (const article of sorted) {
      const time = new Date(article.updated * 1000).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const flags = [
        article.unread ? "unread" : "",
        article.marked ? "⭐" : "",
      ]
        .filter(Boolean)
        .join(" ");

      lines.push(
        `- [${article.title}](${article.link}) | ${time}${flags ? " | " + flags : ""}`,
      );

      if (includeContent && article.excerpt) {
        lines.push(`  > ${article.excerpt.slice(0, 150).replace(/\n/g, " ")}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
