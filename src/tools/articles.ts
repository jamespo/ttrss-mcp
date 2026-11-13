import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TtrssClient } from "../ttrss-client.js";

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function fail(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

export function registerArticleTools(server: McpServer, client: TtrssClient) {
  server.tool(
    "get_headlines",
    "[Operates only on the user's tt-rss RSS feeds] Get a list of article headlines. Use when the user explicitly wants to view the article list of a tt-rss feed. Special feed_id values: -4=all, -3=fresh, -2=published, -1=starred, 0=archived. Can filter by view_mode (unread/starred/etc.).",
    {
      feed_id: z
        .number()
        .default(-4)
        .describe("Feed ID. -4=all, -3=fresh, -2=published, -1=starred, 0=archived, positive=specific feed"),
      limit: z.number().default(20).describe("Maximum number of results (max 200)"),
      skip: z.number().default(0).describe("Skip the first N articles"),
      view_mode: z
        .enum(["all_articles", "unread", "adaptive", "marked", "updated"])
        .default("unread")
        .describe("Filter mode"),
      is_cat: z.boolean().default(false).describe("Whether feed_id is a category ID"),
      show_excerpt: z.boolean().default(true).describe("Return article excerpt"),
      show_content: z.boolean().default(false).describe("Return full article content (large)"),
      include_attachments: z.boolean().default(false).describe("Include attachment info"),
      order_by: z
        .enum(["", "feed_dates", "date_reverse"])
        .default("")
        .describe("Sort order: empty=default, feed_dates=newest first, date_reverse=oldest first"),
      since_id: z.number().optional().describe("Only return articles with ID greater than this value"),
    },
    async (params) => {
      try {
        const headlines = await client.getHeadlines(params);
        const simplified = headlines.map((h) => ({
          id: h.id,
          title: h.title,
          feed_title: h.feed_title,
          link: h.link,
          unread: h.unread,
          marked: h.marked,
          updated: new Date(h.updated * 1000).toISOString(),
          author: h.author,
          excerpt: h.excerpt,
          ...(params.show_content ? { content: h.content } : {}),
          labels: h.labels,
          note: h.note,
        }));
        return ok(JSON.stringify(simplified, null, 2));
      } catch (e: unknown) {
        return fail(`Failed to get headlines: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "get_article",
    "[Operates only on the user's tt-rss RSS feeds] Get the full content (including body) of one or more articles. Use when the user explicitly wants to read the details of a tt-rss article. Supports multiple comma-separated IDs.",
    {
      article_id: z.string().describe("Article ID; supports multiple comma-separated IDs (e.g. '123,456')"),
    },
    async ({ article_id }) => {
      try {
        const articles = await client.getArticle(article_id);
        const simplified = articles.map((a) => ({
          id: a.id,
          title: a.title,
          link: a.link,
          author: a.author,
          updated: new Date(a.updated * 1000).toISOString(),
          content: a.content,
          feed_title: a.feed_title,
          feed_id: a.feed_id,
          unread: a.unread,
          marked: a.marked,
          published: a.published,
          labels: a.labels,
          note: a.note,
          attachments: a.attachments,
        }));
        return ok(JSON.stringify(simplified, null, 2));
      } catch (e: unknown) {
        return fail(`Failed to get article content: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "get_unread_count",
    "[Operates only on the user's tt-rss RSS feeds] Get the current total number of unread articles. Use when the user explicitly wants to check the unread article count in tt-rss.",
    {},
    async () => {
      try {
        const count = await client.getUnread();
        return ok(`Unread articles: ${count}`);
      } catch (e: unknown) {
        return fail(`Failed to get unread count: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "update_article",
    "[Operates only on the user's tt-rss RSS feeds] Update article status. field: 0=starred, 1=published, 2=unread, 3=note. mode: 0=clear, 1=set, 2=toggle. Use when the user explicitly wants to change a tt-rss article's status.",
    {
      article_ids: z.string().describe("Comma-separated list of article IDs (e.g. '123,456')"),
      field: z.number().min(0).max(3).describe("Field to operate on: 0=starred, 1=published, 2=unread, 3=note"),
      mode: z.number().min(0).max(2).describe("Operation mode: 0=clear, 1=set, 2=toggle"),
      data: z.string().optional().describe("Note content, used when field=3 (note)"),
    },
    async (params) => {
      try {
        const result = await client.updateArticle(params);
        return ok(`Success: updated ${result.updated} article(s)`);
      } catch (e: unknown) {
        return fail(`Failed to update article: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "catchup_feed",
    "[Operates only on the user's tt-rss RSS feeds] Mark all articles in a feed or category as read. Use when the user explicitly wants to bulk-mark tt-rss articles as read. mode options: all, 1day, 1week, 2week",
    {
      feed_id: z.number().describe("Feed or category ID"),
      is_cat: z.boolean().default(false).describe("Whether feed_id is a category ID"),
      mode: z.enum(["all", "1day", "1week", "2week"]).default("all").describe("Range to mark"),
    },
    async (params) => {
      try {
        await client.catchupFeed(params);
        return ok("Marked as read successfully");
      } catch (e: unknown) {
        return fail(`Failed to mark as read: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "share_to_published",
    "[Operates only on the user's tt-rss RSS feeds] Create an article in the Published feed. Use when the user explicitly wants to share an article to the tt-rss Published feed.",
    {
      title: z.string().describe("Article title"),
      url: z.string().url().describe("Article URL"),
      content: z.string().describe("Article content"),
    },
    async (params) => {
      try {
        await client.shareToPublished(params);
        return ok("Shared to Published successfully");
      } catch (e: unknown) {
        return fail(`Failed to share: ${(e as Error).message}`);
      }
    },
  );

  server.tool(
    "search_articles",
    "[Operates only on the user's tt-rss RSS feeds] Search for keywords in tt-rss feed articles. Use when the user explicitly wants to search their subscribed RSS articles. search_mode: all_feeds=all feeds, this_feed=current feed, this_cat=current category",
    {
      search: z.string().describe("Search keyword"),
      feed_id: z.number().default(-4).describe("Which feed to search in, -4=all"),
      search_mode: z
        .enum(["all_feeds", "this_feed", "this_cat"])
        .default("all_feeds")
        .describe("Search scope"),
      limit: z.number().default(20).describe("Maximum number of results"),
      view_mode: z
        .enum(["all_articles", "unread", "adaptive", "marked", "updated"])
        .default("all_articles")
        .describe("Filter mode"),
    },
    async (params) => {
      try {
        const headlines = await client.getHeadlines({
          feed_id: params.feed_id,
          search: params.search,
          search_mode: params.search_mode,
          limit: params.limit,
          view_mode: params.view_mode,
          show_excerpt: true,
        });
        const simplified = headlines.map((h) => ({
          id: h.id,
          title: h.title,
          feed_title: h.feed_title,
          link: h.link,
          updated: new Date(h.updated * 1000).toISOString(),
          excerpt: h.excerpt,
          author: h.author,
        }));
        return ok(JSON.stringify(simplified, null, 2));
      } catch (e: unknown) {
        return fail(`Search failed: ${(e as Error).message}`);
      }
    },
  );
}
