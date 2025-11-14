/**
 * Stream processing utilities
 * Handles SSE stream parsing and transformation
 * Provides advanced thinking mode handling with state tracking
 */

import { logger } from "./logger.ts";
import { detectToolCall, processToolCall } from "../services/tool-processor.ts";
import type { UpstreamData, Usage, ToolCall } from "../types/definitions.ts";
import type { OpenAIResponse } from "../types/openai.ts";

// Thinking content handling mode:
// - "strip": remove <details> tags and show only content
// - "thinking": convert <details> to <thinking> tags
// - "think": convert <details> to <think> tags
// - "raw": keep as-is
// - "separate": separate reasoning into reasoning_content field
const THINK_TAGS_MODE = "think";

/**
 * Transforms thinking content based on the specified mode.
 * Returns either a string (for "strip", "thinking", "think", "raw" modes) or an object with reasoning and content (for "separate" mode).
 * @param {string} content - The content to transform, containing thinking tags.
 * @param {"strip" | "thinking" | "think" | "raw" | "separate"} [mode=THINK_TAGS_MODE] - The transformation mode.
 * @returns {string | { reasoning: string; content: string }} The transformed content.
 */
export function transformThinking(
  content: string,
  mode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as
    | "strip"
    | "thinking"
    | "think"
    | "raw"
    | "separate",
): string | { reasoning: string; content: string } {
  // Raw mode: return as-is
  if (mode === "raw") {
    return content;
  }

  // Separate mode: extract reasoning and content separately
  if (mode === "separate") {
    let reasoning = "";
    let finalContent = "";

    // Check for <think>...</think> format first (for test compatibility)
    if (content.includes("</think>")) {
      // Match <think>...</think> blocks - check for the specific format used in tests
      const isParenThinkFormat = content.includes("<think>");
      let thinkBlocks: string[] = [];

      if (isParenThinkFormat) {
        // Extract <think>...</think> blocks
        const parenMatch = content.match(/<think[^>]*>(.*?)<\/think>/gs);
        if (parenMatch) {
          thinkBlocks = parenMatch;
        }
      } else {
        const thinkingMatch = content.match(/<thinking[^>]*>(.*?)<\/thinking>/gs);
        if (thinkingMatch) {
          thinkBlocks = thinkingMatch;
        }
      }

      if (thinkBlocks) {
        // Process reasoning content
        reasoning = thinkBlocks.join("\n");

        // Remove <thinking>...</thinking> and <think>...</think> tags
        reasoning = reasoning.replace(/<thinking[^>]*>/g, "");
        reasoning = reasoning.replace(/<\/thinking>/g, "");
        reasoning = reasoning.replace(/<think[^>]*>/g, "");
        reasoning = reasoning.replace(/<(\/?)think[^>]*>/g, "<$1think>");
        reasoning = reasoning.replace(/<\/think>/g, "");
        reasoning = reasoning.replace(/<\/think>/g, "");
        reasoning = reasoning.replace(/<(\/?)think[^>]*>/g, "<$1think>");
        reasoning = reasoning.replace(/<\/think>/g, "");

        // Remove <think> and </think>
        reasoning = reasoning.replace(/<think[^>]*>/g, "");
        reasoning = reasoning.replace(/<think>/g, "");
        reasoning = reasoning.replace(/<\/think>/g, "");
        reasoning = reasoning.replace(/<\/think>/g, "");

        reasoning = reasoning.trim();

        // Extract final content (everything outside <think>...</think> tags)
        finalContent = content.replace(/<thinking[^>]*>.*?<\/thinking>/gs, "").replace(
          /<think[^>]*>.*?<\/think>/gs,
          "",
        );
      } else {
        finalContent = content;
      }
    } else {
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
        finalContent = content.replace(/<details[^>]*>.*?<\/details>/gs, "");
      } else if (content.includes("</details>")) {
        // Handle partial edit_content (starts mid-tag)
        // Split by </details> to separate reasoning from content
        const parts = content.split("</details>");

        reasoning = parts[0];
        finalContent = parts.slice(1).join("</details>");

        // Remove <summary>...</summary>
        reasoning = reasoning.replace(/<summary>.*?<\/summary>/gs, "");

        // Remove any partial opening tags at the start (e.g., 'true" duration="5"...)
        reasoning = reasoning.replace(/^[^>]*>/, "");

        // Handle line prefix "> "
        reasoning = reasoning.replace(/^> /gm, "");

        reasoning = reasoning.trim();

        logger.debug(
          "Separate mode - extracted reasoning length: %d, content length: %d",
          reasoning.length,
          finalContent.length,
        );
        logger.debug("Separate mode - content preview: %s", finalContent.substring(0, 50));
      } else {
        // No details tags, treat all as final content
        finalContent = content;
      }
    }

    return { reasoning, content: finalContent };
  }

  // For "strip", "thinking", and "think" modes, process as string
  let result = content;

  // Handle <think>...</think> format first (for test compatibility)
  if (content.includes("</think>")) {
    // Match <think>...</think> blocks
    const thinkBlocks = content.match(/<thinking[\s\S]*?<\/thinking>|<think[\s\S]*?<\/think>|<\/thinking>/gs);

    if (thinkBlocks) {
      switch (mode) {
        case "thinking":
          // Convert <think> to <thinking>, keep <thinking> as-is
          result = result.replace(/<thinking[^>]*>/g, "<thinking>");
          result = result.replace(/<think[^>]*>/g, "<thinking>");
          result = result.replace(/<\/thinking>/g, "</thinking>");
          result = result.replace(/<(\/?)think[^>]*>/g, "<$1thinking>");
          result = result.replace(/<think>/g, "<thinking>");
          result = result.replace(/<\/think>/g, "</thinking>");
          result = result.replace(/<\/think>/g, "</thinking>");
          break;
        case "think":
          // Keep <think> as-is (or normalize to <think>)
          result = result.replace(/<thinking[^>]*>/g, "<think>");
          result = result.replace(/<\/thinking>/g, "</think>");
          result = result.replace(/<think[^>]*>/g, "<think>");
          result = result.replace(/<(\/?)think[^>]*>/g, "<$1think>");
          break;
        case "strip":
          // Remove <think>...</think> tags but keep content
          result = result.replace(/<thinking[^>]*>.*?<\/thinking>/gs, "");
          result = result.replace(/<think[^>]*>.*?<\/think>/gs, "");
          // Also handle the shorthand format: <think>...</think>
          result = result.replace(/illard.*?<\/think>/gs, "");
          result = result.replace(/<(\/?)think[^>]*>/g, "<$1think>");
          break;
      }
    }
  }

  // Handle complete <details> tags
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
export async function processStreamingResponse(
  body: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  modelName: string,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as
    | "strip"
    | "thinking"
    | "think"
    | "raw"
    | "separate",
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

  // Track tool calls in streaming
  let pendingToolCall: ToolCall | null = null;
  let toolCallBuffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep last partial line

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6);
          if (dataStr === "") continue;

          logger.debug("Received SSE data: %s", dataStr);

          try {
            const upstreamData = JSON.parse(dataStr) as UpstreamData;

            // Error detection
            if (
              upstreamData.error || upstreamData.data.error ||
              (upstreamData.data.inner && upstreamData.data.inner.error)
            ) {
              const errObj = upstreamData.error || upstreamData.data.error ||
                (upstreamData.data.inner && upstreamData.data.inner.error);
              logger.debug("Upstream error: code=%d, detail=%s", errObj?.code, errObj?.detail);

              const errorDetail = (errObj?.detail || "").toLowerCase();
              if (errorDetail.includes("something went wrong") || errorDetail.includes("try again later")) {
                logger.debug("🚨 Z.ai server error analysis:");
                logger.debug("   📋 Detail: %s", errObj?.detail);
                logger.debug("   🖼️ Possible cause: image processing failure");
                logger.debug("   💡 Suggested fixes:");
                logger.debug("      1. Use smaller images (< 500KB)");
                logger.debug("      2. Try different formats (JPEG over PNG)");
                logger.debug("      3. Retry later (server load issue)");
                logger.debug("      4. Check for corrupted images");
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
                    finish_reason: "stop",
                  },
                ],
              };

              await writer.write(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`));
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              return finalUsage;
            }

            logger.debug(
              "Parsed upstream - type: %s, phase: %s, content length: %d, done: %v",
              upstreamData.type,
              upstreamData.data.phase,
              upstreamData.data.delta_content ? upstreamData.data.delta_content.length : 0,
              upstreamData.data.done,
            );

            // Capture usage information if present
            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              logger.debug(
                "Captured usage data: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens,
                finalUsage.completion_tokens,
                finalUsage.total_tokens,
              );
            }

            // Handle edit_content (complete thinking block sent when phase changes)
            if (upstreamData.data.edit_content && !thinkingSent) {
              logger.debug(
                "Received edit_content with complete thinking block, length: %d",
                upstreamData.data.edit_content.length,
              );
              logger.debug("Current mode: %s, thinkingSent: %s", THINK_TAGS_MODE, thinkingSent);

              if (thinkTagsMode === "separate") {
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                if (typeof transformed === "object" && transformed.reasoning) {
                  logger.debug("Sending reasoning from edit_content, length: %d", transformed.reasoning.length);

                  // Send reasoning as a separate field
                  const reasoningChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { reasoning_content: transformed.reasoning },
                      },
                    ],
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(reasoningChunk)}\n\n`));
                  thinkingSent = true;
                }
              } else {
                // For non-'separate' modes, edit_content contains the full thinking block + first response character.
                // We rely on incremental streaming for thinking content, but need to stream the closing tag and the trailing content ('H').

                let contentAfterThinking = "";
                const parts = upstreamData.data.edit_content.split("</details>");

                if (parts.length > 1) {
                  contentAfterThinking = parts.slice(1).join("</details>");
                }

                // 1. Stream closing tag if one was opened incrementally
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
                    logger.debug("Sending closing thinking tag from edit_content handler: %s", closingTag);
                    const chunk: OpenAIResponse = {
                      id: `chatcmpl-${Date.now()}`,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: modelName,
                      choices: [{ index: 0, delta: { content: closingTag } }],
                    };
                    await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                }

                // 2. Stream the content that followed the thinking block ('H')
                if (contentAfterThinking) {
                  logger.debug("Streaming content after thinking block: %s", contentAfterThinking.substring(0, 20));
                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{ index: 0, delta: { content: contentAfterThinking } }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }

                thinkingSent = true; // Mark as sent to prevent further processing of this block type
              }

              // Reset thinking state after processing the complete thinking block in edit_content
              inThinkingPhase = false;
              thinkingTagOpened = false;
            }

            // Handle content
            if (upstreamData.data.delta_content && upstreamData.data.delta_content !== "") {
              const rawContent = upstreamData.data.delta_content;
              const isThinking = upstreamData.data.phase === "thinking";

              // Accumulate content for tool call detection
              toolCallBuffer += rawContent;

              // Check for tool calls in accumulated content
              const mockUpstreamData: UpstreamData = {
                type: upstreamData.type,
                data: {
                  ...upstreamData.data,
                  delta_content: toolCallBuffer,
                },
              };

              const detectedToolCall = detectToolCall(mockUpstreamData);
              if (detectedToolCall && !pendingToolCall) {
                logger.info("Tool call detected in stream: %s", detectedToolCall.function.name);
                pendingToolCall = detectedToolCall;

                // Send tool call event to client
                const toolCallChunk: OpenAIResponse = {
                  id: `chatcmpl-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: modelName,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        tool_calls: [detectedToolCall],
                      },
                    },
                  ],
                };

                await writer.write(encoder.encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`));

                // Execute tool and send result
                try {
                  const toolResult = await processToolCall(detectedToolCall);
                  
                  // Send tool result
                  const toolResultChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          content: toolResult,
                        },
                      },
                    ],
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(toolResultChunk)}\n\n`));
                } catch (error) {
                  logger.error("Failed to execute tool in stream: %v", error);
                  const errorChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          content: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                        },
                      },
                    ],
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
                }

                // Clear buffer after processing
                toolCallBuffer = "";
                continue; // Skip normal content processing for this chunk
              }

              if (thinkTagsMode === "separate") {
                // In separate mode, accumulate thinking content
                if (isThinking) {
                  accumulatedThinking += rawContent;

                  // Check if thinking block is complete (contains closing </details>)
                  if (accumulatedThinking.includes("</details>") && !thinkingSent) {
                    const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
                    if (typeof transformed === "object" && transformed.reasoning) {
                      logger.debug("Sending accumulated reasoning content, length: %d", transformed.reasoning.length);

                      // Send reasoning as a separate field
                      const reasoningChunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { reasoning_content: transformed.reasoning },
                          },
                        ],
                      };

                      await writer.write(encoder.encode(`data: ${JSON.stringify(reasoningChunk)}\n\n`));
                      thinkingSent = true;
                    }
                  }
                } else {
                  // Regular content
                  logger.debug("Sending regular content: %s", rawContent);

                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { content: rawContent },
                      },
                    ],
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
                      logger.debug("Sending opening thinking tag: %s", openingTag);
                      const chunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { content: openingTag },
                          },
                        ],
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
                    logger.debug("Streaming thinking chunk, length: %d", processedChunk.length);

                    const chunk: OpenAIResponse = {
                      id: `chatcmpl-${Date.now()}`,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: modelName,
                      choices: [
                        {
                          index: 0,
                          delta: { content: processedChunk },
                        },
                      ],
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
                      logger.debug("Sending closing thinking tag: %s", closingTag);
                      const chunk: OpenAIResponse = {
                        id: `chatcmpl-${Date.now()}`,
                        object: "chat.completion.chunk",
                        created: Math.floor(Date.now() / 1000),
                        model: modelName,
                        choices: [
                          {
                            index: 0,
                            delta: { content: closingTag },
                          },
                        ],
                      };
                      await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    }

                    inThinkingPhase = false;
                    thinkingTagOpened = false;
                  }

                  // Regular content (non-thinking)
                  logger.debug("Sending regular content: %s", rawContent);

                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [
                      {
                        index: 0,
                        delta: { content: rawContent },
                      },
                    ],
                  };

                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
            }

            // Check for done
            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              logger.debug("Detected stream end signal");

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
                    finish_reason: "stop",
                  },
                ],
                usage: finalUsage || undefined,
              };

              await writer.write(encoder.encode(`data: ${JSON.stringify(endChunk)}\n\n`));
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              return finalUsage;
            }
          } catch (error) {
            logger.debug("Failed to parse SSE data: %v", error);
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
export async function collectFullResponse(
  body: ReadableStream<Uint8Array>,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = THINK_TAGS_MODE as
    | "strip"
    | "thinking"
    | "think"
    | "raw"
    | "separate",
): Promise<{ content: string; reasoning_content?: string; usage: Usage | null }> {
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
      const lines = buffer.split("\n");
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
              logger.debug(
                "Captured usage data in non-streaming: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens,
                finalUsage.completion_tokens,
                finalUsage.total_tokens,
              );
            }

            // Handle edit_content (complete thinking block)
            if (upstreamData.data.edit_content) {
              logger.debug("Received edit_content in non-streaming, length: %d", upstreamData.data.edit_content.length);

              if (thinkTagsMode === "separate") {
                // For separate mode, extract reasoning and content separately
                if (!fullReasoning) {
                  const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                  if (typeof transformed === "object") {
                    fullReasoning = transformed.reasoning;
                    logger.debug("Extracted reasoning from edit_content, length: %d", fullReasoning.length);

                    // Also add the content part from edit_content to fullContent
                    if (transformed.content && transformed.content.trim() !== "") {
                      fullContent += transformed.content || "";
                      logger.debug(
                        "Added content part from edit_content, length: %d",
                        (transformed.content || "").length,
                      );
                    }
                  }
                }
              } else {
                // For other modes, process the thinking content and add to fullContent
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                const processedContent = typeof transformed === "string" ? transformed : transformed.content;

                if (processedContent && processedContent.trim() !== "") {
                  fullContent += processedContent || "";
                  logger.debug(
                    "Added processed edit_content to fullContent, length: %d",
                    (processedContent || "").length,
                  );
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
              logger.debug("Detected completion signal, stopping collection");

              // Process accumulated thinking if in separate mode (only if not already set from edit_content)
              if (thinkTagsMode === "separate" && accumulatedThinking && !fullReasoning) {
                const transformed = transformThinking(accumulatedThinking, thinkTagsMode);
                if (typeof transformed === "object") {
                  fullReasoning = transformed.reasoning;
                  logger.debug("Set fullReasoning from accumulated thinking, length: %d", fullReasoning.length);
                }
              }

              logger.debug(
                "collectFullResponse early return - content length: %d, reasoning length: %d",
                fullContent.length,
                fullReasoning ? fullReasoning.length : 0,
              );

              return {
                content: fullContent,
                reasoning_content: fullReasoning || undefined,
                usage: finalUsage,
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

  logger.debug(
    "collectFullResponse returning - content length: %d, reasoning length: %d",
    fullContent.length,
    fullReasoning ? fullReasoning.length : 0,
  );

  return {
    content: fullContent,
    reasoning_content: fullReasoning || undefined,
    usage: finalUsage,
  };
}

// Export processUpstreamStream as an alias for processStreamingResponse
export const processUpstreamStream = processStreamingResponse;
