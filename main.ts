/**
 * ZtoApi - OpenAI-compatible API proxy server
 *
 * Overview:
 * - Provides an OpenAI-compatible API interface for Z.ai's GLM-4.5 models
 * - Supports streaming and non-streaming responses
 * - Includes a real-time monitoring Dashboard
 * - Supports automatic anonymous token fetching
 * - Intelligently handles model "thinking" content display
 * - Complete request statistics and error handling
 *
 * Tech stack:
 * - Deno native HTTP API
 * - TypeScript for type safety
 * - Server-Sent Events (SSE) streaming
 * - Supports Deno Deploy and self-hosted deployment
 *
 * @author ZtoApi Team
 * @version 2.0.0
 * @since 2024
 */

import { decodeBase64 } from "@std/encoding/base64";
import {
  type AnthropicMessagesRequest,
  type AnthropicTokenCountRequest,
  type AnthropicTokenCountResponse,
  convertAnthropicToOpenAI,
  convertOpenAIToAnthropic,
  countTokens,
  processAnthropicStream,
  getClaudeModels
} from "./anthropic.ts";

declare global {
  interface ImportMeta {
    main: boolean;
  }
}

declare namespace Deno {
  interface Conn {
    readonly rid: number;
    localAddr: Addr;
    remoteAddr: Addr;
    read(p: Uint8Array): Promise<number | null>;
    write(p: Uint8Array): Promise<number>;
    close(): void;
  }

  interface Addr {
    hostname: string;
    port: number;
    transport: string;
  }

  interface Listener extends AsyncIterable<Conn> {
    readonly addr: Addr;
    accept(): Promise<Conn>;
    close(): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<Conn>;
  }

  interface HttpConn {
    nextRequest(): Promise<RequestEvent | null>;
    [Symbol.asyncIterator](): AsyncIterableIterator<RequestEvent>;
  }

  interface RequestEvent {
    request: Request;
    respondWith(r: Response | Promise<Response>): Promise<void>;
  }

  function listen(options: { port: number }): Listener;
  function serveHttp(conn: Conn): HttpConn;
  function serve(options: { port: number; handler: (request: Request) => Promise<Response> }): void;

  namespace env {
    function get(key: string): string | undefined;
  }

  export function readTextFile(path: string): Promise<string>;
  export function readFile(path: string): Promise<Uint8Array>;
}

/**
 * Request statistics interface
 * Tracks metrics for API calls
 */
interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: Date;
  averageResponseTime: number;
}

/**
 * Live request info for Dashboard display
 */
interface LiveRequest {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  status: number;
  duration: number;
  userAgent: string;
  model?: string;
}

/**
 * OpenAI-compatible request structure for chat completions.
 * @interface OpenAIRequest
 * @property {string} model - The model to use for the request.
 * @property {Message[]} messages - The messages in the conversation.
 * @property {boolean} [stream] - Whether to stream the response.
 * @property {number} [temperature] - Sampling temperature for the model.
 * @property {number} [max_tokens] - Maximum number of tokens to generate.
 * @property {boolean} [reasoning] - Whether to enable reasoning mode.
 */
interface OpenAIRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  reasoning?: boolean;
}

/**
 * Chat message structure
 * Supports multimodal content: text, image, video, document, audio
 */
interface Message {
  role: string;
  content: string | Array<{
    type: string;
    text?: string;
    image_url?: {url: string};
    video_url?: {url: string};
    document_url?: {url: string};
    audio_url?: {url: string};
  }>;
  reasoning_content?: string;
}

/**
 * Upstream request structure sent to Z.ai API.
 * @interface UpstreamRequest
 * @property {boolean} stream - Whether the response should be streamed.
 * @property {string} model - The model identifier.
 * @property {Message[]} messages - The conversation messages.
 * @property {Record<string, unknown>} params - Additional parameters.
 * @property {Record<string, unknown>} features - Feature flags.
 * @property {Record<string, boolean>} [background_tasks] - Background tasks to run.
 * @property {string} [chat_id] - Chat session identifier.
 * @property {string} [id] - Request identifier.
 * @property {string[]} [mcp_servers] - List of MCP servers to use.
 * @property {object} [model_item] - Model item details.
 * @property {string[]} [tool_servers] - List of tool servers.
 * @property {Record<string, string>} [variables] - Variables for the request.
 * @property {string} [signature_prompt] - Prompt for signature generation.
 */
interface UpstreamRequest {
  stream: boolean;
  model: string;
  messages: Message[];
  params: Record<string, unknown>;
  features: Record<string, unknown>;
  background_tasks?: Record<string, boolean>;
  chat_id?: string;
  id?: string;
  mcp_servers?: string[];
  model_item?: {
    id: string;
    name: string;
    owned_by: string;
    openai?: Record<string, unknown>;
    urlIdx?: number;
    info?: Record<string, unknown>;
    actions?: Record<string, unknown>[];
    tags?: Record<string, unknown>[];
  };
  tool_servers?: string[];
  variables?: Record<string, string>;
  signature_prompt?: string;
}

/**
 * OpenAI-compatible response structure
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

interface Choice {
  index: number;
  message?: Message;
  delta?: Delta;
  finish_reason?: string;
}

interface Delta {
  role?: string;
  content?: string;
  reasoning_content?: string;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Configuration for an MCP (Model Context Protocol) server.
 * @interface MCPServerConfig
 * @property {string} name - The name of the MCP server.
 * @property {string} description - A description of what the MCP server does.
 * @property {boolean} enabled - Whether the MCP server is enabled.
 */
interface MCPServerConfig {
  name: string;
  description: string;
  enabled: boolean;
}

/**
 * Capabilities of a model, indicating supported features.
 * @interface ModelCapabilities
 * @property {boolean} thinking - Whether the model supports thinking/reasoning.
 * @property {boolean} search - Whether the model supports basic search.
 * @property {boolean} advancedSearch - Whether the model supports advanced search.
 * @property {boolean} vision - Whether the model supports vision/multimodal input.
 * @property {boolean} mcp - Whether the model supports MCP (Model Context Protocol).
 */
interface ModelCapabilities {
  thinking: boolean;
  search: boolean;
  advancedSearch: boolean;
  vision: boolean;
  mcp: boolean;
}

/**
 * Structure representing an uploaded file.
 * @interface UploadedFile
 * @property {string} id - Unique identifier for the file.
 * @property {string} filename - The name of the file.
 * @property {number} size - The size of the file in bytes.
 * @property {string} type - The MIME type of the file.
 * @property {string} url - The URL to access the file.
 */
interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  type: string;
  url: string;
}

/**
 * Upstream SSE data structure
 */
interface UpstreamData {
  type: string;
  data: {
    delta_content: string;
    edit_content?: string;  // Contains complete thinking block when phase changes
    edit_index?: number;
    phase: string;
    done: boolean;
    usage?: Usage;
    error?: UpstreamError;
    inner?: {
      error?: UpstreamError;
    };
  };
  error?: UpstreamError;
}

interface UpstreamError {
  detail: string;
  code: number;
}

interface ModelsResponse {
  object: string;
  data: Model[];
}

interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * Configuration constants
 */

// Thinking content handling mode:
// - "strip": remove <details> tags and show only content
// - "thinking": convert <details> to <thinking> tags
// - "think": convert <details> to <think> tags
// - "raw": keep as-is
// - "separate": separate reasoning into reasoning_content field
const THINK_TAGS_MODE = "think"; // options: "strip", "thinking", "think", "raw", "separate"


/**
  * Advanced Mode Detector
  */
class ModelCapabilityDetector {
   /**
    * Detect model's advanced capabilities (matching Python version exactly)
    */
  static detectCapabilities(modelId: string, reasoning?: boolean): ModelCapabilities {
    const normalizedModelId = modelId.toLowerCase();

    return {
      thinking: this.isThinkingModel(normalizedModelId, reasoning),
      search: this.isSearchModel(normalizedModelId),
      advancedSearch: this.isAdvancedSearchModel(normalizedModelId),
      vision: this.isVisionModel(normalizedModelId),
      mcp: this.supportsMCP(normalizedModelId),
    };
  }

  private static isThinkingModel(modelId: string, reasoning?: boolean): boolean {
    return modelId.includes("thinking") ||
           modelId.includes("4.6") ||
           reasoning === true ||
           modelId.includes("0727-360b-api");
  }

  private static isSearchModel(modelId: string): boolean {
    return modelId.includes("search") ||
           modelId.includes("web") ||
           modelId.includes("browser");
  }

  private static isAdvancedSearchModel(modelId: string): boolean {
    return modelId.includes("advanced-search") ||
           modelId.includes("advanced") ||
           modelId.includes("pro-search");
  }

  private static isVisionModel(modelId: string): boolean {
    return modelId.includes("4.5v") ||
           modelId.includes("vision") ||
           modelId.includes("image") ||
           modelId.includes("multimodal");
  }

   private static supportsMCP(modelId: string): boolean {
     // Most advanced models support MCP (matching Python version exactly)
     return this.isThinkingModel(modelId) ||
            this.isSearchModel(modelId) ||
            this.isAdvancedSearchModel(modelId);
   }

   /**
    * Get MCP server list for model (matching Python version exactly)
    */
  static getMCPServersForModel(capabilities: ModelCapabilities): string[] {
    const servers: string[] = [];

    if (capabilities.advancedSearch) {
      servers.push("advanced-search");
      debugLog("🔍 Detected advanced search model, adding advanced-search MCP server");
    } else if (capabilities.search) {
      servers.push("deep-web-search");
    }

     // Add hidden MCP server features
     if (capabilities.mcp) {
       // These servers are added as hidden features to features
       debugLog("Model supports hidden MCP features: vibe-coding, ppt-maker, image-search, deep-research");
     }

    return servers;
  }

   /**
    * Get hidden MCP features list (matching Python version exactly)
    */
  static getHiddenMCPFeatures(): Array<{ type: string; server: string; status: string }> {
    return [
      { type: "mcp", server: "vibe-coding", status: "hidden" },
      { type: "mcp", server: "ppt-maker", status: "hidden" },
      { type: "mcp", server: "image-search", status: "hidden" },
      { type: "mcp", server: "deep-research", status: "hidden" },
      { type: "tool_selector", server: "tool_selector", status: "hidden" },
      { type: "mcp", server: "advanced-search", status: "hidden" }
    ];
  }
}

/**
   * Smart Header Generator (Updated to match Python version)
   * Dynamically generate real browser request headers with proper sec-ch-ua
   */
class SmartHeaderGenerator {
   private static cachedHeaders: Record<string, string> | null = null;
   private static cacheExpiry: number = 0;
   private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5-minute cache

   // Browser configurations matching Python version exactly
   private static readonly browserConfigs = [
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
     * Generate smart browser headers (matching Python version exactly)
     */
    static async generateHeaders(chatId: string = ""): Promise<Record<string, string>> {
      // Check cache
      const now = Date.now();
     if (this.cachedHeaders && this.cacheExpiry > now) {
       const headers = { ...this.cachedHeaders };
       if (chatId) {
         headers["Referer"] = `${ORIGIN_BASE}/c/${chatId}`;
       }
       return headers;
      }

      // Fetch latest FE version before generating headers
      await fetchLatestFEVersion();

      // Generate new headers
      const headers = this.generateFreshHeaders(chatId);
     this.cachedHeaders = headers;
     this.cacheExpiry = now + this.CACHE_DURATION;

      debugLog("Python version smart headers generated and cached with latest FE version: %s", X_FE_VERSION);
      return headers;
   }

    private static generateFreshHeaders(chatId: string = ""): Record<string, string> {
      // Randomly select browser configuration (weighted towards Chrome/Edge like Python version)
      const config = this.browserConfigs[Math.floor(Math.random() * this.browserConfigs.length)];

      // Generate sec-ch-ua based on user agent (matching Python logic exactly)
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

      const referer = chatId ? `${ORIGIN_BASE}/c/${chatId}` : `${ORIGIN_BASE}/`;

      return {
        // Basic headers (matching Python version exactly)
        "Accept": "application/json, text/event-stream",
        "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9,zh;q=0.8`,
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/json",
        "Pragma": "no-cache",

        // Browser-specific headers (matching Python version exactly)
        "User-Agent": config.ua,
        "Sec-Ch-Ua": secChUa,
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": secChUaPlatform,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",

        // Z.AI specific headers
        "Origin": ORIGIN_BASE,
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
      debugLog("Header cache cleared");
   }
 }

/**
  * Browser Fingerprint Parameter Generator
  */
class _BrowserFingerprintGenerator {
   /**
    * Generate complete browser fingerprint parameters (matching Python version)
    */
  static generateFingerprintParams(
    timestamp: number,
    requestId: string,
    token: string,
    chatId: string = ""
   ): Record<string, string> {
     // Extract user ID from JWT token (multi-field support, consistent with Python version)
     let userId = "guest";
     try {
       const tokenParts = token.split(".");
       if (tokenParts.length === 3) {
         const payload = JSON.parse(atob(tokenParts[1]));

         // Try multiple possible user_id fields (consistent with Python version)
         for (const key of ["id", "user_id", "uid", "sub"]) {
           const val = payload[key];
           if (typeof val === "string" || typeof val === "number") {
             const strVal = String(val);
             if (strVal.length > 0) {
               userId = strVal;
               debugLog("Parsed user_id from JWT: %s (field: %s)", userId, key);
               break;
             }
           }
         }
       }
     } catch (e) {
       debugLog("Failed to parse JWT token: %v", e);
     }

    const now = new Date(timestamp);
    const localTime = now.toISOString().replace('T', ' ').substring(0, 23) + 'Z';

     return {
       // Basic parameters (matching Python version)
       "timestamp": timestamp.toString(),
       "requestId": requestId,
       "user_id": userId,
       "version": "0.0.1",
       "platform": "web",
       "token": token,

       // Browser environment parameters (matching Python version)
       "user_agent": BROWSER_UA,
       "language": DEFAULT_LANGUAGE,
       "languages": `${DEFAULT_LANGUAGE},en`,
       "timezone": "Asia/Shanghai",
       "cookie_enabled": "true",

       // Screen parameters (matching Python version)
       "screen_width": "2048",
       "screen_height": "1152",
       "screen_resolution": "2048x1152",
       "viewport_height": "654",
       "viewport_width": "1038",
       "viewport_size": "1038x654",
       "color_depth": "24",
       "pixel_ratio": "1.25",

       // URL parameters (matching Python version)
       "current_url": chatId ? `${ORIGIN_BASE}/c/${chatId}` : ORIGIN_BASE,
       "pathname": chatId ? `/c/${chatId}` : "/",
       "search": "",
       "hash": "",
       "host": "chat.z.ai",
       "hostname": "chat.z.ai",
       "protocol": "https:",
       "referrer": "",
       "title": "Z.ai Chat - Free AI powered by GLM-4.6 & GLM-4.5",

       // Time parameters (matching Python version)
       "timezone_offset": "-480",
       "local_time": localTime,
       "utc_time": now.toUTCString(),

       // Device parameters (matching Python version)
       "is_mobile": "false",
       "is_touch": "false",
       "max_touch_points": "10",
       "browser_name": "Chrome",
       "os_name": "Windows",

       // Signature parameters (matching Python version)
       "signature_timestamp": timestamp.toString(),
     };
   }
}

// Dynamic FE version (will be fetched from website)
let X_FE_VERSION = "prod-fe-1.0.95"; // fallback default
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";
const _SEC_CH_UA = "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Microsoft Edge\";v=\"140\"";
const _SEC_CH_UA_MOB = "?0";
const _SEC_CH_UA_PLAT = "\"Windows\"";
const ORIGIN_BASE = "https://chat.z.ai";

/**
 * Fetch latest FE version from Z.ai website (matching Python version)
 */
async function fetchLatestFEVersion(): Promise<string> {
  try {
    debugLog("Fetching latest FE version from Z.ai website");

    const response = await fetch(ORIGIN_BASE, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9,zh;q=0.8`,
        "Cache-Control": "no-cache"
      }
    });

    if (response.ok) {
      const html = await response.text();
      const versionMatch = html.match(/prod-fe-(\d+\.\d+\.\d+)/);

      if (versionMatch) {
        const newVersion = `prod-fe-${versionMatch[1]}`;
        if (newVersion !== X_FE_VERSION) {
          debugLog("Updated FE version from %s to %s", X_FE_VERSION, newVersion);
          X_FE_VERSION = newVersion;
        }
        return X_FE_VERSION;
      }
    }
  } catch (error) {
    debugLog("Failed to fetch FE version: %v", error);
  }

  return X_FE_VERSION; // fallback to current version
}


/**
 * Environment variable configuration
 */
const UPSTREAM_URL = Deno.env.get("UPSTREAM_URL") || "https://chat.z.ai/api/chat/completions";
const DEFAULT_KEY = Deno.env.get("DEFAULT_KEY") || "sk-your-key";
const ZAI_TOKEN = Deno.env.get("ZAI_TOKEN") || "";
const DEFAULT_LANGUAGE = Deno.env.get("DEFAULT_LANGUAGE") || "en-US";

/**
  * Token Pool Management System
  * Supports multiple token rotation, automatically switches failed tokens
  */
const DEBUG_MODE = Deno.env.get("DEBUG_MODE") !== "false"; // default true
const DEFAULT_STREAM = Deno.env.get("DEFAULT_STREAM") !== "false"; // default true
const DASHBOARD_ENABLED = Deno.env.get("DASHBOARD_ENABLED") !== "false"; // default true

interface TokenInfo {
  token: string;
  isValid: boolean;
  lastUsed: number;
  failureCount: number;
  isAnonymous?: boolean;
}

class TokenPool {
  private tokens: TokenInfo[] = [];
  private currentIndex: number = 0;
  private anonymousToken: string | null = null;
  private anonymousTokenExpiry: number = 0;

  constructor() {
    this.initializeTokens();
  }

   /**
    * Initialize Token pool (matching Python version exactly)
    */
   private initializeTokens(): void {
     // Read multiple tokens from environment variable, separated by commas
     const tokenEnv = Deno.env.get("ZAI_TOKENS");
    if (tokenEnv) {
      const tokenList = tokenEnv.split(",").map(t => t.trim()).filter(t => t.length > 0);
      this.tokens = tokenList.map((token, _index) => ({
        token,
        isValid: true,
        lastUsed: 0,
        failureCount: 0,
        isAnonymous: false
      }));
      debugLog("Token pool initialized, contains %d tokens", this.tokens.length);
     } else if (ZAI_TOKEN) {
       // Compatible with single token configuration
       this.tokens = [{
        token: ZAI_TOKEN,
        isValid: true,
        lastUsed: 0,
        failureCount: 0,
        isAnonymous: false
      }];
      debugLog("Using single token configuration");
    } else {
       debugLog("⚠️ No token configured, will use anonymous token");
    }
  }

   /**
    * Get next available token (matching Python version exactly)
    */
   async getToken(): Promise<string> {
     // If there are configured tokens, try to use them
     if (this.tokens.length > 0) {
      const token = this.getNextValidToken();
      if (token) {
        token.lastUsed = Date.now();
        return token.token;
       }
     }
 
     // Downgrade to anonymous token
     return await this.getAnonymousToken();
  }

   /**
    * Get next valid configured token (matching Python version exactly)
    */
  private getNextValidToken(): TokenInfo | null {
    const startIndex = this.currentIndex;

    do {
      const tokenInfo = this.tokens[this.currentIndex];
      if (tokenInfo.isValid && tokenInfo.failureCount < 3 && !tokenInfo.isAnonymous) {
        return tokenInfo;
      }
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
     } while (this.currentIndex !== startIndex);
 
     return null; // All tokens are unavailable
  }

   /**
    * Switch to next token (called when current token fails) - matching Python version exactly
    */
  switchToNext(): string | null {
     if (this.tokens.length === 0) return null;
 
     // Mark current token as failed
     const currentToken = this.tokens[this.currentIndex];
    currentToken.failureCount++;
    if (currentToken.failureCount >= 3) {
       currentToken.isValid = false;
        debugLog("Token marked as invalid: %s", currentToken.token.substring(0, 20));
     }
 
     // Switch to next
     this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    const nextToken = this.tokens[this.currentIndex];

    if (nextToken && nextToken.isValid && !nextToken.isAnonymous) {
       debugLog("Switch to next token: %s", nextToken.token.substring(0, 20));
      nextToken.lastUsed = Date.now();
       return nextToken.token;
     }
 
     return null; // All configured tokens are unavailable
  }

   /**
    * Reset token status (after successful call) - matching Python version exactly
    */
  markSuccess(token: string): void {
    const tokenInfo = this.tokens.find(t => t.token === token);
    if (tokenInfo) {
      tokenInfo.failureCount = 0;
      tokenInfo.isValid = true;
      tokenInfo.lastUsed = Date.now();
    }
  }

   /**
    * Get anonymous token (matching Python version exactly)
    */
  private async getAnonymousToken(): Promise<string> {
     const now = Date.now();
 
     // Check if cache is valid
     if (this.anonymousToken && this.anonymousTokenExpiry > now) {
      return this.anonymousToken;
    }

    try {
       this.anonymousToken = await getAnonymousToken();
       this.anonymousTokenExpiry = now + (60 * 60 * 1000); // 1 hour validity period
        debugLog("Anonymous token obtained and cached");
      return this.anonymousToken;
    } catch (error) {
      debugLog("Failed to obtain anonymous token: %v", error);
      throw error;
    }
  }

   /**
    * Clear anonymous token cache
    */
  clearAnonymousTokenCache(): void {
    this.anonymousToken = null;
    this.anonymousTokenExpiry = 0;
     debugLog("Anonymous token cache cleared");
  }

   /**
    * Get token pool size
    */
  getPoolSize(): number {
    return this.tokens.length;
  }

   /**
    * Check if it is an anonymous token
    */
  isAnonymousToken(token: string): boolean {
    return this.anonymousToken === token;
   }
 }
 
 // Global token pool instance
 const tokenPool = new TokenPool();

/**
  * Image Processing Tool Class
  */
class ImageProcessor {
   /**
    * Detect if message contains image content
    */
  static hasImageContent(messages: Message[]): boolean {
    for (const msg of messages) {
      if (msg.role === "user") {
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "image_url" && part.image_url?.url) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

   /**
    * Upload image to Z.AI server
    */
  static async uploadImage(imageUrl: string, token: string, chatId: string = ""): Promise<UploadedFile | null> {
    try {
        debugLog("Start uploading image: %s", imageUrl.substring(0, 50) + "...");

       // Process base64 image data
       let imageData: Uint8Array;
      let filename: string;
      let mimeType: string;

       if (imageUrl.startsWith("data:image/")) {
         // Parse base64 image
         const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid base64 image format");
        }

        mimeType = `image/${matches[1]}`;
        filename = `image.${matches[1]}`;
        const base64Data = matches[2];
        imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
       } else if (imageUrl.startsWith("http")) {
         // Download remote image
         const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = contentType.split("/")[1] || "jpg";
        filename = `image.${extension}`;

        const buffer = await response.arrayBuffer();
        imageData = new Uint8Array(buffer);
        mimeType = contentType;
      } else {
        throw new Error("Unsupported image URL format");
       }

       // Create FormData
       const formData = new FormData();
      const arrayBuffer = imageData.buffer.slice(imageData.byteOffset, imageData.byteOffset + imageData.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: mimeType });
       formData.append("file", blob, filename);

       // Upload to Z.AI (matching Python version headers exactly)
       const uploadResponse = await fetch("https://chat.z.ai/api/v1/files/", {
         method: "POST",
         headers: {
           "Accept": "*/*",
           "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9`,
           "Authorization": `Bearer ${token}`,
           "Cache-Control": "no-cache",
           "Connection": "keep-alive",
           "Content-Type": "multipart/form-data",
           "DNT": "1",
           "Origin": ORIGIN_BASE,
           "Pragma": "no-cache",
           "Referer": chatId ? `${ORIGIN_BASE}/c/${chatId}` : `${ORIGIN_BASE}/`,
           "Sec-Ch-Ua": '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
           "Sec-Ch-Ua-Mobile": "?0",
           "Sec-Ch-Ua-Platform": '"Windows"',
           "Sec-Fetch-Dest": "empty",
           "Sec-Fetch-Mode": "cors",
           "Sec-Fetch-Site": "same-origin",
           "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
           "X-Fe-Version": X_FE_VERSION,
         },
         body: formData,
       });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json() as { id: string; filename?: string; url: string };
       debugLog("Image upload successful: %s", uploadResult.id);

      // Return file structure consistent with Python version exactly
       const _currentTimestamp = Math.floor(Date.now() / 1000);
       return {
         id: uploadResult.id,
         filename: uploadResult.filename || filename,
         size: imageData.length,
         type: mimeType,
         url: uploadResult.url || `/api/v1/files/${uploadResult.id}/content`
       };
    } catch (error) {
       debugLog("Image upload failed: %v", error);
      return null;
    }
  }

   /**
    * Process image content in message, return processed message and uploaded file list
    */
  static async processImages(
    messages: Message[],
    token: string,
    isVisionModel: boolean = false,
    chatId: string = ""
  ): Promise<{ processedMessages: Message[], uploadedFiles: UploadedFile[], uploadedFilesMap: Map<string, UploadedFile> }> {
    const processedMessages: Message[] = [];
    const uploadedFiles: UploadedFile[] = [];
    const uploadedFilesMap = new Map<string, UploadedFile>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const processedMsg: Message = { ...msg };

      if (msg.role === "user" && Array.isArray(msg.content)) {
        const newContent: Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }> = [];

        for (const part of msg.content) {
          if (part.type === "image_url" && part.image_url?.url) {
             const imageUrl = part.image_url.url;

             // Upload image with chatId for proper referer
             const uploadedFile = await this.uploadImage(imageUrl, token, chatId);
             if (uploadedFile) {
               if (isVisionModel) {
                 // GLM-4.5V: Keep in message, but convert URL format (matching Python version exactly)
                 const newUrl = `${uploadedFile.id}_${uploadedFile.filename}`;
                newContent.push({
                  type: "image_url",
                  image_url: { url: newUrl }
                });
                uploadedFilesMap.set(imageUrl, uploadedFile);
                  debugLog("GLM-4.5V image URL converted: %s -> %s", imageUrl.substring(0, 50), newUrl);
               } else {
                 // Non-vision model: Add to file list, remove from message (matching Python version exactly)
                 uploadedFiles.push(uploadedFile);
                 debugLog("Image added to file list: %s", uploadedFile.id);
              }
            } else {
              // Upload failed, add error message
              debugLog("⚠️ Image upload failed");
              newContent.push({
                type: "text",
                text: "[系统提示: 图片上传失败]"
              });
            }
          } else if (part.type === "text") {
            newContent.push(part);
          }
         }

         // If only text content, convert to string format
         if (newContent.length === 1 && newContent[0].type === "text") {
          processedMsg.content = newContent[0].text || "";
        } else if (newContent.length > 0) {
          processedMsg.content = newContent;
        } else {
          processedMsg.content = "";
        }
      }

      processedMessages.push(processedMsg);
    }

    return {
      processedMessages,
      uploadedFiles,
      uploadedFilesMap
    };
  }

   /**
    * Extract text content of the last user message
    */
  static extractLastUserContent(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") {
        const content = msg.content;
        if (typeof content === "string") {
          return content;
        } else if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "text" && part.text) {
              return part.text;
            }
          }
        }
      }
    }
    return "";
  }
}

/**
 * Supported model configuration
 */
interface ModelConfig {
  id: string;           // Model ID as exposed by API
  name: string;         // Display name
  upstreamId: string;   // Upstream Z.ai model ID
  capabilities: {
    vision: boolean;
    mcp: boolean;
    thinking: boolean;
  };
  defaultParams: {
    top_p: number;
    temperature: number;
    max_tokens?: number;
  };
}

const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: "0727-360B-API",
    name: "GLM-4.5",
    upstreamId: "0727-360B-API",
    capabilities: {
      vision: false,
      mcp: true,
      thinking: true
    },
    defaultParams: {
      top_p: 0.95,
      temperature: 0.6,
      max_tokens: 80000
    }
  },
  {
    id: "GLM-4-6-API-V1",
    name: "GLM-4.6",
    upstreamId: "GLM-4-6-API-V1",
    capabilities: {
      vision: false,
      mcp: true,
      thinking: true
    },
    defaultParams: {
      top_p: 0.95,
      temperature: 0.6,
      max_tokens: 195000
    }
  },
  {
    id: "glm-4.5v",
    name: "GLM-4.5V",
    upstreamId: "glm-4.5v",
    capabilities: {
      vision: true,
      mcp: false,
      thinking: true
    },
    defaultParams: {
      top_p: 0.6,
      temperature: 0.8
    }
  }
];

// Default model
const DEFAULT_MODEL = SUPPORTED_MODELS[0];

// Get model configuration by ID
function getModelConfig(modelId: string): ModelConfig {
  // Normalize model ID to handle case differences from various clients
  const normalizedModelId = normalizeModelId(modelId);
  const found = SUPPORTED_MODELS.find(m => m.id === normalizedModelId);

  if (!found) {
    debugLog("⚠️ Model config not found: %s (normalized: %s). Using default: %s", 
      modelId, normalizedModelId, DEFAULT_MODEL.name);
  }

  return found || DEFAULT_MODEL;
}

/**
 * Normalize model ID to handle different client naming formats
 */
function normalizeModelId(modelId: string): string {
  const normalized = modelId.toLowerCase().trim();
 
  const modelMappings: Record<string, string> = {
    'glm-4.5v': 'glm-4.5v',
    'glm4.5v': 'glm-4.5v',
    'glm_4.5v': 'glm-4.5v',
    'gpt-4-vision-preview': 'glm-4.5v',  // backward compatibility
    '0727-360b-api': '0727-360B-API',
    'glm-4.5': '0727-360B-API',
    'glm4.5': '0727-360B-API',
    'glm_4.5': '0727-360B-API',
    'gpt-4': '0727-360B-API',  // backward compatibility
    // GLM-4.6 mappings (from example requests)
    'glm-4.6': 'GLM-4-6-API-V1',
    'glm4.6': 'GLM-4-6-API-V1',
    'glm_4.6': 'GLM-4-6-API-V1',
    'glm-4-6-api-v1': 'GLM-4-6-API-V1',
    'glm-4-6': 'GLM-4-6-API-V1'
  };
 
  const mapped = modelMappings[normalized];
  if (mapped) {
    debugLog("🔄 Model ID mapping: %s → %s", modelId, mapped);
    return mapped;
  }
 
  return normalized;
}

/**
 * Process and validate multimodal messages
 * Supports image, video, document, audio types
 */
function processMessages(messages: Message[], modelConfig: ModelConfig): Message[] {
  const processedMessages: Message[] = [];

  for (const message of messages) {
    const processedMessage: Message = { ...message };

    if (Array.isArray(message.content)) {
      debugLog("Detected multimodal message, blocks: %d", message.content.length);

      const mediaStats = {
        text: 0,
        images: 0,
        videos: 0,
        documents: 0,
        audios: 0,
        others: 0
      };

      if (!modelConfig.capabilities.vision) {
        debugLog("Warning: Model %s does not support multimodal content but received it", modelConfig.name);
        // Keep only text blocks
        const textContent = message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
        processedMessage.content = textContent;
      } else {
        // GLM-4.5V supports full multimodal handling
        for (const block of message.content) {
          switch (block.type) {
            case 'text':
              if (block.text) {
                mediaStats.text++;
                debugLog("📝 Text block length: %d", block.text.length);
              }
              break;

            case 'image_url':
              if (block.image_url?.url) {
                mediaStats.images++;
                const url = block.image_url.url;
                if (url.startsWith('data:image/')) {
                  const mimeMatch = url.match(/data:image\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : 'unknown';
                  debugLog("🖼️ Image data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith('http')) {
                  debugLog("🔗 Image URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown image format: %s", url.substring(0, 50));
                }
              }
              break;

            case 'video_url':
              if (block.video_url?.url) {
                mediaStats.videos++;
                const url = block.video_url.url;
                if (url.startsWith('data:video/')) {
                  const mimeMatch = url.match(/data:video\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : 'unknown';
                  debugLog("🎥 Video data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith('http')) {
                  debugLog("🔗 Video URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown video format: %s", url.substring(0, 50));
                }
              }
              break;

            case 'document_url':
              if (block.document_url?.url) {
                mediaStats.documents++;
                const url = block.document_url.url;
                if (url.startsWith('data:application/')) {
                  const mimeMatch = url.match(/data:application\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : 'unknown';
                  debugLog("📄 Document data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith('http')) {
                  debugLog("🔗 Document URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown document format: %s", url.substring(0, 50));
                }
              }
              break;

            case 'audio_url':
              if (block.audio_url?.url) {
                mediaStats.audios++;
                const url = block.audio_url.url;
                if (url.startsWith('data:audio/')) {
                  const mimeMatch = url.match(/data:audio\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : 'unknown';
                  debugLog("🎵 Audio data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith('http')) {
                  debugLog("🔗 Audio URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown audio format: %s", url.substring(0, 50));
                }
              }
              break;

            default:
              mediaStats.others++;
              debugLog("❓ Unknown block type: %s", block.type);
          }
        }

        const totalMedia = mediaStats.images + mediaStats.videos + mediaStats.documents + mediaStats.audios;
        if (totalMedia > 0) {
          debugLog("🎯 Multimodal stats: text(%d) images(%d) videos(%d) documents(%d) audio(%d)",
            mediaStats.text, mediaStats.images, mediaStats.videos, mediaStats.documents, mediaStats.audios);
        }
      }
    } else if (typeof message.content === 'string') {
      debugLog("📝 Plain text message, length: %d", message.content.length);
    }

    processedMessages.push(processedMessage);
  }

  return processedMessages;
 }

 /**
  * Global state
  */

let stats: RequestStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequestTime: new Date(),
  averageResponseTime: 0
};

let liveRequests: LiveRequest[] = [];

/**
 * Utility functions
 */

function debugLog(format: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log(`[DEBUG] ${format}`, ...args);
  }
}

function recordRequestStats(startTime: number, _path: string, status: number): void {
  const duration = Date.now() - startTime;

  stats.totalRequests++;
  stats.lastRequestTime = new Date();

  if (status >= 200 && status < 300) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
  }

  if (stats.totalRequests > 0) {
    const totalDuration = stats.averageResponseTime * (stats.totalRequests - 1) + duration;
    stats.averageResponseTime = totalDuration / stats.totalRequests;
  } else {
    stats.averageResponseTime = duration;
  }
}

function addLiveRequest(method: string, path: string, status: number, duration: number, userAgent: string, model?: string): void {
  const request: LiveRequest = {
    id: Date.now().toString(),
    timestamp: new Date(),
    method,
    path,
    status,
    duration,
    userAgent,
    model
  };

  liveRequests.push(request);

  if (liveRequests.length > 100) {
    liveRequests = liveRequests.slice(1);
  }
}

function getLiveRequestsData(): string {
  try {
    if (!Array.isArray(liveRequests)) {
      debugLog("liveRequests is not an array, resetting to []");
      liveRequests = [];
    }

    const requestData = liveRequests.map(req => ({
      id: req.id || "",
      timestamp: req.timestamp || new Date(),
      method: req.method || "",
      path: req.path || "",
      status: req.status || 0,
      duration: req.duration || 0,
      user_agent: req.userAgent || ""
    }));

    return JSON.stringify(requestData);
  } catch (error) {
    debugLog("Failed to get live requests data: %v", error);
    return JSON.stringify([]);
  }
}

function getStatsData(): string {
  try {
    if (!stats) {
      debugLog("stats object missing, using defaults");
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequestTime: new Date(),
        averageResponseTime: 0
      };
    }

    const statsData = {
      totalRequests: stats.totalRequests || 0,
      successfulRequests: stats.successfulRequests || 0,
      failedRequests: stats.failedRequests || 0,
      averageResponseTime: stats.averageResponseTime || 0
    };

    return JSON.stringify(statsData);
  } catch (error) {
    debugLog("Failed to get stats data: %v", error);
    return JSON.stringify({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    });
  }
}

function _getClientIP(request: Request): string {
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const ips = xff.split(",");
    if (ips.length > 0) {
      return ips[0].trim();
    }
  }

  const xri = request.headers.get("X-Real-IP");
  if (xri) {
    return xri;
  }

  // For Deno Deploy we can't read remoteAddr; return unknown
  return "unknown";
}

function setCORSHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");
}

function validateApiKey(authHeader: string | null): boolean {
  // Accept a valid Bearer token if present.
  // Backwards-compatible: allow DEFAULT_KEY, configured ZAI_TOKEN, or any JWT-like/long token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
 
  const apiKey = authHeader.substring(7);
  if (apiKey === DEFAULT_KEY) return true;
  if (ZAI_TOKEN && apiKey === ZAI_TOKEN) return true;
  // Accept typical JWTs (three parts separated by '.') or long opaque tokens seen in captures
  if (apiKey.split('.').length === 3) return true;
  if (apiKey.length > 30) return true;
  return false;
}

async function getAnonymousToken(): Promise<string> {
   // Retry logic matching Python version exactly
   const maxRetries = 3;
   let retryCount = 0;

   while (retryCount < maxRetries) {
     try {
       debugLog("Attempting to get anonymous token (attempt %d/%d)", retryCount + 1, maxRetries);

       // Generate dynamic headers for each request (matching Python version exactly)
       const dynamicHeaders = await SmartHeaderGenerator.generateHeaders();

       const response = await fetch(`${ORIGIN_BASE}/api/v1/auths/`, {
         method: "GET",
         headers: {
           ...dynamicHeaders,
           "Accept": "*/*",
           "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9`,
         }
       });

       debugLog("Anonymous token response status: %d", response.status);

       if (response.status === 200) {
         const data = await response.json() as { token: string; email?: string; role?: string };
         if (data.token) {
           // Check if it's a guest token (matching Python version exactly)
           const email = data.email || "";
           const role = data.role || "";
           const isGuest = email.includes("@guest.com") || email.includes("Guest-") || role === "guest";
           const tokenType = isGuest ? "guest" : "authenticated";
           debugLog("✅ Anonymous token obtained successfully (%s): %s...", tokenType, data.token.substring(0, 20));
           return data.token;
         } else {
           debugLog("⚠️ Response missing token field: %o", data);
         }
       } else if (response.status === 405) {
         debugLog("🚫 Request blocked by WAF (status 405), may be due to abnormal headers");
         break; // Don't retry on WAF blocks (matching Python version)
       } else {
         debugLog("HTTP request failed with status: %d", response.status);
         try {
           const errorData = await response.json();
           debugLog("Error response: %o", errorData);
         } catch {
           debugLog("Error response text: %s", await response.text());
         }
       }
     } catch (error) {
       debugLog("Request failed (attempt %d): %v", retryCount + 1, error);
     }

     retryCount++;
     if (retryCount < maxRetries) {
       debugLog("Waiting 2 seconds before retry...");
       await new Promise(resolve => setTimeout(resolve, 2000));
     }
   }

   throw new Error("Failed to obtain anonymous token after 3 attempts");
 }

/**
 * Generate Z.ai API request signature (Updated signature algorithm matching Python version)
 * @param e "requestId,request_id,timestamp,timestamp,user_id,user_id"
 * @param t User's latest message
 * @param timestamp Timestamp (milliseconds)
 * @returns { signature: string, timestamp: string }
 */
async function generateSignature(e: string, t: string, timestamp: number): Promise<{ signature: string, timestamp: string }> {
   const timestampStr = String(timestamp);

   // 1. Base64 encode the message content (matching Python implementation exactly)
   const bodyEncoded = new TextEncoder().encode(t);
   const bodyBase64 = btoa(String.fromCharCode(...bodyEncoded));

   // 2. Construct the string to sign (matching Python implementation exactly)
   const stringToSign = `${e}|${bodyBase64}|${timestampStr}`;

   // 3. Calculate 5-minute time window (matching Python implementation exactly)
   const timeWindow = Math.floor(timestamp / (5 * 60 * 1000));

   // 4. Get signing key (matching Python implementation exactly)
   const secretEnv = Deno.env.get("ZAI_SIGNING_SECRET");
   let rootKey: Uint8Array;

   if (secretEnv) {
     // Read key from environment variable
     if (/^[0-9a-fA-F]+$/.test(secretEnv) && secretEnv.length % 2 === 0) {
       // HEX format
       rootKey = new Uint8Array(secretEnv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
     } else {
       // UTF-8 format
       rootKey = new TextEncoder().encode(secretEnv);
     }
     debugLog("Using environment variable key: %s", secretEnv.substring(0, 10) + "...");
   } else {
     // Use Python version default key exactly
     const defaultKey = "key-@@@@)))()((9))-xxxx&&&%%%%%";
     rootKey = new TextEncoder().encode(defaultKey);
     debugLog("Using Python version default key");
   }

   // 5. First layer HMAC, generate intermediate key (matching Python implementation exactly)
   const firstHmacKey = await crypto.subtle.importKey(
     "raw",
     new Uint8Array(rootKey),
     { name: "HMAC", hash: "SHA-256" },
     false,
     ["sign"]
   );
   const firstSignatureBuffer = await crypto.subtle.sign(
     "HMAC",
     firstHmacKey,
     new TextEncoder().encode(String(timeWindow))
   );
   const intermediateKey = Array.from(new Uint8Array(firstSignatureBuffer))
     .map((b) => b.toString(16).padStart(2, "0"))
     .join("");

   // 6. Second layer HMAC, generate final signature (matching Python implementation exactly)
   const secondKeyMaterial = new TextEncoder().encode(intermediateKey);
   const secondHmacKey = await crypto.subtle.importKey(
     "raw",
     secondKeyMaterial,
     { name: "HMAC", hash: "SHA-256" },
     false,
     ["sign"]
   );
   const finalSignatureBuffer = await crypto.subtle.sign(
     "HMAC",
     secondHmacKey,
     new TextEncoder().encode(stringToSign)
   );
   const signature = Array.from(new Uint8Array(finalSignatureBuffer))
     .map((b) => b.toString(16).padStart(2, "0"))
     .join("");

   debugLog("Python version signature generated successfully: %s", signature);
   return {
     signature,
     timestamp: timestampStr,
   };
 }

async function callUpstreamWithHeaders(
  upstreamReq: UpstreamRequest,
  refererChatID: string,
  authToken: string
): Promise<Response> {
  try {
      debugLog("Call upstream API (Python version): %s", UPSTREAM_URL);

     // 1. Decode JWT to get user_id (multi-field support, consistent with Python version)
     let userId = "guest";
     try {
       const tokenParts = authToken.split(".");
       if (tokenParts.length === 3) {
         const payload = JSON.parse(
           new TextDecoder().decode(decodeBase64(tokenParts[1]))
         );

         // Try multiple possible user_id fields (consistent with Python version)
         for (const key of ["id", "user_id", "uid", "sub"]) {
           const val = payload[key];
           if (typeof val === "string" || typeof val === "number") {
             const strVal = String(val);
             if (strVal.length > 0) {
               userId = strVal;
               debugLog("Parsed user_id from JWT: %s (field: %s)", userId, key);
               break;
             }
           }
         }
       }
     } catch (e) {
       debugLog("Failed to parse JWT: %v", e);
     }

     // 2. Prepare parameters needed for signature (matching Python version)
     const timestamp = Date.now();
     const requestId = crypto.randomUUID();
     const lastMessageContent = ImageProcessor.extractLastUserContent(upstreamReq.messages);

     if (!lastMessageContent) {
        throw new Error("Cannot get user message content for signature");
     }

     const e = `requestId,${requestId},timestamp,${timestamp},user_id,${userId}`;

     // 3. Generate signature (matching Python version)
     const { signature } = await generateSignature(
      e,
      lastMessageContent,
      timestamp
    );
     debugLog("Generate Python version signature: %s", signature);

    // 4. Build request body (matching Python version structure)
    const reqBody = JSON.stringify(upstreamReq);
    debugLog("Upstream request body: %s", reqBody);

    // 5. Generate smart browser headers (matching Python version)
    const smartHeaders = await SmartHeaderGenerator.generateHeaders(refererChatID);

    // 6. Build query parameters (matching Python version)
    const queryParams = {
      "timestamp": timestamp.toString(),
      "requestId": requestId,
      "user_id": userId,
      "version": "0.0.1",
      "platform": "web",
      "token": authToken,
      "current_url": refererChatID ? `${ORIGIN_BASE}/c/${refererChatID}` : ORIGIN_BASE,
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

    // 7. Merge headers (matching Python version)
    const finalHeaders = {
      ...smartHeaders,
      "Authorization": `Bearer ${authToken}`,
      "X-Signature": signature,
      "Accept": "application/json, text/event-stream",
    };

    debugLog("Python version request details:");
    debugLog("  URL: %s", fullURL);
    debugLog("  Headers: Authorization=Bearer *****, X-Signature=%s", signature.substring(0, 16));

    const response = await fetch(fullURL, {
      method: "POST",
      headers: finalHeaders,
      body: reqBody,
    });

    debugLog("Upstream response status: %d %s", response.status, response.statusText);

    // 8. Mark token as valid on success
    tokenPool.markSuccess(authToken);

    return response;
   } catch (error) {
      debugLog("Failed to call upstream: %v", error);

     // Try switching token on failure
     try {
      const newToken = tokenPool.switchToNext();
       if (newToken) {
          debugLog("Switch to new token retry: %s", newToken.substring(0, 20));
         // Retry recursively once, avoid infinite loop
         return callUpstreamWithHeaders(upstreamReq, refererChatID, newToken);
      }
    } catch (retryError) {
       debugLog("Token switch retry failed: %v", retryError);
    }

    throw error;
   }
 }

/**
 * Transforms thinking content based on the specified mode.
 * Returns either a string (for "strip", "thinking", "think", "raw" modes) or an object with reasoning and content (for "separate" mode).
 * @param {string} content - The content to transform, containing thinking tags.
 * @param {"strip" | "thinking" | "think" | "raw" | "separate"} [mode=THINK_TAGS_MODE] - The transformation mode.
 * @returns {string | { reasoning: string; content: string }} The transformed content.
 */
export function transformThinking(content: string, mode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as "strip" | "thinking" | "think" | "raw" | "separate"): string | { reasoning: string; content: string } {

  // Raw mode: return as-is
  if (mode === "raw") {
    return content;
  }

  // Separate mode: extract reasoning and content separately
  if (mode === "separate") {
    let reasoning = "";
    let finalContent = "";

    // Try standard regex first (for complete <details> tags)
    const detailsMatch = content.match(/<details[^>]*>(.*?)<\/details>/gs);

    if (detailsMatch) {
      // Process reasoning content
      reasoning = detailsMatch.join("\n");

      // Remove <summary>...</summary>
      reasoning = reasoning.replace(/<summary>.*?<\/summary>/gs, "");

      // Remove <details> tags
      reasoning = reasoning.replace(/<details[^>]*>/g, "");
      reasoning = reasoning.replace(/<\/details>/g, "");

      // Handle line prefix "> " (using multiline flag)
      reasoning = reasoning.replace(/^> /gm, "");

      reasoning = reasoning.trim();

      // Extract final content (everything outside <details> tags)
      finalContent = content.replace(/<details[^>]*>.*?<\/details>/gs, "").trim();
    } else if (content.includes("</details>")) {
      // Handle partial edit_content (starts mid-tag)
      // Split by </details> to separate reasoning from content
      const parts = content.split("</details>");

      reasoning = parts[0];
      finalContent = parts.slice(1).join("</details>").trim();

      // Remove <summary>...</summary>
      reasoning = reasoning.replace(/<summary>.*?<\/summary>/gs, "");

      // Remove any partial opening tags at the start (e.g., 'true" duration="5"...')
      reasoning = reasoning.replace(/^[^>]*>/, "");

      // Handle line prefix "> "
      reasoning = reasoning.replace(/^> /gm, "");

      reasoning = reasoning.trim();

      debugLog("Separate mode - extracted reasoning length: %d, content length: %d", reasoning.length, finalContent.length);
      debugLog("Separate mode - content preview: %s", finalContent.substring(0, 50));
    } else {
      // No details tags, treat all as final content
      finalContent = content;
    }

    return { reasoning, content: finalContent };
  }

  // For "strip", "thinking", and "think" modes, process as string
  let result = content;

  // Handle complete <details> tags first
  if (content.match(/<details[^>]*>.*?<\/details>/gs)) {
    switch (mode) {
      case "thinking":
        // Convert <details> to <thinking>, preserve content structure
        result = result.replace(/<details[^>]*>/g, "<thinking>");
        result = result.replace(/<\/details>/g, "</thinking>");
        break;
      case "think":
        // Convert <details> to <think>, preserve content structure
        result = result.replace(/<details[^>]*>/g, "<think>");
        result = result.replace(/<\/details>/g, "</think>");
        break;
      case "strip":
        // Remove <details> tags but keep content
        result = result.replace(/<details[^>]*>/g, "");
        result = result.replace(/<\/details>/g, "");
        break;
    }
  } else if (content.includes("</details>")) {
    // Handle partial edit_content
    const parts = content.split("</details>");
    let thinkingPart = parts[0];
    const contentPart = parts.slice(1).join("</details>");

    // Remove partial opening tag
    thinkingPart = thinkingPart.replace(/^[^>]*>/, "");

    switch (mode) {
      case "thinking":
        result = "<thinking>" + thinkingPart + "</thinking>" + contentPart;
        break;
      case "think":
        result = "<think>" + thinkingPart + "</think>" + contentPart;
        break;
      case "strip":
        result = thinkingPart + contentPart;
        break;
    }
  }

  // Remove <summary>...</summary> tags
  result = result.replace(/<summary>.*?<\/summary>/gs, "");

  // Clean up other custom tags
  result = result.replace(/<Full>/g, "");
  result = result.replace(/<\/Full>/g, "");

  // Handle line prefix "> " (using multiline flag for proper matching)
  result = result.replace(/^> /gm, "");

  // Clean up extra whitespace but preserve paragraph structure
  result = result.replace(/\n\s*\n\s*\n/g, "\n\n"); // Multiple newlines to double newlines
  result = result.trim();

  return result;
}

/**
 * Processes the upstream stream response, transforming thinking content and writing to the client stream.
 * @param {ReadableStream<Uint8Array>} body - The upstream response body stream.
 * @param {WritableStreamDefaultWriter<Uint8Array>} writer - The writer for the client response stream.
 * @param {TextEncoder} encoder - Encoder for writing data.
 * @param {string} modelName - The name of the model.
 * @param {"strip" | "thinking" | "think" | "raw" | "separate"} [thinkTagsMode=THINK_TAGS_MODE] - Mode for handling thinking tags.
 * @returns {Promise<Usage | null>} The usage statistics if available.
 */
async function processUpstreamStream(
  body: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  modelName: string,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as "strip" | "thinking" | "think" | "raw" | "separate"
): Promise<Usage | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalUsage: Usage | null = null;

  // For "separate" mode, accumulate thinking content
  let accumulatedThinking = "";
  let thinkingSent = false;

  // Track thinking phase state for incremental streaming
  let inThinkingPhase = false;
  let thinkingTagOpened = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ""; // keep last partial line

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6);
          if (dataStr === "") continue;

          debugLog("Received SSE data: %s", dataStr);

          try {
            const upstreamData = JSON.parse(dataStr) as UpstreamData;

            // Error detection
            if (upstreamData.error || upstreamData.data.error ||
                (upstreamData.data.inner && upstreamData.data.inner.error)) {
              const errObj = upstreamData.error || upstreamData.data.error ||
                           (upstreamData.data.inner && upstreamData.data.inner.error);
              debugLog("Upstream error: code=%d, detail=%s", errObj?.code, errObj?.detail);

              const errorDetail = (errObj?.detail || "").toLowerCase();
              if (errorDetail.includes("something went wrong") || errorDetail.includes("try again later")) {
                debugLog("🚨 Z.ai server error analysis:");
                debugLog("   📋 Detail: %s", errObj?.detail);
                debugLog("   🖼️ Possible cause: image processing failure");
                debugLog("   💡 Suggested fixes:");
                debugLog("      1. Use smaller images (< 500KB)");
                debugLog("      2. Try different formats (JPEG over PNG)");
                debugLog("      3. Retry later (server load issue)");
                debugLog("      4. Check for corrupted images");
              }

              // Send end chunk
              const endChunk: OpenAIResponse = {
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: modelName,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: "stop"
                  }
                ]
              };

              await writer.write(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`));
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              return finalUsage;
            }

            debugLog("Parsed upstream - type: %s, phase: %s, content length: %d, done: %v",
              upstreamData.type, upstreamData.data.phase,
              upstreamData.data.delta_content ? upstreamData.data.delta_content.length : 0,
              upstreamData.data.done);

            // Capture usage information if present
            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              debugLog("Captured usage data: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens, finalUsage.completion_tokens, finalUsage.total_tokens);
            }

            // Handle edit_content (complete thinking block sent when phase changes)
            if (upstreamData.data.edit_content && !thinkingSent) {
              debugLog("Received edit_content with complete thinking block, length: %d", upstreamData.data.edit_content.length);
              debugLog("Current mode: %s, thinkingSent: %s", THINK_TAGS_MODE, thinkingSent);

              if (thinkTagsMode === "separate") {
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                if (typeof transformed === "object" && transformed.reasoning) {
                  debugLog("Sending reasoning from edit_content, length: %d", transformed.reasoning.length);

                  // Send reasoning as a separate field
                  const reasoningChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { reasoning_content: transformed.reasoning }
                      }
                    ]
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(reasoningChunk)}\n\n`));
                  thinkingSent = true;
                }
              } else {
                // For other modes, we're now streaming incrementally via delta_content
                // So we skip edit_content to avoid duplication
                debugLog("Skipping edit_content as we're streaming incrementally via delta_content");
                thinkingSent = true; // Mark as sent to avoid processing it again
              }
            }

            // Handle content
            if (upstreamData.data.delta_content && upstreamData.data.delta_content !== "") {
              const rawContent = upstreamData.data.delta_content;
              const isThinking = upstreamData.data.phase === "thinking";

              if (thinkTagsMode === "separate") {
                // In separate mode, accumulate thinking content
                if (isThinking) {
                  accumulatedThinking += rawContent;

                  // Check if thinking block is complete (contains closing </details>)
                  if (accumulatedThinking.includes("</details>") && !thinkingSent) {
                    const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
                    if (typeof transformed === "object" && transformed.reasoning) {
                      debugLog("Sending accumulated reasoning content, length: %d", transformed.reasoning.length);

                      // Send reasoning as a separate field
                      const reasoningChunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { reasoning_content: transformed.reasoning }
                          }
                        ]
                      };

                      await writer.write(encoder.encode(`data: ${JSON.stringify(reasoningChunk)}\n\n`));
                      thinkingSent = true;
                    }
                  }
                } else {
                  // Regular content
                  debugLog("Sending regular content: %s", rawContent);

                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { content: rawContent }
                      }
                    ]
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } else {
                // Other modes: stream thinking content incrementally
                if (isThinking) {
                  // Send opening tag when entering thinking phase
                  if (!inThinkingPhase) {
                    inThinkingPhase = true;
                    let openingTag = "";

                    switch (thinkTagsMode) {
                      case "thinking":
                        openingTag = "<thinking>";
                        break;
                      case "think":
                        openingTag = "<think>";
                        break;
                      case "strip":
                        openingTag = ""; // No tag for strip mode
                        break;
                      case "raw":
                        openingTag = ""; // Will be included in rawContent
                        break;
                    }

                    if (openingTag) {
                      debugLog("Sending opening thinking tag: %s", openingTag);
                      const chunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { content: openingTag }
                          }
                        ]
                      };
                      await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                      thinkingTagOpened = true;
                    }
                  }

                  // Process and stream the thinking content chunk
                  let processedChunk = rawContent;

                  // Clean up the content based on mode
                  if (thinkTagsMode !== "raw") {
                    // Remove <details> tags, <summary> tags, and "> " prefixes
                    processedChunk = processedChunk.replace(/<details[^>]*>/g, "");
                    processedChunk = processedChunk.replace(/<\/details>/g, "");
                    processedChunk = processedChunk.replace(/<summary>.*?<\/summary>/gs, "");
                    processedChunk = processedChunk.replace(/^> /gm, "");
                  }

                  if (processedChunk) {
                    debugLog("Streaming thinking chunk, length: %d", processedChunk.length);

                    const chunk: OpenAIResponse = {
                      id: `chatcmpl-${Date.now()}`,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: modelName,
                      choices: [
                        {
                          index: 0,
                          delta: { content: processedChunk }
                        }
                      ]
                    };

                    await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                } else {
                  // Exiting thinking phase - send closing tag if needed
                  if (inThinkingPhase && thinkingTagOpened) {
                    let closingTag = "";

                    switch (thinkTagsMode) {
                      case "thinking":
                        closingTag = "</thinking>";
                        break;
                      case "think":
                        closingTag = "</think>";
                        break;
                    }

                    if (closingTag) {
                      debugLog("Sending closing thinking tag: %s", closingTag);
                      const chunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { content: closingTag }
                          }
                        ]
                      };
                      await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    }

                    inThinkingPhase = false;
                    thinkingTagOpened = false;
                  }

                  // Regular content (non-thinking)
                  debugLog("Sending regular content: %s", rawContent);

                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { content: rawContent }
                      }
                    ]
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
            }

            // Check for done
            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              debugLog("Detected stream end signal");

              // Send final chunk with usage if available
              const endChunk: OpenAIResponse = {
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: modelName,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: "stop"
                  }
                ],
                usage: finalUsage || undefined
              };

              await writer.write(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`));
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              return finalUsage;
            }
          } catch (error) {
            debugLog("Failed to parse SSE data: %v", error);
          }
        }
      }
    }
  } finally {
    writer.close();
  }
  
  return finalUsage;
}

// Collect full response for non-streaming mode
async function collectFullResponse(
  body: ReadableStream<Uint8Array>,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as "strip" | "thinking" | "think" | "raw" | "separate"
): Promise<{content: string, reasoning_content?: string, usage: Usage | null}> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let fullReasoning = "";
  let accumulatedThinking = "";
  let finalUsage: Usage | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6);
          if (dataStr === "") continue;

          try {
            const upstreamData = JSON.parse(dataStr) as UpstreamData;

            // Capture usage information if present
            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              debugLog("Captured usage data in non-streaming: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens, finalUsage.completion_tokens, finalUsage.total_tokens);
            }

            // Handle edit_content (complete thinking block)
            if (upstreamData.data.edit_content) {
              debugLog("Received edit_content in non-streaming, length: %d", upstreamData.data.edit_content.length);

              if (thinkTagsMode === "separate") {
                // For separate mode, extract reasoning and content separately
                if (!fullReasoning) {
                  const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                  if (typeof transformed === "object") {
                    fullReasoning = transformed.reasoning;
                    debugLog("Extracted reasoning from edit_content, length: %d", fullReasoning.length);

                    // Also add the content part from edit_content to fullContent
                    if (transformed.content && transformed.content.trim() !== "") {
                      fullContent += transformed.content || "";
                      debugLog("Added content part from edit_content, length: %d", (transformed.content || "").length);
                    }
                  }
                }
              } else {
                // For other modes, process the thinking content and add to fullContent
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                const processedContent = typeof transformed === "string" ? transformed : transformed.content;

                if (processedContent && processedContent.trim() !== "") {
                  fullContent += processedContent || "";
                  debugLog("Added processed edit_content to fullContent, length: %d", (processedContent || "").length);
                }
              }
            }

            if (upstreamData.data.delta_content && upstreamData.data.delta_content !== "") {
              const rawContent = upstreamData.data.delta_content || "";
              const isThinking = upstreamData.data.phase === "thinking";

              if (thinkTagsMode === "separate") {
                if (isThinking) {
                  accumulatedThinking += rawContent;
                } else {
                  fullContent += rawContent;
                }
              } else {
                // For non-separate modes, only process non-thinking content
                // Thinking content is handled by edit_content
                if (!isThinking) {
                  fullContent += rawContent;
                }
              }
            }

            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              debugLog("Detected completion signal, stopping collection");


              // Process accumulated thinking if in separate mode (only if not already set from edit_content)
              if (thinkTagsMode === "separate" && accumulatedThinking && !fullReasoning) {
                const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
                if (typeof transformed === "object") {
                  fullReasoning = transformed.reasoning;
                  debugLog("Set fullReasoning from accumulated thinking, length: %d", fullReasoning.length);
                }
              }

              debugLog("collectFullResponse early return - content length: %d, reasoning length: %d",
                fullContent.length, fullReasoning ? fullReasoning.length : 0);

              return {
                content: fullContent,
                reasoning_content: fullReasoning || undefined,
                usage: finalUsage
              };
            }
          } catch (_error) {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Process accumulated thinking if in separate mode
  if (thinkTagsMode === "separate" && accumulatedThinking) {
    const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
    if (typeof transformed === "object") {
      fullReasoning = transformed.reasoning;
    }
  }

  debugLog("collectFullResponse returning - content length: %d, reasoning length: %d",
    fullContent.length, fullReasoning ? fullReasoning.length : 0);

  return {
    content: fullContent,
    reasoning_content: fullReasoning || undefined,
    usage: finalUsage
  };
}

/**
 * Anthropic API handlers
 */

function handleAnthropicModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = getClaudeModels();
  
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ data: models }), {
    status: 200,
    headers
  });
}

async function handleAnthropicMessages(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received Anthropic messages request");
  debugLog("🌐 User-Agent: %s", userAgent);

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // API key validation
  const authHeader = request.headers.get("Authorization") || request.headers.get("x-api-key");
  if (!authHeader || (!authHeader.startsWith("Bearer ") && !authHeader.startsWith("sk-"))) {
    debugLog("Missing or invalid Authorization header for Anthropic API");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(request.method, path, 401, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "authentication_error",
        message: "Missing or invalid API key"
      }
    }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  if (!validateApiKey(`Bearer ${apiKey}`)) {
    debugLog("Invalid API key for Anthropic request");
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 401);
    addLiveRequest(request.method, path, 401, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "authentication_error",
        message: "Invalid API key"
      }
    }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  debugLog("Anthropic API key validated");

  // Read request body
  let body: string;
  try {
    body = await request.text();
    debugLog("📥 Received Anthropic body length: %d chars", body.length);
  } catch (error) {
    debugLog("Failed to read Anthropic request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Failed to read request body"
      }
    }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  // Parse JSON
  let anthropicReq: AnthropicMessagesRequest;
  try {
    anthropicReq = JSON.parse(body) as AnthropicMessagesRequest;
    debugLog("✅ Anthropic JSON parsed successfully");
  } catch (error) {
    debugLog("Anthropic JSON parse failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Invalid JSON"
      }
    }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  debugLog("🤖 Anthropic request parsed - model: %s, stream: %v, messages: %d", 
    anthropicReq.model, anthropicReq.stream, anthropicReq.messages.length);

  // Convert Anthropic request to OpenAI format
  const openaiReq = convertAnthropicToOpenAI(anthropicReq);
  debugLog("🔄 Converted to OpenAI format - model: %s", openaiReq.model);

  // Get model configuration for the mapped Z.ai model
  const modelConfig = getModelConfig(openaiReq.model);
   debugLog("📋 Using model config: %s (%s)", modelConfig.name, modelConfig.upstreamId);
 
   // Get token using token pool
   let authToken: string;
   try {
     authToken = await tokenPool.getToken();
     debugLog("Token obtained successfully: %s...", authToken.substring(0, 10));
   } catch (error) {
     debugLog("Token acquisition failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 500);
    addLiveRequest(request.method, path, 500, duration, userAgent);
    return new Response("Failed to get authentication token", {
      status: 500,
      headers,
    });
  }

  // Generate session IDs
  const chatID = `anthropic-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const msgID = Date.now().toString();

  // Build upstream request (similar to OpenAI chat completions)
  const upstreamReq = {
    stream: true, // always fetch upstream as stream
    chat_id: chatID,
    id: msgID,
    model: modelConfig.upstreamId,
    messages: openaiReq.messages,
    params: {
      ...modelConfig.defaultParams,
      max_tokens: anthropicReq.max_tokens
    },
    features: {
      enable_thinking: modelConfig.capabilities.thinking,
      image_generation: false,
      web_search: false,
      auto_web_search: false,
      preview_mode: modelConfig.capabilities.vision
    },
    background_tasks: {
      title_generation: false,
      tags_generation: false
    },
    mcp_servers: modelConfig.capabilities.mcp ? [] : undefined,
    model_item: {
      id: modelConfig.upstreamId,
      name: modelConfig.name,
      owned_by: "anthropic",
      openai: {
        id: modelConfig.upstreamId,
        name: modelConfig.upstreamId,
        owned_by: "anthropic"
      }
    },
    tool_servers: [],
    variables: {
      "{{USER_NAME}}": `Guest-${Date.now()}`,
      "{{CURRENT_DATETIME}}": new Date().toLocaleString(DEFAULT_LANGUAGE)
    }
  };

  // Call upstream
  try {
    if (anthropicReq.stream) {
      return await handleAnthropicStreamResponse(upstreamReq, chatID, msgID, authToken, startTime, path, userAgent, anthropicReq, modelConfig);
    } else {
      return await handleAnthropicNonStreamResponse(upstreamReq, chatID, msgID, authToken, startTime, path, userAgent, anthropicReq, modelConfig);
    }
  } catch (error) {
    debugLog("Anthropic upstream call failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest(request.method, path, 502, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "api_error",
        message: "Failed to call upstream"
      }
    }), {
      status: 502,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
}

async function handleAnthropicStreamResponse(
  upstreamReq: UpstreamRequest,
  chatID: string,
  msgID: string,
  authToken: string,
  startTime: number,
  path: string,
  userAgent: string,
  req: AnthropicMessagesRequest,
  modelConfig: ModelConfig
): Promise<Response> {
  debugLog("Starting Anthropic stream response (chat_id=%s)", chatID);

  try {
    const response = await callUpstreamWithHeaders(upstreamReq, chatID, authToken);

    if (!response.ok) {
      debugLog("Upstream returned error status for Anthropic: %d", response.status);
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response(JSON.stringify({
        type: "error",
        error: {
          type: "api_error",
          message: "Upstream error"
        }
      }), { 
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!response.body) {
      debugLog("Upstream response body is empty for Anthropic");
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response(JSON.stringify({
        type: "error",
        error: {
          type: "api_error",
          message: "Upstream response body is empty"
        }
      }), { 
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Process upstream SSE stream and convert to Anthropic format
    (async () => {
      try {
        if (response.body) {
          for await (const chunk of processAnthropicStream(response.body, req.model, msgID)) {
            await writer.write(new TextEncoder().encode(chunk));
          }
        }
      } catch (error: unknown) {
        debugLog("Error in Anthropic stream processing: %v", error);
      } finally {
        await writer.close();
      }
    })().catch((error: unknown) => {
      debugLog("Error while processing Anthropic upstream stream: %v", error);
    });

    // Record stats
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 200);
    addLiveRequest("POST", path, 200, duration, userAgent, modelConfig.name);

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
        "Access-Control-Allow-Credentials": "true"
      }
    });
  } catch (error) {
    debugLog("Error handling Anthropic stream response: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest("POST", path, 502, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "api_error",
        message: "Failed to process stream response"
      }
    }), { 
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleAnthropicNonStreamResponse(
  upstreamReq: UpstreamRequest,
  chatID: string,
  msgID: string,
  authToken: string,
  startTime: number,
  path: string,
  userAgent: string,
  req: AnthropicMessagesRequest,
  modelConfig: ModelConfig
): Promise<Response> {
  debugLog("Starting Anthropic non-stream response (chat_id=%s)", chatID);

  try {
    const response = await callUpstreamWithHeaders(upstreamReq, chatID, authToken);

    if (!response.ok) {
      debugLog("Upstream returned error status for Anthropic non-stream: %d", response.status);
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response(JSON.stringify({
        type: "error",
        error: {
          type: "api_error",
          message: "Upstream error"
        }
      }), { 
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!response.body) {
      debugLog("Upstream response body is empty for Anthropic non-stream");
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response(JSON.stringify({
        type: "error",
        error: {
          type: "api_error",
          message: "Upstream response body is empty"
        }
      }), { 
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Collect the full response from the stream
    const { content: finalContent, usage: finalUsage } = await collectFullResponse(response.body, "separate");
    debugLog("Anthropic content collection completed, final length: %d", finalContent.length);

    // Create a mock OpenAI response to convert
    const openaiResponse = {
      id: `msg_${chatID}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelConfig.upstreamId,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: finalContent
        },
        finish_reason: "stop"
      }],
      usage: finalUsage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    // Convert to Anthropic format
    const anthropicResponse = convertOpenAIToAnthropic(openaiResponse, req.model, msgID);

    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 200);
    addLiveRequest("POST", path, 200, duration, userAgent, modelConfig.name);

    return new Response(JSON.stringify(anthropicResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
        "Access-Control-Allow-Credentials": "true"
      }
    });
  } catch (error) {
    debugLog("Error processing Anthropic non-stream response: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest("POST", path, 502, duration, userAgent);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "api_error",
        message: "Failed to process non-stream response"
      }
    }), { 
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleAnthropicTokenCount(request: Request): Promise<Response> {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // API key validation (similar to messages endpoint)
  const authHeader = request.headers.get("Authorization") || request.headers.get("x-api-key");
  if (!authHeader || (!authHeader.startsWith("Bearer ") && !authHeader.startsWith("sk-"))) {
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "authentication_error",
        message: "Missing or invalid API key"
      }
    }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.text();
    const tokenReq: AnthropicTokenCountRequest = JSON.parse(body);
    
    const inputTokens = countTokens(tokenReq);
    
    const response: AnthropicTokenCountResponse = {
      input_tokens: inputTokens
    };

    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify(response), {
      status: 200,
      headers
    });
  } catch (error) {
    debugLog("Token counting failed for Anthropic: %v", error);
    return new Response(JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Failed to count tokens"
      }
    }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
}

/**
 * HTTP server and routing
 */

async function getIndexHTML(): Promise<string> {
  try {
    return await Deno.readTextFile('./ui/index.html');
  } catch (error) {
    console.error('Failed to read index.html:', error);
    return '<h1>UI files not found. Please ensure ui folder exists.</h1>';
  }
}

async function handleIndex(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const html = await getIndexHTML();
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function handleOptions(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  return new Response("Not Found", { status: 404, headers });
}

function handleModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = SUPPORTED_MODELS.map(model => ({
    id: model.name,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "z.ai"
  }));

  const response: ModelsResponse = {
    object: "list",
    data: models
  };

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(response), {
    status: 200,
    headers
  });
}

/**
 * Handles OpenAI-compatible chat completions requests.
 * Processes the request, validates API key, handles image uploads, and proxies to upstream Z.ai API.
 * Supports both streaming and non-streaming responses, with reasoning mode.
 * @param {Request} request - The incoming HTTP request.
 * @returns {Promise<Response>} The response to send back to the client.
 */
async function handleChatCompletions(request: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(request.url);
  const path = url.pathname;
  const userAgent = request.headers.get("User-Agent") || "";

  debugLog("Received chat completions request");
  debugLog("🌐 User-Agent: %s", userAgent);

  // Cherry Studio detection
  const isCherryStudio = userAgent.toLowerCase().includes('cherry') || userAgent.toLowerCase().includes('studio');
  if (isCherryStudio) {
    debugLog("🍒 Detected Cherry Studio client version: %s",
      userAgent.match(/CherryStudio\/([^\s]+)/)?.[1] || 'unknown');
  }

  // Read feature control headers
  // Support both X-Feature-Thinking and X-Thinking for convenience
  const thinkingHeader = request.headers.get("X-Feature-Thinking") || request.headers.get("X-Thinking");
  const webSearchHeader = request.headers.get("X-Feature-Web-Search");
  const autoWebSearchHeader = request.headers.get("X-Feature-Auto-Web-Search");
  const imageGenerationHeader = request.headers.get("X-Feature-Image-Generation");
  const titleGenerationHeader = request.headers.get("X-Feature-Title-Generation");
  const tagsGenerationHeader = request.headers.get("X-Feature-Tags-Generation");
  const mcpHeader = request.headers.get("X-Feature-MCP");

  // Read think tags mode customization header
  const thinkTagsModeHeader = request.headers.get("X-Think-Tags-Mode");

  // Parse header values to boolean (default to model capabilities if not specified)
  const parseBooleanHeader = (headerValue: string | null): boolean | null => {
    if (headerValue === null) return null;
    const normalized = headerValue.toLowerCase().trim();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    return null;
  };

  // Parse think tags mode header with validation
  const parseThinkTagsMode = (headerValue: string | null): "strip" | "thinking" | "think" | "raw" | "separate" => {
    if (headerValue === null) return THINK_TAGS_MODE as "strip" | "thinking" | "think" | "raw" | "separate";

    const validModes = ["strip", "thinking", "think", "raw", "separate"];
    const normalizedValue = headerValue.toLowerCase().trim();
    
    if (validModes.includes(normalizedValue)) {
      return normalizedValue as "strip" | "thinking" | "think" | "raw" | "separate";
    }
    
    debugLog("⚠️ Invalid X-Think-Tags-Mode value: %s. Using default: %s", headerValue, THINK_TAGS_MODE);
    return THINK_TAGS_MODE as "strip" | "thinking" | "think" | "raw" | "separate";
  };

  const currentThinkTagsMode = parseThinkTagsMode(thinkTagsModeHeader);

  debugLog("Feature headers received: Thinking=%s, WebSearch=%s, AutoWebSearch=%s, ImageGen=%s, TitleGen=%s, TagsGen=%s, MCP=%s",
    thinkingHeader, webSearchHeader, autoWebSearchHeader, imageGenerationHeader, titleGenerationHeader, tagsGenerationHeader, mcpHeader);
  debugLog("🎯 Think tags mode: %s (header: %s, default: %s)", currentThinkTagsMode, thinkTagsModeHeader || "not provided", THINK_TAGS_MODE);

  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

   // API key validation
   const authHeader = request.headers.get("Authorization");
   if (authHeader && !validateApiKey(authHeader)) {
     debugLog("Invalid Authorization header");
     const duration = Date.now() - startTime;
     recordRequestStats(startTime, path, 401);
     addLiveRequest(request.method, path, 401, duration, userAgent);
     return new Response("Invalid Authorization header", {
       status: 401,
       headers
     });
   }

   if (!authHeader) {
     debugLog("No Authorization header, using anonymous token");
   } else {
     debugLog("API key validated");
   }

  // Read request body
  let body: string;
  try {
    body = await request.text();
    debugLog("📥 Received body length: %d chars", body.length);

    const bodyPreview = body.length > 1000 ? body.substring(0, 1000) + "..." : body;
    debugLog("📄 Body preview: %s", bodyPreview);
  } catch (error) {
    debugLog("Failed to read request body: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response("Failed to read request body", {
      status: 400,
      headers
    });
  }

  // Parse JSON
  let req: OpenAIRequest;
  let incomingBody: Record<string, unknown> | null = null;
  try {
    incomingBody = JSON.parse(body);
    req = incomingBody as unknown as OpenAIRequest;
    debugLog("✅ JSON parsed successfully");
  } catch (error) {
    debugLog("JSON parse failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 400);
    addLiveRequest(request.method, path, 400, duration, userAgent);
    return new Response("Invalid JSON", {
      status: 400,
      headers
    });
  }

  // If client didn't specify stream parameter, use default
  if (!body.includes('"stream"')) {
    req.stream = DEFAULT_STREAM;
    debugLog("Client did not specify stream parameter; using default: %v", DEFAULT_STREAM);
  }

  const modelConfig = getModelConfig(req.model);
  debugLog("Request parsed - model: %s (%s), stream: %v, messages: %d", req.model, modelConfig.name, req.stream, req.messages.length);

   // Detect model advanced capabilities
  const capabilities = ModelCapabilityDetector.detectCapabilities(
    req.model,
    req.reasoning
  );
     debugLog("Model capability detection: thinking=%s, search=%s, advanced search=%s, vision=%s, MCP=%s",
     capabilities.thinking, capabilities.search, capabilities.advancedSearch,
     capabilities.vision, capabilities.mcp);

  // Cherry Studio debug: inspect each message
  debugLog("🔍 Cherry Studio debug - inspect raw messages:");
  for (let i = 0; i < req.messages.length; i++) {
    const msg = req.messages[i];
    debugLog("  Message[%d] role: %s", i, msg.role);

    if (typeof msg.content === 'string') {
      debugLog("  Message[%d] content: string, length: %d", i, msg.content.length);
      if (msg.content.length === 0) {
        debugLog("  ⚠️  Message[%d] content is empty string!", i);
      } else {
        debugLog("  Message[%d] content preview: %s", i, msg.content.substring(0, 100));
      }
    } else if (Array.isArray(msg.content)) {
      debugLog("  Message[%d] content: array, blocks: %d", i, msg.content.length);
      for (let j = 0; j < msg.content.length; j++) {
        const block = msg.content[j];
        debugLog("    Block[%d] type: %s", j, block.type);
        if (block.type === 'text' && block.text) {
          debugLog("    Block[%d] text: %s", j, block.text.substring(0, 50));
        } else if (block.type === 'image_url' && block.image_url?.url) {
          debugLog("    Block[%d] image_url: %s format, length: %d", j,
            block.image_url.url.startsWith('data:') ? 'base64' : 'url',
            block.image_url.url.length);
        }
      }
    } else {
      debugLog("  ⚠️  Message[%d] content type unexpected: %s", i, typeof msg.content);
    }
  }

  // Get token using token pool (moved here to be available for image processing)
  let authToken: string;
  try {
    authToken = await tokenPool.getToken();
    debugLog("Token obtained successfully: %s...", authToken.substring(0, 10));
  } catch (error) {
    debugLog("Token acquisition failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 500);
    addLiveRequest(request.method, path, 500, duration, userAgent);
    return new Response("Failed to obtain authentication token", {
      status: 500,
      headers,
    });
  }

  // Process and validate messages (multimodal handling)
  const processedMessages = processMessages(req.messages, modelConfig);
   debugLog("Messages processed, count after processing: %d", processedMessages.length);

   // Check if contains multimodal content and use new image processor
   const hasMultimodal = ImageProcessor.hasImageContent(req.messages);
  let finalMessages = processedMessages;
  let uploadedFiles: UploadedFile[] = [];

  if (hasMultimodal) {
      debugLog("🎯 Detected image content, starting processing, model: %s", modelConfig.name);
 
     // Check anonymous token restrictions
     if (tokenPool.isAnonymousToken(authToken)) {
       debugLog("❌ Anonymous token does not support image processing");
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 400);
      addLiveRequest(request.method, path, 400, duration, userAgent);
       return new Response("Anonymous token does not support image processing, please configure ZAI_TOKEN environment variable", {
         status: 400,
         headers,
       });
    }

    if (!capabilities.vision) {
       debugLog("❌ Serious error: Model does not support multimodal, but received image content!");
       debugLog(
         "💡 Cherry Studio users please check: Confirm selected 'glm-4.5v' not 'GLM-4.5'"
       );
       debugLog(
         "🔧 Model mapping status: %s → %s (vision: %s)",
         req.model,
         modelConfig.upstreamId,
         capabilities.vision
       );
    } else {
       debugLog("✅ Using advanced image processor to process image content");

       try {
         // Use new image processor
         const imageProcessResult = await ImageProcessor.processImages(
          req.messages,
          authToken,
          capabilities.vision
        );

        finalMessages = imageProcessResult.processedMessages;
        uploadedFiles = imageProcessResult.uploadedFiles;

         debugLog("Image processing completed: processed messages=%d, uploaded files=%d",
           finalMessages.length, uploadedFiles.length);

      } catch (error) {
         debugLog("Image processing failed: %v", error);
        const duration = Date.now() - startTime;
        recordRequestStats(startTime, path, 500);
        addLiveRequest(request.method, path, 500, duration, userAgent);
         return new Response("Image processing failed", {
          status: 500,
          headers,
        });
      }
    }
  } else if (capabilities.vision && modelConfig.id === "glm-4.5v") {
     debugLog("ℹ️ Using GLM-4.5V model but no image data detected, processing text content only");
  }

  // Generate session IDs (prefer client-provided values if present in incoming body)
  const chatID = (typeof incomingBody === "object" && incomingBody?.chat_id) ? String(incomingBody.chat_id) : `${Date.now()}-${Math.floor(Date.now() / 1000)}`;
  const msgID = (typeof incomingBody === "object" && incomingBody?.id) ? String(incomingBody.id) : Date.now().toString();

   // Get MCP server list for model (consistent with Python version)
   const mcpServers = ModelCapabilityDetector.getMCPServersForModel(capabilities);
   const hiddenMcpFeatures = ModelCapabilityDetector.getHiddenMCPFeatures();

   // Extract last user message content (for signature)
   const lastUserContent = ImageProcessor.extractLastUserContent(req.messages);

   // Determine model characteristics (consistent with Python version)
   // Allow header to override capability detection
   const thinkingHeaderValue = parseBooleanHeader(thinkingHeader);
   const isThinking = thinkingHeaderValue !== null ? thinkingHeaderValue : capabilities.thinking;
   const isSearch = capabilities.search || capabilities.advancedSearch;

   debugLog("🧠 Thinking mode: %s (header: %s, capability: %s, final: %s)",
     isThinking, thinkingHeader || "not set", capabilities.thinking, isThinking);

   // Construct upstream request (matching Python version exactly)
   const upstreamReq: UpstreamRequest = {
     stream: true, // Always fetch upstream as stream
     model: modelConfig.upstreamId,
     messages: finalMessages,
     signature_prompt: lastUserContent, // Used for signature generation
     params: modelConfig.defaultParams,
     features: {
       image_generation: false,
       web_search: isSearch,
       auto_web_search: isSearch,
       preview_mode: isSearch,
       flags: [],
       features: hiddenMcpFeatures,
       enable_thinking: isThinking,
     },
     background_tasks: {
       title_generation: false,
       tags_generation: false,
     },
     mcp_servers: mcpServers.length > 0 ? mcpServers : undefined,
     model_item: {
       id: modelConfig.upstreamId,
       name: req.model, // Use original request model name
       owned_by: "z.ai"
     },
     chat_id: chatID,
     id: msgID,
     tool_servers: [],
     variables: {
       "{{USER_NAME}}": "Guest",
       "{{USER_LOCATION}}": "Unknown",
       "{{CURRENT_DATETIME}}": new Date().toLocaleString(DEFAULT_LANGUAGE),
       "{{CURRENT_DATE}}": new Date().toLocaleDateString(DEFAULT_LANGUAGE),
       "{{CURRENT_TIME}}": new Date().toLocaleTimeString(DEFAULT_LANGUAGE),
       "{{CURRENT_WEEKDAY}}": new Date().toLocaleDateString(DEFAULT_LANGUAGE, {
         weekday: "long",
       }),
       "{{CURRENT_TIMEZONE}}": "Asia/Shanghai",
       "{{USER_LANGUAGE}}": DEFAULT_LANGUAGE,
     },
     // Add file list (if there are uploaded images and not vision model)
     ...(uploadedFiles.length > 0 && !capabilities.vision ? { files: uploadedFiles } : {}),
   };
 
   // Token already acquired earlier

  // Call upstream
  try {
    if (req.stream) {
      return await handleStreamResponse(upstreamReq, chatID, authToken, startTime, path, userAgent, req, modelConfig, currentThinkTagsMode);
    } else {
      return await handleNonStreamResponse(upstreamReq, chatID, authToken, startTime, path, userAgent, req, modelConfig, currentThinkTagsMode);
    }
  } catch (error) {
    debugLog("Upstream call failed: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest(request.method, path, 502, duration, userAgent);
    return new Response("Failed to call upstream", {
      status: 502,
      headers
    });
  }
}

/**
 * Handles streaming response for chat completions.
 * @param {UpstreamRequest} upstreamReq - The request to send upstream.
 * @param {string} chatID - The chat session ID.
 * @param {string} authToken - The authentication token.
 * @param {number} startTime - The start time for metrics.
 * @param {string} path - The request path.
 * @param {string} userAgent - The user agent string.
 * @param {OpenAIRequest} req - The original OpenAI request.
 * @param {ModelConfig} modelConfig - The model configuration.
 * @param {"strip" | "thinking" | "think" | "raw" | "separate"} thinkTagsMode - Mode for handling thinking tags.
 * @returns {Promise<Response>} The streaming response.
 */
async function handleStreamResponse(
  upstreamReq: UpstreamRequest,
  chatID: string,
  authToken: string,
  startTime: number,
  path: string,
  userAgent: string,
  req: OpenAIRequest,
  modelConfig: ModelConfig,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate"
): Promise<Response> {
  debugLog("Starting to handle stream response (chat_id=%s)", chatID);

  try {
    const response = await callUpstreamWithHeaders(upstreamReq, chatID, authToken);

    if (!response.ok) {
      debugLog("Upstream returned error status: %d", response.status);
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response("Upstream error", { status: 502 });
    }

    if (!response.body) {
      debugLog("Upstream response body is empty");
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response("Upstream response body is empty", { status: 502 });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send first chunk (role)
    const firstChunk: OpenAIResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: req.model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant" }
        }
      ]
    };

    writer.write(encoder.encode(`data: ${JSON.stringify(firstChunk)}\n\n`));

    // Process upstream SSE stream asynchronously
    processUpstreamStream(response.body, writer, encoder, req.model, thinkTagsMode).then(usage => {
      if (usage) {
        debugLog("Stream completed with usage: prompt=%d, completion=%d, total=%d",
          usage.prompt_tokens, usage.completion_tokens, usage.total_tokens);
      }
    }).catch(error => {
      debugLog("Error while processing upstream stream: %v", error);
    });

    // Record stats
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 200);
    addLiveRequest("POST", path, 200, duration, userAgent, modelConfig.name);

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
      }
    });
  } catch (error) {
    debugLog("Error handling stream response: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest("POST", path, 502, duration, userAgent);
    return new Response("Failed to process stream response", { status: 502 });
  }
}

async function handleNonStreamResponse(
  upstreamReq: UpstreamRequest,
  chatID: string,
  authToken: string,
  startTime: number,
  path: string,
  userAgent: string,
  req: OpenAIRequest,
  modelConfig: ModelConfig,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate"
): Promise<Response> {
  debugLog("Starting to handle non-stream response (chat_id=%s)", chatID);

  try {
    const response = await callUpstreamWithHeaders(upstreamReq, chatID, authToken);

    if (!response.ok) {
      debugLog("Upstream returned error status: %d", response.status);
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response("Upstream error", { status: 502 });
    }

    if (!response.body) {
      debugLog("Upstream response body is empty");
      const duration = Date.now() - startTime;
      recordRequestStats(startTime, path, 502);
      addLiveRequest("POST", path, 502, duration, userAgent);
      return new Response("Upstream response body is empty", { status: 502 });
    }

    const { content: finalContent, reasoning_content: reasoningContent, usage: finalUsage } = await collectFullResponse(response.body, thinkTagsMode);
    debugLog("Content collection completed, final length: %d", finalContent.length);
    debugLog("Reasoning content status: %s", reasoningContent ? `present (${reasoningContent.length} chars)` : "not present");

    if (reasoningContent) {
      debugLog("Reasoning content collected, length: %d", reasoningContent.length);
      debugLog("Reasoning content preview: %s", reasoningContent.substring(0, 100));
    }

    if (finalUsage) {
      debugLog("Non-stream completed with usage: prompt=%d, completion=%d, total=%d",
        finalUsage.prompt_tokens, finalUsage.completion_tokens, finalUsage.total_tokens);
    }

    const message: Message = {
      role: "assistant",
      content: finalContent || ""
    };

    // Add reasoning_content if available
    if (reasoningContent) {
      message.reasoning_content = reasoningContent;
    }

    const openAIResponse: OpenAIResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.model,
      choices: [
        {
          index: 0,
          message: message,
          finish_reason: "stop"
        }
      ],
      usage: finalUsage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 200);
    addLiveRequest("POST", path, 200, duration, userAgent, modelConfig.name);

    return new Response(JSON.stringify(openAIResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
      }
    });
  } catch (error) {
    debugLog("Error processing non-stream response: %v", error);
    const duration = Date.now() - startTime;
    recordRequestStats(startTime, path, 502);
    addLiveRequest("POST", path, 502, duration, userAgent);
    return new Response("Failed to process non-stream response", { status: 502 });
  }
}

/**
 * Dashboard HTML template
 * Provides live API call monitoring and statistics
 */
async function getDashboardHTML(): Promise<string> {
  try {
    return await Deno.readTextFile('./ui/dashboard/dashboard.html');
  } catch (error) {
    console.error('Failed to read dashboard.html:', error);
    return '<h1>UI files not found. Please ensure ui folder exists.</h1>';
  }
}

/**
 * Dashboard request handlers
 */
async function handleDashboard(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const html = await getDashboardHTML();
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function handleDashboardStats(_request: Request): Response {
  return new Response(getStatsData(), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function handleDashboardRequests(_request: Request): Response {
  return new Response(getLiveRequestsData(), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function getDocsHTML(): Promise<string> {
  try {
    return await Deno.readTextFile('./ui/docs/docs.html');
  } catch (error) {
    console.error('Failed to read docs.html:', error);
    return '<h1>UI files not found. Please ensure ui folder exists.</h1>';
  }
}

/**
 * Docs page handler
 */
async function handleDocs(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const html = await getDocsHTML();
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

async function handleStatic(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.substring(4); // remove /ui/ prefix
  const filePath = `./ui/${path}`;
  
  try {
    const fileBytes = await Deno.readFile(filePath);
    const contentType = getContentType(path);
    return new Response(fileBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error(`Failed to serve static file ${filePath}:`, error);
    return new Response("File not found", { status: 404 });
  }
}

function getContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return 'text/html; charset=utf-8';
    case 'css': return 'text/css; charset=utf-8';
    case 'js': return 'application/javascript; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

// Main HTTP server entrypoint
function main() {
  console.log(`OpenAI-compatible API server starting`);
  console.log(`Supported models: ${SUPPORTED_MODELS.map(m => `${m.id} (${m.name})`).join(', ')}`);
  console.log(`Upstream: ${UPSTREAM_URL}`);
  console.log(`Debug mode: ${DEBUG_MODE}`);
  console.log(`Default streaming: ${DEFAULT_STREAM}`);
  console.log(`Dashboard enabled: ${DASHBOARD_ENABLED}`);

  const port = parseInt(Deno.env.get("PORT") || "9090");
  console.log(`Running on port: ${port}`);

  if (DASHBOARD_ENABLED) {
    console.log(`Dashboard enabled at: http://localhost:${port}/dashboard`);
  }

  Deno.serve({ port, handler: handleRequest });
}


// Handle HTTP requests (Deno Deploy)
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const startTime = Date.now();
  const userAgent = request.headers.get("User-Agent") || "";

  try {
    // Routing
    if (url.pathname === "/") {
      const response = await handleIndex(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname.startsWith("/ui/")) {
      const response = await handleStatic(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/v1/models") {
      const response = await handleModels(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/v1/chat/completions") {
      const response = await handleChatCompletions(request);
      // stats recorded inside handleChatCompletions
      return response;
    } else if (url.pathname === "/anthropic/v1/models") {
      const response = handleAnthropicModels(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/anthropic/v1/messages") {
      const response = await handleAnthropicMessages(request);
      // stats recorded inside handleAnthropicMessages
      return response;
    } else if (url.pathname === "/anthropic/v1/messages/count_tokens") {
      const response = await handleAnthropicTokenCount(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/docs") {
      const response = await handleDocs(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard" && DASHBOARD_ENABLED) {
      const response = await handleDashboard(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard/stats" && DASHBOARD_ENABLED) {
      const response = await handleDashboardStats(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else if (url.pathname === "/dashboard/requests" && DASHBOARD_ENABLED) {
      const response = await handleDashboardRequests(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    } else {
      const response = await handleOptions(request);
      recordRequestStats(startTime, url.pathname, response.status);
      addLiveRequest(request.method, url.pathname, response.status, Date.now() - startTime, userAgent);
      return response;
    }
  } catch (error) {
    debugLog("Error handling request: %v", error);
    recordRequestStats(startTime, url.pathname, 500);
    addLiveRequest(request.method, url.pathname, 500, Date.now() - startTime, userAgent);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// Start server
if (import.meta.main) {
  main();
}
