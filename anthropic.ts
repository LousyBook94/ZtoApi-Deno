import { encode } from "npm:gpt-tokenizer";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

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

function setCORSHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-anthropic-version");
  headers.set("Access-Control-Allow-Credentials", "true");
}

export async function handleAnthropicCompletions(request: Request): Promise<Response> {
  const corsHeaders = new Headers();
  setCORSHeaders(corsHeaders);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const reqBody: AnthropicRequest = await request.json();

    const inputText = reqBody.messages
      .map(m =>
        typeof m.content === 'string'
          ? m.content
          : m.content.filter(c => c.type === 'text').map(c => c.text || '').join(' ')
      )
      .join('\n');
    const inputTokens = encode(inputText).length;
    console.log(`Anthropic request model: ${reqBody.model}, input tokens: ${inputTokens}`);

    const anthropicHeaders = new Headers();
    anthropicHeaders.set("Content-Type", "application/json");
    anthropicHeaders.set("x-anthropic-version", "2023-06-01");

    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      anthropicHeaders.set("x-api-key", authHeader.replace("Bearer ", ""));
    }

    const response = await fetch(ANTHROPIC_API_URL, {
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
    console.error("Error handling Anthropic request:", error);
    corsHeaders.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: { message: error.message, type: 'internal_server_error' } }), { status: 500, headers: corsHeaders });
  }
}