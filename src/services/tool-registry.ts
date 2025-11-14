/**
 * Tool Registry Service
 * Manages native tool functions that can be called by the AI
 */

import { logger } from "../utils/logger.ts";
import type { ToolFunction } from "../types/definitions.ts";

/**
 * Tool metadata interface
 */
export interface ToolMetadata {
  fn: (...args: unknown[]) => Promise<unknown> | unknown;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Global tool registry
 */
export const TOOL_REGISTRY: Record<string, ToolMetadata> = {};

/**
 * Register a new tool
 * @param name Tool name
 * @param fn Tool function implementation
 * @param description Tool description
 * @param parameters JSON schema for parameters
 */
export function registerTool(
  name: string,
  fn: (...args: unknown[]) => Promise<unknown> | unknown,
  description: string,
  parameters: Record<string, unknown>,
): void {
  if (TOOL_REGISTRY[name]) {
    logger.warn("Tool %s is already registered, overwriting", name);
  }

  TOOL_REGISTRY[name] = {
    fn,
    description,
    parameters,
  };

  logger.debug("Registered tool: %s", name);
}

/**
 * Get a tool by name
 * @param name Tool name
 * @returns Tool metadata or undefined if not found
 */
export function getTool(name: string): ToolMetadata | undefined {
  return TOOL_REGISTRY[name];
}

/**
 * Get all registered tools
 * @returns Array of tool names and their metadata
 */
export function getAllTools(): Array<{ name: string; metadata: ToolMetadata }> {
  return Object.entries(TOOL_REGISTRY).map(([name, metadata]) => ({
    name,
    metadata,
  }));
}

/**
 * Check if a tool exists
 * @param name Tool name
 * @returns True if tool exists
 */
export function hasTool(name: string): boolean {
  return name in TOOL_REGISTRY;
}

/**
 * Execute a tool by name with given arguments
 * @param name Tool name
 * @param args Tool arguments (already parsed from JSON)
 * @returns Tool execution result
 */
export async function executeTool(name: string, args: unknown): Promise<unknown> {
  const tool = getTool(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  const startTime = Date.now();
  logger.debug("Executing tool: %s with args: %s", name, JSON.stringify(args));

  try {
    const result = await tool.fn(args);
    const duration = Date.now() - startTime;
    logger.debug(
      "Tool %s executed successfully in %dms, result: %s",
      name,
      duration,
      JSON.stringify(result).substring(0, 200),
    );
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      "Tool %s failed after %dms: %v",
      name,
      duration,
      error,
    );
    throw error;
  }
}

/**
 * Clear all tools (useful for testing)
 */
export function clearTools(): void {
  Object.keys(TOOL_REGISTRY).forEach((key) => delete TOOL_REGISTRY[key]);
  logger.debug("Cleared all tools from registry");
}