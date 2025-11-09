/**
 * Server and routing logic
 * Handles HTTP request routing and server startup
 */

import { SUPPORTED_MODELS, UPSTREAM_URL } from "../config/constants.ts";
import { addLiveRequest, recordRequestStats } from "../utils/stats.ts";
import {
  handleAnthropicMessages,
  handleAnthropicModels,
  handleAnthropicNonStreamResponse,
  handleAnthropicStreamResponse,
  handleAnthropicTokenCount,
} from "../handlers/anthropic.ts";
import { handleChatCompletions, handleNonStreamResponse, handleStreamResponse } from "../handlers/openai.ts";
import {
  handleDashboard,
  handleDashboardRequests,
  handleDashboardStats,
  handleDocs,
  handleIndex,
  handleModels,
  handleOptions,
  handleStatic,
} from "../handlers/dashboard.ts";

/**
 * Environment configuration
 */
const DEBUG_MODE = Deno.env.get("DEBUG_MODE") !== "false"; // default true
const DEFAULT_STREAM = Deno.env.get("DEFAULT_STREAM") !== "false"; // default true
const DASHBOARD_ENABLED = Deno.env.get("DASHBOARD_ENABLED") !== "false"; // default true

/**
 * Debug logging function
 */
function debugLog(format: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log(`[DEBUG] ${format}`, ...args);
  }
}

/**
 * Start the server
 */
export function main(): void {
  console.log(`OpenAI-compatible API server starting`);
  console.log(`Supported models: ${SUPPORTED_MODELS.map((m) => `${m.id} (${m.name})`).join(", ")}`);
  console.log(`Upstream: ${UPSTREAM_URL}`);
  console.log(`Debug mode: ${DEBUG_MODE ? "ENABLED (Verbose Logging)" : "DISABLED (Performance Mode)"}`);
  console.log(`Default streaming: ${DEFAULT_STREAM}`);
  console.log(`Dashboard enabled: ${DASHBOARD_ENABLED}`);

  const port = parseInt(Deno.env.get("PORT") || "9090");
  console.log(`Running on port: ${port}`);

  if (DASHBOARD_ENABLED) {
    console.log(`Dashboard enabled at: http://localhost:${port}/dashboard`);
  }

  Deno.serve({ port, handler: handleRequest });
}

/**
 * Handle HTTP requests (main router)
 */
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const startTime = Date.now();
  const userAgent = request.headers.get("User-Agent") || "";

  try {
    // Routing
    if (url.pathname === "/") {
      const response = await handleIndex(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname.startsWith("/ui/")) {
      const response = await handleStatic(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/v1/models") {
      const response = await handleModels(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/v1/chat/completions") {
      const response = await handleChatCompletions(request);
      // stats recorded inside handleChatCompletions
      return response;
    } else if (url.pathname === "/anthropic/v1/models") {
      const response = handleAnthropicModels(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/anthropic/v1/messages") {
      const response = await handleAnthropicMessages(request);
      // stats recorded inside handleAnthropicMessages
      return response;
    } else if (url.pathname === "/anthropic/v1/messages/count_tokens") {
      const response = await handleAnthropicTokenCount(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/docs") {
      const response = await handleDocs(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard" && DASHBOARD_ENABLED) {
      const response = await handleDashboard(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard/stats" && DASHBOARD_ENABLED) {
      const response = await handleDashboardStats(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard/requests" && DASHBOARD_ENABLED) {
      const response = await handleDashboardRequests(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else {
      const response = await handleOptions(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    }
  } catch (error) {
    debugLog("Error handling request: %v", error);
    recordRequestStats(startTime, url.pathname, 500);
    addLiveRequest(request.method, url.pathname, 500, Date.now() - startTime, userAgent);
    return new Response("Internal Server Error", { status: 500 });
  }
}
