/**
 * Anonymous token fetching service
 * Fetches guest tokens from Z.ai when no authentication is configured
 */

import { CONFIG, DEFAULT_LANGUAGE } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { SmartHeaderGenerator } from "./header-generator.ts";

/**
 * Get anonymous token from Z.ai
 * Implements retry logic for reliability
 */
export async function getAnonymousToken(): Promise<string> {
  let retryCount = 0;

  while (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
    try {
      logger.debug("Attempting to get anonymous token (attempt %d/%d)", retryCount + 1, CONFIG.MAX_RETRY_ATTEMPTS);

      // Generate dynamic headers for each request
      const dynamicHeaders = await SmartHeaderGenerator.generateHeaders();

      const response = await fetch(`${CONFIG.ORIGIN_BASE}/api/v1/auths/`, {
        method: "GET",
        headers: {
          ...dynamicHeaders,
          "Accept": "*/*",
          "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9`,
        }
      });

      logger.debug("Anonymous token response status: %d", response.status);

      if (response.status === 200) {
        const data = await response.json() as { token: string; email?: string; role?: string };
        if (data.token) {
          // Check if it's a guest token
          const email = data.email || "";
          const role = data.role || "";
          const isGuest = email.includes("@guest.com") || email.includes("Guest-") || role === "guest";
          const tokenType = isGuest ? "guest" : "authenticated";
          logger.info("Anonymous token obtained successfully (%s): %s...", tokenType, data.token.substring(0, 20));
          return data.token;
        } else {
          logger.warn("Response missing token field: %o", data);
        }
      } else if (response.status === 405) {
        logger.warn("Request blocked by WAF (status 405), may be due to abnormal headers");
        break; // Don't retry on WAF blocks
      } else {
        logger.warn("HTTP request failed with status: %d", response.status);
        try {
          const errorData = await response.json();
          logger.debug("Error response: %o", errorData);
        } catch {
          const errorText = await response.text();
          logger.debug("Error response text: %s", errorText);
        }
      }
    } catch (error) {
      logger.warn("Request failed (attempt %d): %v", retryCount + 1, error);
    }

    retryCount++;
    if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
      logger.debug("Waiting %d ms before retry...", CONFIG.RETRY_DELAY_MS);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    }
  }

  throw new Error(`Failed to obtain anonymous token after ${CONFIG.MAX_RETRY_ATTEMPTS} attempts`);
}

