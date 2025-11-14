/**
 * Tool Call Processor
 * Handles detection and execution of tool calls in upstream responses
 */

import { logger } from "../utils/logger.ts";
import { recordToolCall } from "../utils/stats.ts";
import { executeTool } from "./tool-registry.ts";
import type { ToolCall, UpstreamData } from "../types/definitions.ts";

/**
 * Check if upstream response contains a tool call
 * @param data Upstream response data
 * @returns Tool call object if found, null otherwise
 */
export function detectToolCall(data: UpstreamData): ToolCall | null {
  try {
    // Look for function call patterns in the delta_content
    const content = data.data?.delta_content || "";
    
    // Pattern 1: Look for JSON function call format
    const functionCallMatch = content.match(/```json\s*\n\s*(\{[^`]*\})\s*\n```/);
    if (functionCallMatch) {
      try {
        const functionCall = JSON.parse(functionCallMatch[1]);
        if (functionCall.name && functionCall.arguments) {
          return {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: "function",
            function: {
              name: functionCall.name,
              arguments: typeof functionCall.arguments === "string" 
                ? functionCall.arguments 
                : JSON.stringify(functionCall.arguments),
            },
          };
        }
      } catch (e) {
        logger.debug("Failed to parse function call JSON: %v", e);
      }
    }

    // Pattern 2: Look for <function_calls> tags (similar to the Python implementation)
    const functionCallsMatch = content.match(/<function_calls>\s*(.*?)\s*<\/function_calls>/s);
    if (functionCallsMatch) {
      try {
        const callsXml = functionCallsMatch[1];
        const invokeMatch = callsXml.match(/<invoke name="([^"]+)">\s*(<parameter[^>]*>.*?<\/parameter>\s*)*<\/invoke>/s);
        
        if (invokeMatch) {
          const toolName = invokeMatch[1];
          const parameters: Record<string, unknown> = {};
          
          // Extract parameters
          const paramMatches = callsXml.matchAll(/<parameter name="([^"]+)">([^<]*)<\/parameter>/g);
          for (const match of paramMatches) {
            parameters[match[1]] = match[2].trim();
          }
          
          return {
            id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: "function",
            function: {
              name: toolName,
              arguments: JSON.stringify(parameters),
            },
          };
        }
      } catch (e) {
        logger.debug("Failed to parse function calls XML: %v", e);
      }
    }

    // Pattern 3: Look for simple function call format
    const simpleMatch = content.match(/function_call:\s*(\w+)\s*\(([^)]*)\)/);
    if (simpleMatch) {
      const toolName = simpleMatch[1];
      const argsStr = simpleMatch[2].trim();
      
      // Try to parse arguments
      let args: Record<string, unknown> = {};
      if (argsStr) {
        try {
          // Try JSON parse first
          args = JSON.parse(argsStr);
        } catch {
          // Fall back to simple string argument
          args = { input: argsStr };
        }
      }
      
      return {
        id: `call_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: "function",
        function: {
          name: toolName,
          arguments: JSON.stringify(args),
        },
      };
    }

    return null;
  } catch (error) {
    logger.error("Error detecting tool call: %v", error);
    return null;
  }
}

/**
 * Execute a tool call and return the result
 * @param toolCall Tool call to execute
 * @returns Tool execution result
 */
export async function processToolCall(toolCall: ToolCall): Promise<string> {
  try {
    logger.info("Executing tool call: %s", toolCall.function.name);
    
    const args = JSON.parse(toolCall.function.arguments);
    const result = await executeTool(toolCall.function.name, args);
    
    // Convert result to string
    const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    
    logger.info("Tool call %s completed successfully", toolCall.function.name);
    recordToolCall(toolCall.function.name, true);
    return resultStr;
  } catch (error) {
    const errorMsg = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
    logger.error("Tool call %s failed: %v", toolCall.function.name, error);
    recordToolCall(toolCall.function.name, false);
    return errorMsg;
  }
}

/**
 * Create a tool result message for the response
 * @param toolCall Original tool call
 * @param result Tool execution result
 * @returns Tool result message
 */
export function createToolResultMessage(toolCall: ToolCall, result: string): {
  role: "tool";
  tool_call_id: string;
  content: string;
} {
  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: result,
  };
}

/**
 * Check if response should be intercepted for tool processing
 * @param data Upstream response data
 * @returns True if tool call detected and should be processed
 */
export function shouldInterceptForTools(data: UpstreamData): boolean {
  return detectToolCall(data) !== null;
}