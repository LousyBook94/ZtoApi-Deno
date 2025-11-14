# 🔌 API Reference

Complete documentation for all ZtoApi endpoints.

## 🌐 API Endpoints Overview

### **OpenAI Compatible Endpoints** 🔥

```
GET  /v1/models                    # List available models
POST /v1/chat/completions          # Chat completions (streaming & non-streaming)
                                     # Supports tool calling with `tools` parameter
```

### **Anthropic Claude Compatible Endpoints** 🎭

```
GET  /anthropic/v1/models          # List available Claude models
POST /anthropic/v1/messages        # Messages (streaming & non-streaming)  
POST /anthropic/v1/messages/count_tokens  # Count tokens in messages
```

### **Dashboard & Monitoring** 📊

```
GET  /                             # Welcome page & overview
GET  /dashboard                    # Real-time API monitoring dashboard
GET  /docs                         # API documentation
```

Base paths:

- OpenAI: http://localhost:9090/v1
- Claude: http://localhost:9090/anthropic/v1

## 🎛️ Feature Control Headers

You can control various model features using HTTP headers when making requests to the `/v1/chat/completions` endpoint.

### Available Headers

- `X-Feature-Thinking` — Enable/disable thinking mode (true/false) 💭
- `X-Feature-Web-Search` — Enable/disable web search (true/false) 🔍
- `X-Feature-Auto-Web-Search` — Enable/disable automatic web search (true/false) 🤖
- `X-Feature-Image-Generation` — Enable/disable image generation (true/false) 🎨
- `X-Feature-Title-Generation` — Enable/disable title generation (true/false) 📝
- `X-Feature-Tags-Generation` — Enable/disable tags generation (true/false) 🏷️
- `X-Feature-MCP` — Enable/disable MCP (Model Context Protocol) tools (true/false) 🛠️
- `X-Think-Tags-Mode` — Customize thinking content processing mode per request ✨

### Header Value Format

All feature headers accept the following values (case-insensitive):

- `"true"` or `"1"` or `"yes"` — Enable the feature ✅
- `"false"` or `"0"` or `"no"` — Disable the feature ❌
- If not specified, the feature uses the model's default capability

Note: Some features are model-dependent. For example, MCP tools are only available on models that support them, and web search requires a valid Z.ai API token.

## 🔐 Security and Authentication

### Request Signature

All requests to the upstream Z.ai API are signed using a dual-layer HMAC-SHA256 algorithm with Base64 encoding for enhanced security. The signature is generated automatically and included in the request headers.

### Token Pool Management

ZtoApi includes built-in token pool management for efficient handling of API tokens, supporting anonymous access and automatic token rotation. This ensures reliable operation without manual intervention.

For detailed configuration, see [Getting Started](../docs/getting-started.md) and [signature-update-guide.md](../signature-update-guide.md).

## 🛠️ Tool Calling Parameters

### OpenAI Chat Completions Tool Support

The `/v1/chat/completions` endpoint supports OpenAI-compatible tool calling with the following parameters:

#### `tools` (array, optional)

A list of tools the model may call. Currently, only `function` type is supported.

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "Tool description",
    "parameters": {
      "type": "object",
      "properties": {
        "param1": {
          "type": "string",
          "description": "Parameter description"
        }
      },
      "required": ["param1"]
    }
  }
}
```

#### `tool_choice` (string/object, optional)

Controls how the model uses tools:

- `"auto"` (default) - Model decides whether to call tools
- `"none"` - Model will not call any tools
- `{"type": "function", "function": {"name": "tool_name"}}` - Force specific tool

### Built-in Tools

The following tools are available by default:

#### `get_current_time`

Returns the current UTC time.

**Parameters:** None
**Returns:** Current timestamp in ISO 8601 format

#### `fetch_url`

Fetches content from a URL.

**Parameters:**

- `url` (string, required) - URL to fetch
- `format` (string, optional) - Response format ("text" or "json")

**Returns:** Content from the URL

#### `hash_string`

Calculates hash of a string.

**Parameters:**

- `text` (string, required) - Text to hash
- `algorithm` (string, optional) - Hash algorithm ("sha256" or "sha1", default: "sha256")

**Returns:** Hexadecimal hash value

#### `calculate_expression`

Safely evaluates mathematical expressions.

**Parameters:**

- `expression` (string, required) - Mathematical expression to evaluate

**Returns:** Calculated result

### Tool Call Response Format

When the model calls tools, the response includes:

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [{
        "id": "call_123",
        "type": "function",
        "function": {
          "name": "tool_name",
          "arguments": "{\"param1\": \"value1\"}"
        }
      }]
    }
  }]
}
```

### Tool Result Format

After tool execution, results are sent back as:

```json
{
  "role": "tool",
  "content": "Tool execution result",
  "tool_call_id": "call_123"
}
```

For detailed usage examples, see [Features](../docs/features.md), [Examples](../docs/examples.md), and [Native Tool Calling](./native-tool-calling.md).
