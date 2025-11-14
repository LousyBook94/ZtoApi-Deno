/**
 * Validation utilities
 * Contains model normalization and message processing functions
 */

import type { Message, ModelConfig, Tool } from "../types/definitions.ts";
import { hasTool } from "../services/tool-registry.ts";

/**
 * Debug logging function - will be injected
 */
let debugLog: (format: string, ...args: unknown[]) => void = () => {};

/**
 * Set the debug logger (called from main)
 */
export function setDebugLogger(logger: (format: string, ...args: unknown[]) => void) {
  debugLog = logger;
}

/**
 * Normalize model ID to handle different client naming formats
 */
export function normalizeModelId(modelId: string): string {
  const normalized = modelId.toLowerCase().trim();

  const modelMappings: Record<string, string> = {
    // GLM-4.5V mappings
    "glm-4.5v": "glm-4.5v",
    "glm4.5v": "glm-4.5v",
    "glm_4.5v": "glm-4.5v",
    "glm-4.5v-api": "glm-4.5v",
    "gpt-4-vision-preview": "glm-4.5v", // backward compatibility
    "glm-4.5V": "glm-4.5v", // Allow capital V

    // GLM-4.5 mappings
    "0727-360b-api": "0727-360B-API",
    "glm-4.5": "0727-360B-API",
    "glm4.5": "0727-360B-API",
    "glm_4.5": "0727-360B-API",
    "glm-4.5-api": "0727-360B-API",
    "gpt-4": "0727-360B-API", // backward compatibility

    // GLM-4.6 mappings (from example requests)
    "glm-4.6": "GLM-4-6-API-V1",
    "glm4.6": "GLM-4-6-API-V1",
    "glm_4.6": "GLM-4-6-API-V1",
    "glm-4-6-api-v1": "GLM-4-6-API-V1",
    "glm-4-6": "GLM-4-6-API-V1",
    "glm-4.6-api-v1": "GLM-4-6-API-V1", // Allow lowercase API
    // Add common capitalized versions, mapping to the already normalized lowercase keys
    // The input is already normalized to lowercase, so these explicit duplicates are unnecessary.
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
export function processMessages(messages: Message[], modelConfig: ModelConfig): Message[] {
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
        others: 0,
      };

      if (!modelConfig.capabilities.vision) {
        debugLog("Warning: Model %s does not support multimodal content but received it", modelConfig.name);
        // Keep only text blocks
        const textContent = message.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n");
        processedMessage.content = textContent;
      } else {
        // GLM-4.5V supports full multimodal handling
        for (const block of message.content) {
          switch (block.type) {
            case "text":
              if (block.text) {
                mediaStats.text++;
                debugLog("📝 Text block length: %d", block.text.length);
              }
              break;

            case "image_url":
              if (block.image_url?.url) {
                mediaStats.images++;
                const url = block.image_url.url;
                if (url.startsWith("data:image/")) {
                  const mimeMatch = url.match(/data:image\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : "unknown";
                  debugLog("🖼️ Image data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith("http")) {
                  debugLog("🔗 Image URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown image format: %s", url.substring(0, 50));
                }
              }
              break;

            case "video_url":
              if (block.video_url?.url) {
                mediaStats.videos++;
                const url = block.video_url.url;
                if (url.startsWith("data:video/")) {
                  const mimeMatch = url.match(/data:video\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : "unknown";
                  debugLog("🎥 Video data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith("http")) {
                  debugLog("🔗 Video URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown video format: %s", url.substring(0, 50));
                }
              }
              break;

            case "document_url":
              if (block.document_url?.url) {
                mediaStats.documents++;
                const url = block.document_url.url;
                if (url.startsWith("data:application/")) {
                  const mimeMatch = url.match(/data:application\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : "unknown";
                  debugLog("📄 Document data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith("http")) {
                  debugLog("🔗 Document URL: %s", url);
                } else {
                  debugLog("⚠️ Unknown document format: %s", url.substring(0, 50));
                }
              }
              break;

            case "audio_url":
              if (block.audio_url?.url) {
                mediaStats.audios++;
                const url = block.audio_url.url;
                if (url.startsWith("data:audio/")) {
                  const mimeMatch = url.match(/data:audio\/([^;]+)/);
                  const format = mimeMatch ? mimeMatch[1] : "unknown";
                  debugLog("🎵 Audio data: %s format, size: %d chars", format, url.length);
                } else if (url.startsWith("http")) {
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
          debugLog(
            "🎯 Multimodal stats: text(%d) images(%d) videos(%d) documents(%d) audio(%d)",
            mediaStats.text,
            mediaStats.images,
            mediaStats.videos,
            mediaStats.documents,
            mediaStats.audios,
          );
        }
      }
    } else if (typeof message.content === "string") {
      debugLog("📝 Plain text message, length: %d", message.content.length);
    }

    processedMessages.push(processedMessage);
  }

  return processedMessages;
}

/**
 * Validate tools array in request
 * @param tools Tools array from request
 * @throws Error if validation fails
 */
export function validateTools(tools?: Tool[]): void {
  if (!tools || tools.length === 0) {
    return;
  }

  for (const tool of tools) {
    if (tool.type !== "function") {
      throw new Error(`Unsupported tool type: ${tool.type}. Only 'function' type is supported.`);
    }

    if (!tool.function || !tool.function.name) {
      throw new Error("Tool function must have a name");
    }

    const toolName = tool.function.name;
    if (!hasTool(toolName)) {
      throw new Error(`Tool not found: ${toolName}. Available tools: ${getAvailableToolNames().join(", ")}`);
    }

    // Validate parameters schema if provided
    if (tool.function.parameters) {
      if (typeof tool.function.parameters !== "object" || tool.function.parameters === null) {
        throw new Error(`Tool parameters must be a valid JSON schema object for tool: ${toolName}`);
      }
    }

    debugLog("✅ Validated tool: %s", toolName);
  }
}

/**
 * Get list of available tool names
 * @returns Array of tool names
 */
export function getAvailableToolNames(): string[] {
  const { getAllTools } = require("../services/tool-registry.ts");
  return getAllTools().map((tool: { name: string }) => tool.name);
}
