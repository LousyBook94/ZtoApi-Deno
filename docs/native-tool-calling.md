# Native Tool Calling

ZtoApi now supports native tool calling, allowing the AI to execute predefined functions on the server side. This feature enables richer interactions beyond simple text generation.

## Overview

Native tool calling allows the AI model to request execution of specific functions that are registered on the server. When the model detects a need for a tool (like getting the current time, fetching a URL, or performing calculations), it can automatically invoke these functions and use the results in its response.

## Supported Tools

### Built-in Tools

The following tools are available by default:

#### `get_current_time`
Returns the current UTC time in ISO 8601 format.

**Parameters:** None

**Example:**
```json
{
  "name": "get_current_time",
  "arguments": {}
}
```

**Response:** `"2025-11-14T12:34:56.789Z"`

#### `fetch_url`
Fetches content from a URL. Supports both text and JSON responses.

**Parameters:**
- `url` (string, required): The URL to fetch content from

**Example:**
```json
{
  "name": "fetch_url",
  "arguments": {
    "url": "https://api.example.com/data"
  }
}
```

**Response:** The fetched content as a string (JSON responses are formatted).

#### `hash_string`
Calculates the hash of a string using various algorithms.

**Parameters:**
- `text` (string, required): The text to hash
- `algorithm` (string, optional): Hash algorithm - "sha256" (default) or "sha1"

**Example:**
```json
{
  "name": "hash_string",
  "arguments": {
    "text": "hello world",
    "algorithm": "sha256"
  }
}
```

**Response:** `"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"`

#### `calculate_expression`
Safely evaluates mathematical expressions.

**Parameters:**
- `expression` (string, required): Mathematical expression to evaluate

**Example:**
```json
{
  "name": "calculate_expression",
  "arguments": {
    "expression": "2 + 3 * 4"
  }
}
```

**Response:** `14`

## Usage

### OpenAI API Format

Include tools in your chat completion request:

```json
{
  "model": "glm-4.5",
  "messages": [
    {
      "role": "user",
      "content": "What time is it now?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_time",
        "description": "Get the current UTC time in ISO 8601 format"
      }
    }
  ],
  "tool_choice": "auto"
}
```

### Anthropic API Format

```json
{
  "model": "claude-3-haiku-20240307",
  "messages": [
    {
      "role": "user",
      "content": "What time is it now?"
    }
  ],
  "tools": [
    {
      "name": "get_current_time",
      "description": "Get the current UTC time in ISO 8601 format",
      "input_schema": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

## Tool Call Detection

The system automatically detects tool calls in the AI's response using multiple formats:

### JSON Format
```json
```json
{"name": "get_current_time", "arguments": {}}
```
```

### XML Format
```xml
<function_calls>
<invoke name="get_current_time">
</invoke>
</function_calls>
```

### Simple Format
```
function_call: get_current_time()
```

## Response Format

When a tool is executed, the response includes the tool call and result:

### OpenAI Response
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "glm-4.5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The current time is 2025-11-14T12:34:56.789Z",
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_current_time",
              "arguments": "{}"
            }
          }
        ]
      },
      "finish_reason": "stop"
    }
  ]
}
```

### Streaming Response

For streaming requests, tool calls are sent as separate chunks:

```json
{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1700000000,"model":"glm-4.5","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_abc123","type":"function","function":{"name":"get_current_time","arguments":"{}"}}]}}]}

{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1700000000,"model":"glm-4.5","choices":[{"index":0,"delta":{"content":"2025-11-14T12:34:56.789Z"}}]}
```

## Adding Custom Tools

You can extend the system with custom tools by modifying `src/services/init-tools.ts`:

```typescript
import { registerTool } from "./tool-registry.ts";

async function myCustomTool(args: { input: string }): Promise<string> {
  return `Processed: ${args.input}`;
}

registerTool(
  "my_custom_tool",
  myCustomTool,
  "Description of what this tool does",
  {
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "Input parameter description",
      },
    },
    required: ["input"],
  },
);
```

## Security Considerations

- Only registered tools can be executed
- Tool functions run in a sandboxed environment
- Input validation is performed before tool execution
- Network access is limited to specific approved operations
- File system access is restricted for security

## Error Handling

Tool execution errors are caught and returned as error messages:

```json
{
  "content": "Tool execution failed: Invalid URL format"
}
```

Common error scenarios:
- Tool not found
- Invalid parameters
- Network failures (for fetch_url)
- Invalid expressions (for calculate_expression)

## Monitoring and Metrics

Tool calls are tracked and can be monitored:

- Total tool calls made
- Success/failure rates per tool
- Execution time metrics
- Available via the dashboard and `/metrics` endpoint

## Examples

### Example 1: Getting Current Time
**User:** "What time is it now?"

**AI Response:** Automatically calls `get_current_time` and responds with the current time.

### Example 2: Web Content Analysis
**User:** "Can you fetch and summarize the content from https://example.com?"

**AI Response:** Uses `fetch_url` to get the content, then provides a summary.

### Example 3: Mathematical Calculations
**User:** "What is 15% of 250?"

**AI Response:** Uses `calculate_expression` with "250 * 0.15" and returns the result.

## Configuration

Tool calling can be controlled via:

- `tool_choice` parameter in OpenAI requests ("none", "auto", "required")
- Tool validation ensures only registered tools can be called
- Error handling prevents crashes from tool failures

## Limitations

- Only synchronous operations are supported (no async callbacks)
- Network requests have timeout limits
- Mathematical expressions are limited to basic operations
- File operations are restricted for security

## Troubleshooting

### Tool Not Found
Ensure the tool is registered in `init-tools.ts` and the server has been restarted.

### Validation Errors
Check that the tool parameters match the expected schema in the tool definition.

### Execution Failures
Review server logs for detailed error messages and ensure all dependencies are available.