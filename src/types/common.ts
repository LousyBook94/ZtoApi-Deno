/**
 * Common type definitions used across the application
 */

/**
 * Request statistics interface
 * Tracks metrics for API calls
 */
export interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: Date;
  averageResponseTime: number;
}

/**
 * Live request info for Dashboard display
 */
export interface LiveRequest {
  id: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: Date;
  userAgent: string;
  model?: string;
}

/**
 * Chat message structure
 * Supports multimodal content: text, image, video, document, audio
 */
export interface Message {
  role: string;
  content:
    | string
    | Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
      video_url?: { url: string };
      document_url?: { url: string };
      audio_url?: { url: string };
    }>;
  reasoning_content?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Structure representing an uploaded file.
 */
export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  type: string;
  url: string;
}

export interface UpstreamError {
  detail: string;
  code: number;
}

/**
 * Capabilities of a model, indicating supported features.
 */
export interface ModelCapabilities {
  thinking: boolean;
  search: boolean;
  advancedSearch: boolean;
  vision: boolean;
  mcp: boolean;
}

/**
 * Configuration for an MCP (Model Context Protocol) server.
 */
export interface MCPServerConfig {
  name: string;
  description: string;
  enabled: boolean;
}

export interface Model {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelsResponse {
  object: string;
  data: Model[];
}

/**
 * Token information for token pool management
 */
export interface TokenInfo {
  token: string;
  isValid: boolean;
  lastUsed: number;
  failureCount: number;
  isAnonymous: boolean;
}
