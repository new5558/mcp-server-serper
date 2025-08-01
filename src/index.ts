#!/usr/bin/env node

/**
 * MCP server implementation that provides web search capabilities via Serper API.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SerperClient } from "./services/serper-client.js";
import { SerperSearchTools } from "./tools/search-tool.js";
import { SerperPrompts } from "./prompts/index.js";

// Initialize Serper client with API key from environment
const serperApiKey = process.env.SERPER_API_KEY;
if (!serperApiKey) {
  throw new Error("SERPER_API_KEY environment variable is required");
}

// Create Serper client, search tool, and prompts
const serperClient = new SerperClient(serperApiKey);
const searchTools = new SerperSearchTools(serperClient);
const prompts = new SerperPrompts(searchTools);

// Create MCP server
const server = new Server(
  {
    name: "Serper MCP Server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    },
  }
);

/**
 * Handler that lists available tools.
 * Exposes a single "webSearch" tool for performing web searches.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Define input schema for search tool
  const searchInputSchema = {
    type: "object",
    properties: {
      q: {
        type: "string",
        description: "Search query string (e.g., 'artificial intelligence', 'climate change solutions')"
      },
      gl: {
        type: "string",
        description: "Optional region code for search results in ISO 3166-1 alpha-2 format (e.g., 'us', 'gb', 'de')"
      },
      hl: {
        type: "string",
        description: "Optional language code for search results in ISO 639-1 format (e.g., 'en', 'es', 'fr')"
      },
      location: {
        type: "string",
        description: "Optional location for search results (e.g., 'SoHo, New York, United States', 'California, United States')"
      },
      num: {
        type: "number",
        description: "Number of results to return (default: 10)"
      },
      tbs: {
        type: "string",
        description: "Time-based search filter ('qdr:h' for past hour, 'qdr:d' for past day, 'qdr:w' for past week, 'qdr:m' for past month, 'qdr:y' for past year)"
      },
      page: {
        type: "number",
        description: "Page number of results to return (default: 1)"
      },
      autocorrect: {
        type: "boolean",
        description: "Whether to autocorrect spelling in query"
      },
      // Advanced search operators
      site: {
        type: "string",
        description: "Limit results to specific domain (e.g., 'github.com', 'wikipedia.org')"
      },
      filetype: {
        type: "string",
        description: "Limit to specific file types (e.g., 'pdf', 'doc', 'xls')"
      },
      inurl: {
        type: "string",
        description: "Search for pages with word in URL (e.g., 'download', 'tutorial')"
      },
      intitle: {
        type: "string",
        description: "Search for pages with word in title (e.g., 'review', 'how to')"
      },
      related: {
        type: "string",
        description: "Find similar websites (e.g., 'github.com', 'stackoverflow.com')"
      },
      cache: {
        type: "string",
        description: "View Google's cached version of a specific URL (e.g., 'example.com/page')"
      },
      before: {
        type: "string",
        description: "Date before in YYYY-MM-DD format (e.g., '2024-01-01')"
      },
      after: {
        type: "string",
        description: "Date after in YYYY-MM-DD format (e.g., '2023-01-01')"
      },
      exact: {
        type: "string",
        description: "Exact phrase match (e.g., 'machine learning', 'quantum computing')"
      },
      exclude: {
        type: "string",
        description: "Terms to exclude from search results as comma-separated string (e.g., 'spam,ads', 'beginner,basic')"
      },
      or: {
        type: "string",
        description: "Alternative terms as comma-separated string (e.g., 'tutorial,guide,course', 'documentation,manual')"
      }
    },
    required: ["q", "gl", "hl"],
  };

  // Return list of tools with input schemas
  return {
    tools: [
      {
        name: "google_search",
        description:
          "Tool to perform web searches via Serper API and retrieve rich results. It is able to retrieve organic search results, people also ask, related searches, and knowledge graph.",
        inputSchema: searchInputSchema,
      },
      {
        name: "scrape",
        description:
          "Tool to scrape a webpage and retrieve the text and, optionally, the markdown content. It will retrieve also the JSON-LD metadata and the head metadata.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL of the webpage to scrape.",
            },
            includeMarkdown: {
              type: "boolean",
              description: "Whether to include markdown content.",
              default: false,
            },
          },
          required: ["url"],
        },
      },
    ],
  };
});

/**
 * Handler for the webSearch tool.
 * Performs a web search using Serper API and returns results.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "google_search": {
      const {
        q,
        gl,
        hl,
        location,
        num,
        tbs,
        page,
        autocorrect,
        // Advanced search parameters
        site,
        filetype,
        inurl,
        intitle,
        related,
        cache,
        before,
        after,
        exact,
        exclude,
        or
      } = request.params.arguments || {};

      if (!q || !gl || !hl) {
        throw new Error(
          "Search query and region code and language are required"
        );
      }

      try {
        const result = await searchTools.search({
          q: String(q),
          gl: String(gl),
          hl: String(hl),
          location: location as string | undefined,
          num: num as number | undefined,
          tbs: tbs as "qdr:h" | "qdr:d" | "qdr:w" | "qdr:m" | "qdr:y" | undefined,
          page: page as number | undefined,
          autocorrect: autocorrect as boolean | undefined,
          // Advanced search parameters
          site: site as string | undefined,
          filetype: filetype as string | undefined,
          inurl: inurl as string | undefined,
          intitle: intitle as string | undefined,
          related: related as string | undefined,
          cache: cache as string | undefined,
          before: before as string | undefined,
          after: after as string | undefined,
          exact: exact as string | undefined,
          exclude: exclude as string | undefined,
          or: or as string | undefined
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Search failed: ${error}`);
      }
    }

    case "scrape": {
      const url = request.params.arguments?.url as string;
      const includeMarkdown = request.params.arguments
        ?.includeMarkdown as boolean;
      const result = await searchTools.scrape({ url, includeMarkdown });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error("Unknown tool");
  }
});

// Handle prompts/list requests
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return prompts.listPrompts();
});

// Handle prompts/get requests
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return prompts.getPrompt(request.params.name, request.params.arguments || {});
});

/**
 * Start the server using Streamable HTTP transport.
 */
async function main() {
  const app = express();
  app.use(express.json());

  // Stateless endpoint – each request gets its own transport
  app.all("/mcp", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    // Log outgoing messages from server to client
    transport.onmessage = (message) => {
      console.log("[MCP → Client]", JSON.stringify(message));
    };
    transport.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    // Log incoming request body (client → server)
    if (req.method === "POST") {
      console.log("[Client → MCP]", JSON.stringify(req.body));
    }

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    console.log(`Serper MCP Server listening on port ${port}`);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
