import { encode } from "npm:gpt-tokenizer";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1";

/**
 * Anthropic-compatible request structure
 */
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  stream?: boolean;
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

interface AnthropicMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface AnthropicTextCompletionsRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  max_tokens_to_sample: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
}

function setCORSHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-anthropic-version");
  headers.set("Access-Control-Allow-Credentials", "true");
}

export async function handleAnthropicMessages(request: Request): Promise<Response> {
  const corsHeaders = new Headers();
  setCORSHeaders(corsHeaders);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const reqBody: AnthropicRequest = await request.json();
    reqBody.model = reqBody.model.toLowerCase();

    const inputText = reqBody.messages
      .map(m =>
        typeof m.content === 'string'
          ? m.content
          : m.content.filter(c => c.type === 'text').map(c => c.text || '').join(' ')
      )
      .join('\n');
    const inputTokens = encode(inputText).length;
    console.log(`Anthropic messages request model: ${reqBody.model}, input tokens: ${inputTokens}`);

    const anthropicHeaders = new Headers();
    anthropicHeaders.set("Content-Type", "application/json");
    anthropicHeaders.set("x-anthropic-version", "2023-06-01");

    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      anthropicHeaders.set("x-api-key", authHeader.replace("Bearer ", ""));
    }

    const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
      method: "POST",
      headers: anthropicHeaders,
      body: JSON.stringify(reqBody),
    });

    const responseHeaders = new Headers(response.headers);
    setCORSHeaders(responseHeaders);

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Error handling Anthropic messages request:", error);
    corsHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: { message: error.message, type: 'internal_server_error' } }), { status: 500, headers: corsHeaders });
  }
}

export async function handleAnthropicTextCompletions(request: Request): Promise<Response> {
    const corsHeaders = new Headers();
    setCORSHeaders(corsHeaders);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const reqBody: AnthropicTextCompletionsRequest = await request.json();
        reqBody.model = reqBody.model.toLowerCase();

        const inputTokens = encode(reqBody.prompt).length;
        console.log(`Anthropic text completions request model: ${reqBody.model}, input tokens: ${inputTokens}`);

        const anthropicHeaders = new Headers();
        anthropicHeaders.set("Content-Type", "application/json");
        anthropicHeaders.set("x-anthropic-version", "2023-06-01");

        const authHeader = request.headers.get("Authorization");
        if (authHeader) {
            anthropicHeaders.set("x-api-key", authHeader.replace("Bearer ", ""));
        }

        const response = await fetch(`${ANTHROPIC_API_URL}/text_completions`, {
            method: "POST",
            headers: anthropicHeaders,
            body: JSON.stringify(reqBody),
        });

        const responseHeaders = new Headers(response.headers);
        setCORSHeaders(responseHeaders);

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error("Error handling Anthropic text completions request:", error);
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: { message: error.message, type: 'internal_server_error' } }), { status: 500, headers: corsHeaders });
    }
}

export async function handleAnthropicModels(request: Request): Promise<Response> {
    const corsHeaders = new Headers();
    setCORSHeaders(corsHeaders);

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const anthropicHeaders = new Headers();
        anthropicHeaders.set("x-anthropic-version", "2023-06-01");

        const authHeader = request.headers.get("Authorization");
        if (authHeader) {
            anthropicHeaders.set("x-api-key", authHeader.replace("Bearer ", ""));
        }

        const response = await fetch(`${ANTHROPIC_API_URL}/models`, {
            method: "GET",
            headers: anthropicHeaders,
        });

        const responseHeaders = new Headers(response.headers);
        setCORSHeaders(responseHeaders);

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error("Error handling Anthropic models request:", error);
        corsHeaders.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: { message: error.message, type: 'internal_server_error' } }), { status: 500, headers: corsHeaders });
    }
}