/**
 * Native Tool Calling Tests
 * Tests for tool registry, validation, and execution
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { 
  registerTool, 
  getTool, 
  hasTool, 
  executeTool, 
  getAllTools, 
  clearTools 
} from "../src/services/tool-registry.ts";
import { validateTools, getAvailableToolNames } from "../src/utils/validation.ts";
import { detectToolCall, processToolCall } from "../src/services/tool-processor.ts";
import { initializeBuiltinTools } from "../src/services/init-tools.ts";
import type { Tool, UpstreamData } from "../src/types/definitions.ts";

// Test tool function
async function testTool(args: { message: string }): Promise<string> {
  return `Echo: ${args.message}`;
}

Deno.test("Tool Registry - Register and retrieve tools", () => {
  clearTools();
  
  // Register a test tool
  registerTool(
    "test_tool",
    testTool,
    "A test tool that echoes messages",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  );

  // Test tool exists
  assertEquals(hasTool("test_tool"), true);
  assertEquals(hasTool("nonexistent_tool"), false);

  // Test get tool
  const tool = getTool("test_tool");
  assertExists(tool);
  assertEquals(tool.description, "A test tool that echoes messages");
  assertEquals(typeof tool.fn, "function");

  // Test get all tools
  const allTools = getAllTools();
  assertEquals(allTools.length, 1);
  assertEquals(allTools[0].name, "test_tool");
});

Deno.test("Tool Registry - Execute tools", async () => {
  clearTools();
  
  registerTool(
    "test_tool",
    testTool,
    "A test tool that echoes messages",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  );

  // Test successful execution
  const result = await executeTool("test_tool", { message: "Hello World" });
  assertEquals(result, "Echo: Hello World");

  // Test execution of non-existent tool
  await assertRejects(
    () => executeTool("nonexistent_tool", {}),
    Error,
    "Tool not found: nonexistent_tool",
  );
});

Deno.test("Tool Validation - Validate tools array", () => {
  clearTools();
  
  // Register a test tool
  registerTool(
    "test_tool",
    testTool,
    "A test tool that echoes messages",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  );

  // Test valid tools array
  const validTools: Tool[] = [
    {
      type: "function",
      function: {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            message: { type: "string" },
          },
          required: ["message"],
        },
      },
    },
  ];

  // Should not throw
  validateTools(validTools);

  // Test invalid tool type
  const invalidToolType: Tool[] = [
    {
      type: "invalid" as "function",
      function: {
        name: "test_tool",
        description: "Test tool",
      },
    },
  ];

  assertRejects(
    () => validateTools(invalidToolType),
    Error,
    "Unsupported tool type: invalid",
  );

  // Test non-existent tool
  const nonexistentTool: Tool[] = [
    {
      type: "function",
      function: {
        name: "nonexistent_tool",
        description: "Non-existent tool",
      },
    },
  ];

  assertRejects(
    () => validateTools(nonexistentTool),
    Error,
    "Tool not found: nonexistent_tool",
  );
});

Deno.test("Built-in Tools - Initialize and test", async () => {
  clearTools();
  
  // Initialize built-in tools
  initializeBuiltinTools();

  // Test that built-in tools are registered
  assertEquals(hasTool("get_current_time"), true);
  assertEquals(hasTool("fetch_url"), true);
  assertEquals(hasTool("hash_string"), true);
  assertEquals(hasTool("calculate_expression"), true);

  // Test get_current_time tool
  const timeResult = await executeTool("get_current_time", {});
  assertExists(timeResult);
  assertEquals(typeof timeResult, "string");

  // Test hash_string tool
  const hashResult = await executeTool("hash_string", { 
    text: "test", 
    algorithm: "sha256" 
  });
  assertEquals(typeof hashResult, "string");
  assertEquals(hashResult.length, 64); // SHA256 hash length

  // Test calculate_expression tool
  const calcResult = await executeTool("calculate_expression", { 
    expression: "2 + 3 * 4" 
  });
  assertEquals(calcResult, 14);
});

Deno.test("Tool Call Detection - Detect various formats", () => {
  // Test JSON function call format
  const jsonData: UpstreamData = {
    type: "content",
    data: {
      delta_content: '```json\n{"name": "test_tool", "arguments": {"message": "hello"}}\n```',
      phase: "content",
      done: false,
    },
  };

  const toolCall1 = detectToolCall(jsonData);
  assertExists(toolCall1);
  assertEquals(toolCall1.function.name, "test_tool");
  assertEquals(toolCall1.type, "function");

  // Test XML function call format
  const xmlData: UpstreamData = {
    type: "content",
    data: {
      delta_content: '<function_calls>\n<invoke name="test_tool">\n<parameter name="message">hello</parameter>\n</invoke>\n</function_calls>',
      phase: "content",
      done: false,
    },
  };

  const toolCall2 = detectToolCall(xmlData);
  assertExists(toolCall2);
  assertEquals(toolCall2.function.name, "test_tool");

  // Test simple function call format
  const simpleData: UpstreamData = {
    type: "content",
    data: {
      delta_content: 'function_call: test_tool("hello")',
      phase: "content",
      done: false,
    },
  };

  const toolCall3 = detectToolCall(simpleData);
  assertExists(toolCall3);
  assertEquals(toolCall3.function.name, "test_tool");

  // Test no tool call
  const noToolData: UpstreamData = {
    type: "content",
    data: {
      delta_content: "This is just regular text",
      phase: "content",
      done: false,
    },
  };

  const toolCall4 = detectToolCall(noToolData);
  assertEquals(toolCall4, null);
});

Deno.test("Tool Call Processing - Process tool calls", async () => {
  clearTools();
  
  registerTool(
    "test_tool",
    testTool,
    "A test tool that echoes messages",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  );

  const toolCall = {
    id: "test_call_123",
    type: "function" as const,
    function: {
      name: "test_tool",
      arguments: JSON.stringify({ message: "Hello from test" }),
    },
  };

  const result = await processToolCall(toolCall);
  assertEquals(result, "Echo: Hello from test");
});

Deno.test("Tool Validation - Get available tool names", () => {
  clearTools();
  
  registerTool("tool1", testTool, "Tool 1", {});
  registerTool("tool2", testTool, "Tool 2", {});

  const names = getAvailableToolNames();
  assertEquals(names.length, 2);
  assertEquals(names.includes("tool1"), true);
  assertEquals(names.includes("tool2"), true);
});

Deno.test("Tool Registry - Clear tools", () => {
  clearTools();
  
  registerTool("test_tool", testTool, "Test tool", {});
  assertEquals(hasTool("test_tool"), true);
  
  clearTools();
  assertEquals(hasTool("test_tool"), false);
  assertEquals(getAllTools().length, 0);
});