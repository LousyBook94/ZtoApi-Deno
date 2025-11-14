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
 * Fetch URL tool
 */
async function fetchUrl(args: { url: string }): Promise<string> {
  if (!args || typeof args.url !== "string") {
    throw new Error("URL parameter is required and must be a string");
  }

  try {
    const response = await fetch(args.url, {
      method: "GET",
      headers: {
        "User-Agent": "ZtoApi-Native-Tool/1.0",
      },
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
