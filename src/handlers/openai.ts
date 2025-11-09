/**
 * OpenAI API handlers
 * Handles OpenAI-compatible chat completions API (/v1/chat/completions)
 */

import type { Message, ModelConfig, OpenAIRequest, OpenAIResponse, Usage as LocalUsage } from "../types/definitions.ts";
import { getModelConfig } from "../config/models.ts";
import { addLiveRequest, recordRequestStats } from "../utils/stats.ts";
import { setCORSHeaders } from "../utils/helpers.ts";
import { processMessages } from "../utils/validation.ts";
import { getAnonymousToken } from "../services/anonymous-token.ts";
import { ImageProcessor } from "../services/image-processor.ts";
import { callUpstreamWithHeaders } from "../services/upstream-caller.ts";
import { collectFullResponse, processUpstreamStream } from "../utils/stream.ts";

/**
 * Debug logging function - will be injected
 */
let debugLog: (format: string, ...args: unknown[]) => void = () => {};

/**
 * Set the debug logger (called from main)
 */
export function setDebugLogger(logger: (format: string, ...args: unknown[]) => void) {
  debugLog = logger;
}

/**
 * Handle OpenAI-compatible chat completions
 */
export async function handleChatCompletions(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received chat completions request");
  debugLog("🌐 User-Agent: %s", userAgent);

  // Read feature control headers
  const thinkingHeader = request.headers.get("X-Feature-Thinking") || request.headers.get("X-Thinking");
  const thinkTagsModeHeader = request.headers.get("X-Think-Tags-Mode");

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // API key validation
  const authHeader = request.headers.get("Authorization");
  const { validateApiKey } = await import("../utils/helpers.ts");
  if (authHeader && !validateApiKey(authHeader)) {
    debugLog("Invalid Authorization header");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(request.method, path, 401, duration, userAgent);
    return new Response("Invalid Authorization header", {
      status: 401,
      headers,
    });
  }

  // Read request body
  let body: string;
  try {
    body = await request.text();
    debugLog("📥 Received body length: %d chars", body.length);
  } catch (error) {
    debugLog("Failed to read request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response("Failed to read request body", {
      status: 400,
      headers,
    });
  }

  // Parse JSON
  let openaiReq: OpenAIRequest;
  try {
    openaiReq = JSON.parse(body);
  } catch (error) {
    debugLog("JSON parse failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response("Invalid JSON", {
      status: 400,
      headers,
    });
  }

  const model = openaiReq.model || "glm-4.5";
  const modelConfig = getModelConfig(model);

  debugLog("Model: %s, Config: %s", model, modelConfig.id);

  // Check if streaming
  const isStreaming = openaiReq.stream !== false;

  // Get authentication token
  let authToken: string;
  try {
    authToken = await getAnonymousToken();
  } catch (error) {
    debugLog("Failed to get anonymous token: %v", error);
    return new Response("Failed to get authentication token", {
      status: 500,
      headers,
    });
  }

  // Process messages
  let processedMessages: Message[];
  try {
    processedMessages = processMessages(openaiReq.messages, modelConfig);
  } catch (error) {
    debugLog("Failed to process messages: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response(
      error instanceof Error ? error.message : "Failed to process messages",
      {
        status: 400,
        headers,
      },
    );
  }

  // Create upstream request
  const upstreamReq = {
    stream: isStreaming,
    model: modelConfig.upstreamId,
    messages: processedMessages,
    params: {
      top_p: modelConfig.defaultParams.top_p,
      temperature: modelConfig.defaultParams.temperature,
      ...(modelConfig.defaultParams.max_tokens && { max_tokens: modelConfig.defaultParams.max_tokens }),
    },
    features: {
      thinking: modelConfig.capabilities.thinking,
      ...(modelConfig.capabilities.vision && { vision: true }),
    },
    chat_id: `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };

  debugLog("Created upstream request");

  // Call upstream
  let response: Response;
  try {
    response = await callUpstreamWithHeaders(upstreamReq as any, (upstreamReq as any).chat_id, authToken);
  } catch (error) {
    debugLog("Upstream request failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 500);
    addLiveRequest(request.method, path, 500, duration, userAgent);
    return new Response("Failed to connect to upstream service", {
      status: 500,
      headers,
    });
  }

  // Record stats
  const duration = Date.now() - startTime;
  recordRequestStats(startTime, path, response.status);
  addLiveRequest(request.method, path, response.status, duration, userAgent, model);

  // Handle streaming or non-streaming
  if (isStreaming) {
    return handleStreamResponse(response, headers, model, startTime);
  } else {
    return handleNonStreamResponse(response, headers, model, startTime);
  }
}

/**
 * Handle streaming response
 */
export async function handleStreamResponse(
  upstreamResponse: Response,
  headers: Headers,
  modelName: string,
  startTime: number,
): Promise<Response> {
  if (!upstreamResponse.body) {
    return new Response("No response body from upstream", {
      status: 500,
      headers,
    });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Set up headers for streaming
  setCORSHeaders(headers);
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");

  // Process the upstream stream
  processUpstreamStream(
    upstreamResponse.body,
    writer,
    encoder,
    modelName,
  ).catch((error) => {
    debugLog("Error processing stream: %v", error);
  });

  return new Response(stream.readable, {
    status: upstreamResponse.status,
    headers,
  });
}

/**
 * Handle non-streaming response
 */
export async function handleNonStreamResponse(
  upstreamResponse: Response,
  headers: Headers,
  modelName: string,
  startTime: number,
): Promise<Response> {
  if (!upstreamResponse.ok) {
    const errorBody = await upstreamResponse.text();
    debugLog("Upstream error: %s", errorBody);
    return new Response("Upstream service returned an error", {
      status: upstreamResponse.status,
      headers,
    });
  }

  if (!upstreamResponse.body) {
    return new Response("No response body from upstream", {
      status: 500,
      headers,
    });
  }

  try {
    const result = await collectFullResponse(upstreamResponse.body);
    const openaiResp: OpenAIResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.content,
            ...(result.reasoning_content && { reasoning_content: result.reasoning_content }),
          },
          finish_reason: "stop",
        },
      ],
      ...(result.usage && { usage: result.usage }),
    };

    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(openaiResp), {
      status: 200,
      headers,
    });
  } catch (error) {
    debugLog("Failed to process response: %v", error);
    return new Response("Failed to process response", {
      status: 500,
      headers,
    });
  }
}
