/**
 * Smart Browser Header Generator
 * Generates realistic browser headers to avoid detection
 * CRITICAL: Must match Python implementation for upstream compatibility
 */

import { CONFIG, DEFAULT_LANGUAGE } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";

// Dynamic FE version (will be fetched from website)
let X_FE_VERSION = CONFIG.DEFAULT_FE_VERSION;

interface BrowserConfig {
  ua: string;
  secChUa: string;
  version: string;
}

/**
 * Smart Header Generator
 */
export class SmartHeaderGenerator {
  private static cachedHeaders: Record<string, string> | null = null;
  private static cacheExpiry: number = 0;
  private static readonly CACHE_DURATION = CONFIG.TOKEN_CACHE_DURATION_MS;

  private static readonly browserConfigs: BrowserConfig[] = [
    {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      secChUa: '"Chromium";v="140", "Not=A?Brand";v="24", "Microsoft Edge";v="140"',
      version: "140.0.0.0"
    },
    {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      secChUa: '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      version: "140.0.0.0"
    },
    {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      secChUa: '"Chromium";v="139", "Not=A?Brand";v="24", "Google Chrome";v="139"',
      version: "139.0.0.0"
    },
    {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      secChUa: '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      version: "141.0.0.0"
    },
    {
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
      secChUa: '"Not_A Brand";v="8", "Chromium";v="126", "Firefox";v="126"',
      version: "126.0"
    },
    {
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      secChUa: '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      version: "140.0.0.0"
    }
  ];

  /**
   * Generate smart browser headers
   */
  static async generateHeaders(chatId: string = ""): Promise<Record<string, string>> {
    // Check cache
    const now = Date.now();
    if (this.cachedHeaders && this.cacheExpiry > now) {
      const headers = { ...this.cachedHeaders };
      if (chatId) {
        headers["Referer"] = `${CONFIG.ORIGIN_BASE}/c/${chatId}`;
      }
      return headers;
    }

    // Fetch latest FE version before generating headers
    await fetchLatestFEVersion();

    // Generate new headers
    const headers = this.generateFreshHeaders(chatId);
    this.cachedHeaders = headers;
    this.cacheExpiry = now + this.CACHE_DURATION;

    logger.debug("Smart headers generated and cached with latest FE version: %s", X_FE_VERSION);
    return headers;
  }

  private static generateFreshHeaders(chatId: string = ""): Record<string, string> {
    // Randomly select browser configuration
    const config = this.browserConfigs[Math.floor(Math.random() * this.browserConfigs.length)];

    // Generate sec-ch-ua based on user agent
    let secChUa = config.secChUa;
    let secChUaPlatform = '"Windows"';

    if (config.ua.includes("Edg/")) {
      // Edge browser
      const edgeVersion = config.version.split(".")[0];
      secChUa = `"Microsoft Edge";v="${edgeVersion}", "Chromium";v="${edgeVersion}", "Not_A Brand";v="24"`;
    } else if (config.ua.includes("Firefox/")) {
      // Firefox browser
      const firefoxVersion = config.version.split(".")[0];
      secChUa = `"Not_A Brand";v="8", "Chromium";v="${firefoxVersion}", "Firefox";v="${firefoxVersion}"`;
    } else if (config.ua.includes("Macintosh")) {
      // macOS Chrome
      secChUaPlatform = '"macOS"';
    }

    const referer = chatId ? `${CONFIG.ORIGIN_BASE}/c/${chatId}` : `${CONFIG.ORIGIN_BASE}/`;

    return {
      // Basic headers
      "Accept": "application/json, text/event-stream",
      "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9,zh;q=0.8`,
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "application/json",
      "Pragma": "no-cache",

      // Browser-specific headers
      "User-Agent": config.ua,
      "Sec-Ch-Ua": secChUa,
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": secChUaPlatform,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",

      // Z.AI specific headers
      "Origin": CONFIG.ORIGIN_BASE,
      "Referer": referer,
      "X-Fe-Version": X_FE_VERSION,
    };
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cachedHeaders = null;
    this.cacheExpiry = 0;
    logger.debug("Header cache cleared");
  }
}

/**
 * Fetch latest FE version from Z.ai website
 */
async function fetchLatestFEVersion(): Promise<string> {
  try {
    logger.debug("Fetching latest FE version from Z.ai website");

    const response = await fetch(CONFIG.ORIGIN_BASE, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (response.ok) {
      const html = await response.text();
      const versionMatch = html.match(/prod-fe-(\d+\.\d+\.\d+)/);

      if (versionMatch) {
        const newVersion = `prod-fe-${versionMatch[1]}`;
        if (newVersion !== X_FE_VERSION) {
          logger.debug("Updated FE version from %s to %s", X_FE_VERSION, newVersion);
          X_FE_VERSION = newVersion;
        }
        return X_FE_VERSION;
      }
    }
  } catch (error) {
    logger.debug("Failed to fetch FE version: %v", error);
  }

  return X_FE_VERSION; // fallback to current version
}

