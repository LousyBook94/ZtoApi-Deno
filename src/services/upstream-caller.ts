/**
 * Upstream API Caller
 * Handles communication with Z.ai upstream API
 * CRITICAL: Must preserve exact request format for upstream compatibility
 */

import { decodeBase64 } from "@std/encoding/base64";
import { UPSTREAM_URL, CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { generateSignature } from "./signature.ts";
import { SmartHeaderGenerator } from "./header-generator.ts";
import { ImageProcessor } from "./image-processor.ts";
import type { UpstreamRequest } from "../types/upstream.ts";
import type { TokenPool } from "./token-pool.ts";

/**
 * Call upstream API with proper headers and signature
 */
export async function callUpstreamWithHeaders(
  upstreamReq: UpstreamRequest,
  refererChatID: string,
  authToken: string,
  tokenPool: TokenPool
): Promise<Response> {
  try {
    logger.debug("Call upstream API: %s", UPSTREAM_URL);

    // 1. Decode JWT to get user_id
    let userId = "guest";
    try {
      const tokenParts = authToken.split(".");
      if (tokenParts.length === 3) {
        const payload = JSON.parse(
          new TextDecoder().decode(decodeBase64(tokenParts[1]))
        );

        // Try multiple possible user_id fields
        for (const key of ["id", "user_id", "uid", "sub"]) {
          const val = payload[key];
          if (typeof val === "string" || typeof val === "number") {
            const strVal = String(val);
            if (strVal.length > 0) {
              userId = strVal;
              logger.debug("Parsed user_id from JWT: %s (field: %s)", userId, key);
              break;
            }
          }
        }
      }
    } catch (e) {
      logger.debug("Failed to parse JWT: %v", e);
    }

    // 2. Prepare parameters needed for signature
    const timestamp = Date.now();
    const requestId = crypto.randomUUID();
    const lastMessageContent = ImageProcessor.extractLastUserContent(upstreamReq.messages);

    if (!lastMessageContent) {
      throw new Error("Cannot get user message content for signature");
    }

    const e = `requestId,${requestId},timestamp,${timestamp},user_id,${userId}`;

    // 3. Generate signature
    const { signature } = await generateSignature(
      e,
      lastMessageContent,
      timestamp
    );
    logger.debug("Generated signature: %s", signature);

    // 4. Build request body
    const reqBody = JSON.stringify(upstreamReq);
    logger.debug("Upstream request body: %s", reqBody);

    // 5. Generate smart browser headers
    const smartHeaders = await SmartHeaderGenerator.generateHeaders(refererChatID);

    // 6. Build query parameters
    const queryParams = {
      "timestamp": timestamp.toString(),
      "requestId": requestId,
      "user_id": userId,
      "version": "0.0.1",
      "platform": "web",
      "token": authToken,
      "current_url": refererChatID ? `${CONFIG.ORIGIN_BASE}/c/${refererChatID}` : CONFIG.ORIGIN_BASE,
      "pathname": refererChatID ? `/c/${refererChatID}` : "/",
      "search": "",
      "hash": "",
      "host": "chat.z.ai",
      "hostname": "chat.z.ai",
      "protocol": "https:",
      "referrer": "",
      "title": "Z.ai Chat - Free AI powered by GLM-4.6 & GLM-4.5",
      "timezone_offset": "-480",
      "local_time": new Date(timestamp).toISOString().replace('T', ' ').substring(0, 23) + 'Z',
      "utc_time": new Date(timestamp).toUTCString(),
      "is_mobile": "false",
      "is_touch": "false",
      "max_touch_points": "10",
      "browser_name": "Chrome",
      "os_name": "Windows",
      "signature_timestamp": timestamp.toString(),
    };

    const params = new URLSearchParams(queryParams);
    const fullURL = `${UPSTREAM_URL}?${params.toString()}`;

    // 7. Merge headers
    const finalHeaders = {
      ...smartHeaders,
      "Authorization": `Bearer ${authToken}`,
      "X-Signature": signature,
      "Accept": "application/json, text/event-stream",
    };

    logger.debug("Request details:");
    logger.debug("  URL: %s", fullURL);
    logger.debug("  Headers: Authorization=Bearer *****, X-Signature=%s", signature.substring(0, 16));

    const response = await fetch(fullURL, {
      method: "POST",
      headers: finalHeaders,
      body: reqBody,
    });

    logger.debug("Upstream response status: %d %s", response.status, response.statusText);

    // 8. Mark token as valid on success
    tokenPool.markSuccess(authToken);

    return response;
  } catch (error) {
    logger.error("Failed to call upstream: %v", error);

    // Try switching token on failure
    try {
      const newToken = tokenPool.switchToNext();
      if (newToken) {
        logger.debug("Switch to new token retry: %s", newToken.substring(0, 20));
        // Retry recursively once, avoid infinite loop
        return callUpstreamWithHeaders(upstreamReq, refererChatID, newToken, tokenPool);
      }
    } catch (retryError) {
      logger.error("Token switch retry failed: %v", retryError);
    }

    throw error;
  }
}

