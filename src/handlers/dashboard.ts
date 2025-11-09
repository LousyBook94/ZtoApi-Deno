/**
 * Dashboard and Docs handlers
 * Handles index, dashboard, docs, and static asset requests
 */

import { SUPPORTED_MODELS } from "../config/models.ts";
import type { ModelsResponse } from "../types/definitions.ts";
import { setCORSHeaders } from "../utils/helpers.ts";
import { getLiveRequestsData, getStatsData } from "../utils/stats.ts";

/**
 * Read index.html file
 */
export async function getIndexHTML(): Promise<string> {
  try {
    return await Deno.readTextFile(`${Deno.cwd()}/ui/index.html`);
  } catch (error) {
    console.error("Failed to read index.html:", error);
    return "<h1>UI files not found. Please ensure ui folder exists.</h1>";
  }
}

/**
 * Handle index request
 */
export async function handleIndex(_request: Request): Promise<Response> {
  const html = await getIndexHTML();

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptions(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  return new Response("Not Found", { status: 404, headers });
}

/**
 * Handle models list request
 */
export function handleModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = SUPPORTED_MODELS.map((model) => ({
    id: model.name,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "z.ai",
  }));

  const response: ModelsResponse = {
    object: "list",
    data: models,
  };

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
}

/**
 * Read dashboard HTML
 */
export async function getDashboardHTML(): Promise<string> {
  try {
    const html = await Deno.readTextFile(`${Deno.cwd()}/ui/dashboard.html`);
    return html;
  } catch (error) {
    console.error("Failed to read dashboard.html:", error);
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - ZtoApi</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>ZtoApi Dashboard</h1>
        <p class="error">Dashboard UI not found. Please ensure ui/dashboard.html exists.</p>
        <h2>API Information</h2>
        <p>Server is running. Check the API endpoints:</p>
        <ul>
          <li><a href="/v1/models">GET /v1/models</a> - List available models</li>
          <li><a href="/api/stats">GET /api/stats</a> - View statistics</li>
        </ul>
      </body>
      </html>
    `;
  }
}

/**
 * Handle dashboard request
 */
export async function handleDashboard(request: Request): Promise<Response> {
  const html = await getDashboardHTML();

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Handle dashboard stats
 */
export function handleDashboardStats(_request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  const stats = getStatsData();

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(stats), {
    status: 200,
    headers,
  });
}

/**
 * Handle dashboard live requests
 */
export function handleDashboardRequests(_request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  const requests = getLiveRequestsData();

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(requests), {
    status: 200,
    headers,
  });
}

/**
 * Read docs HTML
 */
export async function getDocsHTML(): Promise<string> {
  try {
    return await Deno.readTextFile(`${Deno.cwd()}/ui/docs.html`);
  } catch (error) {
    console.error("Failed to read docs.html:", error);
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documentation - ZtoApi</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>ZtoApi Documentation</h1>
        <p>API documentation is available at: <a href="https://platform.openai.com/docs/api-reference">OpenAI API Reference</a></p>
        <h2>Quick Start</h2>
        <pre><code>curl -X POST http://localhost:3000/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "glm-4.5",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'</code></pre>
        <h2>Available Models</h2>
        <pre><code>curl http://localhost:3000/v1/models</code></pre>
      </body>
      </html>
    `;
  }
}

/**
 * Handle docs request
 */
export async function handleDocs(request: Request): Promise<Response> {
  const html = await getDocsHTML();

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

/**
 * Handle static files
 */
export async function handleStatic(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Simple static file handler for UI assets
  const filePath = `${Deno.cwd()}/ui${path}`;

  try {
    const content = await Deno.readTextFile(filePath);
    const contentType = getContentType(path);

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return new Response("Not Found", {
      status: 404,
    });
  }
}

/**
 * Get content type based on file extension
 */
export function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  return "text/plain";
}
