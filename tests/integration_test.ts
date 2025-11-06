/**
 * Integration tests for ZtoApi
 * Tests the server endpoints and functionality
 */

import { assert, assertEquals } from "assert";

const BASE_URL = "http://localhost:9090";
const TEST_API_KEY = "sk-test-key";

/**
 * Test /v1/models endpoint
 */
Deno.test("GET /v1/models returns model list", async () => {
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
});

/**
 * Test /v1/chat/completions endpoint (non-streaming)
 */
Deno.test("POST /v1/chat/completions (non-streaming)", async () => {
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

  assertEquals(response.status, 200);
  const data = await response.json();
  assert(data.choices);
  assert(data.choices.length > 0);
  assert(data.choices[0].message);
});

/**
 * Test /v1/chat/completions endpoint (streaming)
 */
Deno.test("POST /v1/chat/completions (streaming)", async () => {
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

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/event-stream");

  // Read at least one chunk
  const reader = response.body?.getReader();
  assert(reader);
  const { value } = await reader.read();
  assert(value);
  reader.releaseLock();
});

/**
 * Test CORS headers
 */
Deno.test("OPTIONS request returns CORS headers", async () => {
  const response = await fetch(`${BASE_URL}/v1/models`, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assert(response.headers.get("Access-Control-Allow-Origin"));
  assert(response.headers.get("Access-Control-Allow-Methods"));
});

/**
 * Test dashboard endpoint
 */
Deno.test("GET /dashboard returns HTML", async () => {
  const response = await fetch(`${BASE_URL}/dashboard`);

  assertEquals(response.status, 200);
  assert(response.headers.get("Content-Type")?.includes("text/html"));
});

/**
 * Test API stats endpoint
 */
Deno.test("GET /api/stats returns statistics", async () => {
  const response = await fetch(`${BASE_URL}/api/stats`);

  assertEquals(response.status, 200);
  const data = await response.json();
  assert(typeof data.totalRequests === "number");
  assert(typeof data.successfulRequests === "number");
  assert(typeof data.failedRequests === "number");
});

/**
 * Test invalid API key
 */
Deno.test("Invalid API key returns 401", async () => {
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

  assertEquals(response.status, 401);
});

/**
 * Test Anthropic API compatibility
 */
Deno.test("POST /v1/messages (Anthropic)", async () => {
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

  assertEquals(response.status, 200);
});
