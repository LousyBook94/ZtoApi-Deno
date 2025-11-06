/**
 * Common helper utilities
 */

import { CONFIG } from "../config/constants.ts";

/**
 * Truncate a string to a maximum length
 */
export function truncateString(str: string, maxLength = CONFIG.DEFAULT_TRUNCATE_LENGTH): string {
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
}

/**
 * Parse boolean header value
 */
export function parseBooleanHeader(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

/**
 * Set CORS headers on a Headers object
 */
export function setCORSHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, anthropic-version, x-feature-thinking, x-feature-web-search, x-feature-auto-web-search, x-feature-image-generation, x-feature-title-generation, x-feature-tags-generation, x-feature-mcp, x-think-tags-mode, x-thinking",
  );
  headers.set("Access-Control-Allow-Credentials", "true");
}

/**
 * Set security headers on a Headers object
 */
export function setSecurityHeaders(headers: Headers): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  status: number,
  type: string,
  message: string,
  additionalHeaders?: Headers,
): Response {
  const headers = new Headers(additionalHeaders);
  headers.set("Content-Type", "application/json");
  setCORSHeaders(headers);

  return new Response(
    JSON.stringify({
      type: "error",
      error: { type, message },
    }),
    { status, headers },
  );
}

/**
 * Validate API key format
 */
export function validateApiKey(authHeader: string): boolean {
  if (!authHeader) return false;

  // Must start with "Bearer " and have a key
  if (!authHeader.startsWith("Bearer ")) return false;

  const key = authHeader.substring(7);
  return key.length > 0;
}

/**
 * Normalize model ID to handle case differences
 */
export function normalizeModelId(modelId: string): string {
  return modelId.toLowerCase().trim();
}
