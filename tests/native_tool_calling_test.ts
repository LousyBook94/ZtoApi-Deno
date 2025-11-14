/**
 * Native Tool Calling Tests
 * Tests for tool registry, validation, and execution
 */

import { assertEquals, assertExists, assertRejects, assertThrows } from "assert";
import { clearTools, executeTool, getAllTools, getTool, hasTool, registerTool } from "../src/services/tool-registry.ts";
import { getAvailableToolNames, validateTools } from "../src/utils/validation.ts";
import { detectToolCall, processToolCall } from "../src/services/tool-processor.ts";
import { initializeBuiltinTools } from "../src/services/init-tools.ts";
import type { Tool, UpstreamData } from "../src/types/definitions.ts";

// Test tool function
function testTool(args: { message: string }): string {
  return `Echo: ${args.message}`;
}

Deno.test("Tool Registry - Register and retrieve tools", () => {
  clearTools();

  // Register a test tool
  registerTool(
    "test_tool",
    (...args: unknown[]) => testTool(args[0] as { message: string }),
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
    (...args: unknown[]) => testTool(args[0] as { message: string }),
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
    (...args: unknown[]) => testTool(args[0] as { message: string }),
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

  assertThrows(
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

  assertThrows(
    () => validateTools(nonexistentTool, undefined, false), // Use strict validation for this test
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
    algorithm: "sha256",
  });
  assertEquals(typeof hashResult, "string");
  assertEquals((hashResult as string).length, 64); // SHA256 hash length

  // Test calculate_expression tool
  const calcResult = await executeTool("calculate_expression", {
    expression: "2 + 3 * 4",
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
      delta_content:
        '<function_calls>\n<invoke name="test_tool">\n<parameter name="message">hello</parameter>\n</invoke>\n</function_calls>',
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
    (...args: unknown[]) => testTool(args[0] as { message: string }),
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

  registerTool("tool1", (...args: unknown[]) => testTool(args[0] as { message: string }), "Tool 1", {});
  registerTool("tool2", (...args: unknown[]) => testTool(args[0] as { message: string }), "Tool 2", {});

  const names = getAvailableToolNames();
  assertEquals(names.length, 2);
  assertEquals(names.includes("tool1"), true);
  assertEquals(names.includes("tool2"), true);
});

Deno.test("Tool Registry - Clear tools", () => {
  clearTools();

  registerTool("test_tool", (...args: unknown[]) => testTool(args[0] as { message: string }), "Test tool", {});
  assertEquals(hasTool("test_tool"), true);

  clearTools();
  assertEquals(hasTool("test_tool"), false);
  assertEquals(getAllTools().length, 0);
});

Deno.test("Tool Validation - Missing required parameters", () => {
  clearTools();

  registerTool(
    "test_tool",
    (...args: unknown[]) => testTool(args[0] as { message: string }),
    "A test tool that echoes messages",
    {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  );

  const tools: Tool[] = [
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

  // Test with missing required parameter
  assertThrows(
    () => validateTools(tools, [{}]),
    Error,
    "Tool 'test_tool' is missing required parameter: 'message'",
  );

  // Test with wrong parameter type
  assertThrows(
    () => validateTools(tools, [{ message: 123 }]),
    Error,
    "Tool 'test_tool' parameter 'message' must be of type string, but received number",
  );
});

Deno.test("Tool Validation - Unknown tool names", () => {
  clearTools();

  const tools: Tool[] = [
    {
      type: "function",
      function: {
        name: "unknown_tool",
        description: "Unknown tool",
      },
    },
  ];

  assertThrows(
    () => validateTools(tools, undefined, false), // Use strict validation for this test
    Error,
    "Tool not found: unknown_tool. No tools are currently registered.",
  );
});

Deno.test("fetch_url Security - Block dangerous URLs", async () => {
  clearTools();
  initializeBuiltinTools();

  // Test file:// protocol
  await assertRejects(
    () => executeTool("fetch_url", { url: "file:///etc/passwd" }),
    Error,
    "Unsupported protocol: file:",
  );

  // Test localhost
  await assertRejects(
    () => executeTool("fetch_url", { url: "http://localhost:3000" }),
    Error,
    "Access to localhost is not allowed for security reasons.",
  );

  // Test private IP ranges
  await assertRejects(
    () => executeTool("fetch_url", { url: "http://192.168.1.1" }),
    Error,
    "Access to private IP range 192.168.1.1 is not allowed for security reasons.",
  );

  await assertRejects(
    () => executeTool("fetch_url", { url: "http://10.0.0.1" }),
    Error,
    "Access to private IP range 10.0.0.1 is not allowed for security reasons.",
  );

  await assertRejects(
    () => executeTool("fetch_url", { url: "http://172.16.0.1" }),
    Error,
    "Access to private IP range 172.16.0.1 is not allowed for security reasons.",
  );
});

Deno.test("Tool Call Detection - Malformed tool calls", () => {
  // Test malformed JSON
  const malformedJsonData: UpstreamData = {
    type: "content",
    data: {
      delta_content: '```json\n{"name": "test_tool", "arguments": {"message": "hello"\n```',
      phase: "content",
      done: false,
    },
  };

  const toolCall1 = detectToolCall(malformedJsonData);
  assertEquals(toolCall1, null);

  // Test malformed XML
  const malformedXmlData: UpstreamData = {
    type: "content",
    data: {
      delta_content:
        '<function_calls>\n<invoke name="test_tool">\n<parameter name="message">hello</parameter>\n</invoke>',
      phase: "content",
      done: false,
    },
  };

  const toolCall2 = detectToolCall(malformedXmlData);
  assertEquals(toolCall2, null);

  // Test malformed simple function call
  const malformedSimpleData: UpstreamData = {
    type: "content",
    data: {
      delta_content: 'function_call: test_tool("hello"',
      phase: "content",
      done: false,
    },
  };

  const toolCall3 = detectToolCall(malformedSimpleData);
  assertEquals(toolCall3, null);
});

Deno.test("Tool Execution - Error handling", async () => {
  clearTools();

  registerTool(
    "error_tool",
    (..._args: unknown[]) => {
      throw new Error("Test error");
    },
    "A tool that always throws an error",
    {},
  );

  await assertRejects(
    () => executeTool("error_tool", {}),
    Error,
    "Test error",
  );
});

Deno.test("calculate_expression Security - Block dangerous expressions", async () => {
  clearTools();
  initializeBuiltinTools();

  // Test code injection attempts
  await assertRejects(
    () => executeTool("calculate_expression", { expression: "process.exit(0)" }),
    Error,
    "Expression contains invalid characters",
  );

  await assertRejects(
    () => executeTool("calculate_expression", { expression: "require('fs')" }),
    Error,
    "Expression contains invalid characters",
  );

  await assertRejects(
    () => executeTool("calculate_expression", { expression: "console.log('hack')" }),
    Error,
    "Expression contains invalid characters",
  );

  // Test division by zero
  await assertRejects(
    () => executeTool("calculate_expression", { expression: "1/0" }),
    Error,
    "Failed to calculate expression",
  );
});

Deno.test("Streaming Tool Calls - Partial chunk handling", () => {
  clearTools();
  initializeBuiltinTools();

  // Test partial JSON tool call across multiple chunks
  const partialChunks = [
    '```json\n{"name": "get_current_time"',
    ', "arguments": {}}\n```',
  ];

  let toolCallBuffer = "";
  for (const chunk of partialChunks) {
    toolCallBuffer += chunk;

    const mockUpstreamData: UpstreamData = {
      type: "content",
      data: {
        delta_content: toolCallBuffer,
        phase: "content",
        done: false,
      },
    };

    const toolCall = detectToolCall(mockUpstreamData);
    if (toolCall) {
      assertEquals(toolCall.function.name, "get_current_time");
      break;
    }
  }

  // Test partial XML tool call
  const xmlChunks = [
    '<function_calls>\n<invoke name="hash_string">',
    '\n<parameter name="text">test</parameter>',
    "\n</invoke>\n</function_calls>",
  ];

  toolCallBuffer = "";
  for (const chunk of xmlChunks) {
    toolCallBuffer += chunk;

    const mockUpstreamData: UpstreamData = {
      type: "content",
      data: {
        delta_content: toolCallBuffer,
        phase: "content",
        done: false,
      },
    };

    const toolCall = detectToolCall(mockUpstreamData);
    if (toolCall) {
      assertEquals(toolCall.function.name, "hash_string");
      break;
    }
  }

  // Test partial simple function call
  const simpleChunks = [
    "function_call: calculate_expression(",
    '"2 + 2")',
  ];

  toolCallBuffer = "";
  for (const chunk of simpleChunks) {
    toolCallBuffer += chunk;

    const mockUpstreamData: UpstreamData = {
      type: "content",
      data: {
        delta_content: toolCallBuffer,
        phase: "content",
        done: false,
      },
    };

    const toolCall = detectToolCall(mockUpstreamData);
    if (toolCall) {
      assertEquals(toolCall.function.name, "calculate_expression");
      break;
    }
  }
});

Deno.test("Streaming Tool Calls - Malformed partial chunks", () => {
  // Test malformed JSON that shouldn't be detected
  const malformedJsonChunks = [
    '```json\n{"name": "test_tool"',
    ', "arguments": {"message": "hello"', // Missing closing braces
  ];

  let toolCallBuffer = "";
  for (const chunk of malformedJsonChunks) {
    toolCallBuffer += chunk;

    const mockUpstreamData: UpstreamData = {
      type: "content",
      data: {
        delta_content: toolCallBuffer,
        phase: "content",
        done: false,
      },
    };

    const toolCall = detectToolCall(mockUpstreamData);
    assertEquals(toolCall, null, "Malformed JSON should not be detected as tool call");
  }

  // Test malformed XML
  const malformedXmlChunks = [
    '<function_calls>\n<invoke name="test_tool">',
    '\n<parameter name="message">hello</parameter>', // Missing closing tags
  ];

  toolCallBuffer = "";
  for (const chunk of malformedXmlChunks) {
    toolCallBuffer += chunk;

    const mockUpstreamData: UpstreamData = {
      type: "content",
      data: {
        delta_content: toolCallBuffer,
        phase: "content",
        done: false,
      },
    };

    const toolCall = detectToolCall(mockUpstreamData);
    assertEquals(toolCall, null, "Malformed XML should not be detected as tool call");
  }
});
