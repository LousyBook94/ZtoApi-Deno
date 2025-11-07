/**
 * OpenAI API type definitions
 */

import type { Message, Usage } from "./common.ts";

/**
 * OpenAI chat completion request
 */
export interface OpenAIRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  reasoning?: boolean;
}

/**
 * OpenAI-compatible response structure
 */
export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage?: Usage;
}

export interface Choice {
  index: number;
  message?: Message;
  delta?: Delta;
  finish_reason?: string | null;
}

export interface Delta {
  role?: string;
  content?: string;
  reasoning_content?: string;
}
