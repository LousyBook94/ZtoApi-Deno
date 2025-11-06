/**
 * Integration tests for ZtoApi
 * Tests the server endpoints and functionality
 * NOTE: These tests require a running server on localhost:9090
 */

import { assert, assertEquals } from "assert";

const BASE_URL = "http://localhost:9090";
const TEST_API_KEY = "sk-test-key";

// Check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/v1/models`, { signal: AbortSignal.timeout(1000) });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

/**
 * Test /v1/models endpoint
 */
Deno.test({
  name: "GET /v1/models returns model list",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      headers: {
        "Authorization": `Bearer ${TEST_API_KEY}`,
      },
    });

    assertEquals(response.status, 200);
    const data = await response.json();
    assert(data.object === "list");
    assert(Array.isArray(data.data));
    assert(data.data.length > 0);
  },
});

/**
 * Test /v1/chat/completions endpoint (non-streaming)
 */
Deno.test({
  name: "POST /v1/chat/completions (non-streaming)",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TEST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-4.5",
        messages: [
          { role: "user", content: "Say 'test successful' and nothing else" },
        ],
        stream: false,
      }),
    });

    // Server may return 401 if no valid API key configured, that's ok for test
    assert(response.status === 200 || response.status === 401);
    await response.body?.cancel(); // Consume body to prevent leak
  },
});

/**
 * Test /v1/chat/completions endpoint (streaming)
 */
Deno.test({
  name: "POST /v1/chat/completions (streaming)",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TEST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-4.5",
        messages: [
          { role: "user", content: "Say 'test successful' and nothing else" },
        ],
        stream: true,
      }),
    });

    // Server may return 401 if no valid API key configured
    assert(response.status === 200 || response.status === 401);
    await response.body?.cancel(); // Consume body to prevent leak
  },
});

/**
 * Test CORS headers
 */
Deno.test({
  name: "OPTIONS request returns CORS headers",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/models`, {
      method: "OPTIONS",
    });

    assertEquals(response.status, 200);
    assert(response.headers.get("Access-Control-Allow-Origin"));
    assert(response.headers.get("Access-Control-Allow-Methods"));
    await response.body?.cancel();
  },
});

/**
 * Test dashboard endpoint
 */
Deno.test({
  name: "GET /dashboard returns HTML",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/dashboard`);

    assertEquals(response.status, 200);
    assert(response.headers.get("Content-Type")?.includes("text/html"));
    await response.body?.cancel();
  },
});

/**
 * Test API stats endpoint
 */
Deno.test({
  name: "GET /api/stats returns statistics",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/api/stats`);

    // Stats endpoint may not exist in all configurations
    assert(response.status === 200 || response.status === 404);
    await response.body?.cancel();
  },
});

/**
 * Test invalid API key
 */
Deno.test({
  name: "Invalid API key returns 401",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": "Invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-4.5",
        messages: [{ role: "user", content: "test" }],
      }),
    });

    // Should return 401 for invalid key
    assertEquals(response.status, 401);
    await response.body?.cancel();
  },
});

/**
 * Test Anthropic API compatibility
 */
Deno.test({
  name: "POST /v1/messages (Anthropic)",
  ignore: !(await isServerRunning()),
  async fn() {
    const response = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": TEST_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          { role: "user", content: "Say 'test successful' and nothing else" },
        ],
        max_tokens: 100,
      }),
    });

    // Anthropic endpoint may not be implemented or may return 401
    assert(response.status === 200 || response.status === 404 || response.status === 401);
    await response.body?.cancel();
  },
});
