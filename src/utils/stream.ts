/**
 * Stream processing utilities
 * Handles SSE stream parsing and transformation
 */

import { logger } from "./logger.ts";
import type { UpstreamData, Usage } from "../types/common.ts";
import type { OpenAIResponse } from "../types/openai.ts";

/**
 * Transform thinking content based on mode
 */
export function transformThinking(
  content: string,
  mode: "strip" | "thinking" | "think" | "raw" | "separate" = "strip",
): string | { content: string; reasoning: string } {
  if (mode === "raw") {
    return content;
  }

  if (mode === "separate") {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const reasoning = thinkMatch[1].trim();
      const contentWithoutThink = content.replace(/<think>[\s\S]*?<\/think>/, "").trim();
      return {
        content: contentWithoutThink,
        reasoning: reasoning,
      };
    }
    return { content: content, reasoning: "" };
  }

  if (mode === "strip") {
    return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  if (mode === "thinking") {
    return content.replace(/<think>/g, "<thinking>").replace(/<\/think>/g, "</thinking>");
  }

  return content;
}

/**
 * Process streaming response and write to output
 */
export async function processStreamingResponse(
  body: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  modelName: string,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = "strip",
): Promise<Usage | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let finalUsage: Usage | null = null;
  let accumulatedThinking = "";

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
          if (dataStr === "" || dataStr === "[DONE]") continue;

          try {
            const upstreamData = JSON.parse(dataStr) as UpstreamData;

            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              logger.debug(
                "Captured usage: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens,
                finalUsage.completion_tokens,
                finalUsage.total_tokens,
              );
            }

            if (upstreamData.data.edit_content) {
              logger.debug("Received edit_content, length: %d", upstreamData.data.edit_content.length);

              if (thinkTagsMode === "separate") {
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                if (typeof transformed === "object" && transformed.reasoning) {
                  const reasoningChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { reasoning_content: transformed.reasoning },
                      finish_reason: null,
                    }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(reasoningChunk)}\n\n`));
                }

                if (typeof transformed === "object" && transformed.content && transformed.content.trim() !== "") {
                  const contentChunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: transformed.content },
                      finish_reason: null,
                    }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(contentChunk)}\n\n`));
                }
              } else {
                const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                const processedContent = typeof transformed === "string" ? transformed : transformed.content;

                if (processedContent && processedContent.trim() !== "") {
                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: processedContent },
                      finish_reason: null,
                    }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
            }

            if (upstreamData.data.delta_content && upstreamData.data.delta_content !== "") {
              const rawContent = upstreamData.data.delta_content;
              const isThinking = upstreamData.data.phase === "thinking";

              if (thinkTagsMode === "separate") {
                if (isThinking) {
                  accumulatedThinking += rawContent;
                } else {
                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: rawContent },
                      finish_reason: null,
                    }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } else {
                if (!isThinking) {
                  const chunk: OpenAIResponse = {
                    id: `chatcmpl-${Date.now()}`,
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: modelName,
                    choices: [{
                      index: 0,
                      delta: { content: rawContent },
                      finish_reason: null,
                    }],
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              }
            }

            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              logger.debug("Detected stream end signal");

              const endChunk: OpenAIResponse = {
                id: `chatcmpl-${Date.now()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: modelName,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                }],
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

/**
 * Collect full response for non-streaming mode
 */
export async function collectFullResponse(
  body: ReadableStream<Uint8Array>,
  thinkTagsMode: "strip" | "thinking" | "think" | "raw" | "separate" = "strip",
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

            if (upstreamData.data.usage) {
              finalUsage = upstreamData.data.usage;
              logger.debug(
                "Captured usage in non-streaming: prompt=%d, completion=%d, total=%d",
                finalUsage.prompt_tokens,
                finalUsage.completion_tokens,
                finalUsage.total_tokens,
              );
            }

            if (upstreamData.data.edit_content) {
              logger.debug("Received edit_content in non-streaming, length: %d", upstreamData.data.edit_content.length);

              if (thinkTagsMode === "separate") {
                if (!fullReasoning) {
                  const transformed = transformThinking(upstreamData.data.edit_content, thinkTagsMode);
                  if (typeof transformed === "object") {
                    fullReasoning = transformed.reasoning;
                    logger.debug("Extracted reasoning from edit_content, length: %d", fullReasoning.length);

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
                if (!isThinking) {
                  fullContent += rawContent;
                }
              }
            }

            if (upstreamData.data.done || upstreamData.data.phase === "done") {
              logger.debug("Detected completion signal, stopping collection");

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
