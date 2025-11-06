/**
 * Unit tests for ZtoApi modules
 */

import { assertEquals, assertExists } from "assert";
import { CONFIG } from "../src/config/constants.ts";
import { getModelConfig, SUPPORTED_MODELS } from "../src/config/models.ts";
import { logger } from "../src/utils/logger.ts";
import { setCORSHeaders, truncateString } from "../src/utils/helpers.ts";

Deno.test("CONFIG constants are defined", () => {
  assertExists(CONFIG.DEFAULT_PORT);
  assertExists(CONFIG.MAX_RETRY_ATTEMPTS);
  assertExists(CONFIG.RETRY_DELAY_MS);
  assertEquals(typeof CONFIG.DEFAULT_PORT, "number");
  assertEquals(typeof CONFIG.MAX_RETRY_ATTEMPTS, "number");
  assertEquals(typeof CONFIG.RETRY_DELAY_MS, "number");
});

Deno.test("SUPPORTED_MODELS is not empty", () => {
  assertExists(SUPPORTED_MODELS);
  assertEquals(Array.isArray(SUPPORTED_MODELS), true);
  assertEquals(SUPPORTED_MODELS.length > 0, true);
});

Deno.test("getModelConfig returns valid config", () => {
  const config = getModelConfig("GLM-4.5");
  assertExists(config);
  assertExists(config.id);
  assertExists(config.name);
  assertExists(config.upstreamId);
  assertExists(config.capabilities);
});

Deno.test("logger functions exist", () => {
  assertExists(logger.debug);
  assertExists(logger.info);
  assertExists(logger.warn);
  assertExists(logger.error);
  assertEquals(typeof logger.debug, "function");
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
});

Deno.test("truncateString works correctly", () => {
  assertEquals(truncateString("hello world"), "hello world");
  assertEquals(truncateString("hi"), "hi");
  assertEquals(truncateString(""), "");
  // Test with very long string (default max is 50)
  const longString = "a".repeat(100);
  assertEquals(truncateString(longString).length, 53); // 50 + "..."
});

Deno.test("setCORSHeaders sets correct headers", () => {
  const headers = new Headers();
  setCORSHeaders(headers);

  assertEquals(headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
  assertExists(headers.get("Access-Control-Allow-Headers"));
  assertEquals(headers.get("Access-Control-Allow-Credentials"), "true");
});

Deno.test("Model capabilities detection", () => {
  const glm45 = getModelConfig("GLM-4.5");
  assertEquals(glm45.capabilities.thinking, true);
  assertEquals(glm45.capabilities.mcp, true);

  const glm45v = getModelConfig("glm-4.5v");
  assertEquals(glm45v.capabilities.vision, true);
});
