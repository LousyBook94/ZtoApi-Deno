/**
 * Upstream Z.ai API type definitions
 */

import type { Message } from "./common.ts";

/**
 * Upstream request structure sent to Z.ai API.
 */
export interface UpstreamRequest {
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
  files?: Array<{
    id: string;
    filename: string;
    size: number;
    type: string;
    url: string;
  }>;
}

