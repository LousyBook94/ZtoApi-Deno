/**
 * Initialize built-in tools
 * Registers all native tools that are available by default
 */

import { registerTool, TOOL_REGISTRY } from "./tool-registry.ts";
import { logger } from "../utils/logger.ts";

/**
 * Get current time tool
 */
function getCurrentTime(_args: unknown): string {
  return new Date().toISOString();
}

/**
 * Validate URL for security (prevent SSRF attacks)
 */
function validateUrl(url: string): void {
  try {
    const parsedUrl = new URL(url);

    // Block non-HTTP/HTTPS protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed.`);
    }

    // Block localhost and private IP ranges
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost variants
    const localhostPatterns = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    if (localhostPatterns.includes(hostname) || hostname.startsWith("127.") || hostname.startsWith("0.")) {
      throw new Error("Access to localhost is not allowed for security reasons.");
    }

    // Block private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^fc00:/, // IPv6 private
      /^fe80:/, // IPv6 link-local
    ];

    for (const range of privateRanges) {
      if (range.test(hostname)) {
        throw new Error(`Access to private IP range ${hostname} is not allowed for security reasons.`);
      }
    }

    // Block internal hostnames
    const internalPatterns = ["internal", "intranet", "local", "dev", "test"];
    if (internalPatterns.some((pattern) => hostname.includes(pattern))) {
      throw new Error(`Access to internal hostname ${hostname} is not allowed for security reasons.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unsupported protocol")) {
      throw error;
    }
    if (error instanceof Error && (error.message.includes("not allowed") || error.message.includes("security"))) {
      throw error;
    }
    throw new Error(`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch URL tool with security validation
 */
async function fetchUrl(args: { url: string }): Promise<string> {
  if (!args || typeof args.url !== "string") {
    throw new Error("URL parameter is required and must be a string");
  }

  // Validate URL for security
  validateUrl(args.url);

  try {
    const response = await fetch(args.url, {
      method: "GET",
      headers: {
        "User-Agent": "ZtoApi-Native-Tool/1.0",
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(60000), // 1 minute timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } else {
      const text = await response.text();
      // Limit response size to prevent issues
      return text.length > 10000 ? text.substring(0, 10000) + "..." : text;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`Request timeout: URL took too long to respond`);
    }
    logger.error("Failed to fetch URL %s: %v", args.url, error);
    throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Hash string tool
 */
async function hashString(args: { text: string; algorithm?: "sha256" | "sha1" | "md5" }): Promise<string> {
  if (!args || typeof args.text !== "string") {
    throw new Error("Text parameter is required and must be a string");
  }

  const algorithm = args.algorithm || "sha256";
  const encoder = new TextEncoder();
  const data = encoder.encode(args.text);

  try {
    let hashBuffer: ArrayBuffer;
    switch (algorithm) {
      case "sha256":
        hashBuffer = await crypto.subtle.digest("SHA-256", data);
        break;
      case "sha1":
        hashBuffer = await crypto.subtle.digest("SHA-1", data);
        break;
      case "md5":
        // MD5 is not supported by Web Crypto API, use a simple fallback
        throw new Error("MD5 algorithm is not supported. Use sha256 or sha1 instead.");
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  } catch (error) {
    logger.error("Failed to hash string: %v", error);
    throw new Error(`Failed to hash string: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate expression tool
 */
function calculateExpression(args: { expression: string }): number {
  if (!args || typeof args.expression !== "string") {
    throw new Error("Expression parameter is required and must be a string");
  }

  // Simple and safe math expression evaluation
  // Only allow numbers, basic operators, and parentheses
  const sanitized = args.expression.replace(/[^0-9+\-*/().\s]/g, "");
  if (sanitized !== args.expression) {
    throw new Error("Expression contains invalid characters");
  }

  try {
    // Use Function constructor for safe evaluation (no access to global scope)
    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Invalid calculation result");
    }
    return result;
  } catch (error) {
    logger.error("Failed to calculate expression %s: %v", args.expression, error);
    throw new Error(`Failed to calculate expression: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Register all built-in tools
 */
export function initializeBuiltinTools(): void {
  logger.debug("Initializing built-in tools...");

  // Register get_current_time tool
  registerTool(
    "get_current_time",
    getCurrentTime,
    "Get the current UTC time in ISO 8601 format",
    {
      type: "object",
      properties: {},
      required: [],
    },
  );

  // Register fetch_url tool
  registerTool(
    "fetch_url",
    (...args: unknown[]) => fetchUrl(args[0] as { url: string }),
    "Fetch content from a URL (supports text and JSON responses)",
    {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch content from",
        },
      },
      required: ["url"],
    },
  );

  // Register hash_string tool
  registerTool(
    "hash_string",
    (...args: unknown[]) => hashString(args[0] as { text: string; algorithm?: "sha256" | "sha1" | "md5" }),
    "Calculate hash of a string using specified algorithm",
    {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to hash",
        },
        algorithm: {
          type: "string",
          enum: ["sha256", "sha1"],
          description: "Hash algorithm to use (default: sha256)",
        },
      },
      required: ["text"],
    },
  );

  // Register calculate_expression tool
  registerTool(
    "calculate_expression",
    (...args: unknown[]) => calculateExpression(args[0] as { expression: string }),
    "Safely evaluate mathematical expressions",
    {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to evaluate",
        },
      },
      required: ["expression"],
    },
  );

  logger.info("Initialized %d built-in tools", Object.keys(TOOL_REGISTRY).length);
}
