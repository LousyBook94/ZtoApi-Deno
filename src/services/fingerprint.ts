/**
 * Browser Fingerprint Parameter Generator
 * Generates realistic browser fingerprint data for upstream requests
 */

import { CONFIG, DEFAULT_LANGUAGE } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";

/**
 * Generate complete browser fingerprint parameters
 */
export function generateFingerprintParams(
  timestamp: number,
  requestId: string,
  token: string,
  chatId: string = ""
): Record<string, string> {
  // Extract user ID from JWT token (multi-field support)
  let userId = "guest";
  try {
    const tokenParts = token.split(".");
    if (tokenParts.length === 3) {
      const payload = JSON.parse(atob(tokenParts[1]));

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
    logger.debug("Failed to parse JWT token: %v", e);
  }

  const now = new Date(timestamp);
  const localTime = now.toISOString().replace('T', ' ').substring(0, 23) + 'Z';

  return {
    // Basic parameters
    "timestamp": timestamp.toString(),
    "requestId": requestId,
    "user_id": userId,
    "version": "0.0.1",
    "platform": "web",
    "token": token,

    // Browser environment parameters
    "user_agent": CONFIG.BROWSER_UA,
    "language": DEFAULT_LANGUAGE,
    "languages": `${DEFAULT_LANGUAGE},en`,
    "timezone": "Asia/Shanghai",
    "cookie_enabled": "true",

    // Screen parameters
    "screen_width": "2048",
    "screen_height": "1152",
    "screen_resolution": "2048x1152",
    "viewport_height": "654",
    "viewport_width": "1038",
    "viewport_size": "1038x654",
    "color_depth": "24",
    "pixel_ratio": "1.25",

    // URL parameters
    "current_url": chatId ? `${CONFIG.ORIGIN_BASE}/c/${chatId}` : CONFIG.ORIGIN_BASE,
    "pathname": chatId ? `/c/${chatId}` : "/",
    "search": "",
    "hash": "",
    "host": "chat.z.ai",
    "hostname": "chat.z.ai",
    "protocol": "https:",
    "referrer": "",
    "title": "Z.ai Chat - Free AI powered by GLM-4.6 & GLM-4.5",

    // Time parameters
    "timezone_offset": "-480",
    "local_time": localTime,
    "utc_time": now.toUTCString(),

    // Device parameters
    "is_mobile": "false",
    "is_touch": "false",
    "max_touch_points": "10",
    "browser_name": "Chrome",
    "os_name": "Windows",

    // Signature parameters
    "signature_timestamp": timestamp.toString(),
  };
}

