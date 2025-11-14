# ✨ Features

Advanced features and configuration options for ZtoApi.

## 🛠️ Native Tool Calling System

ZtoApi includes a comprehensive native tool calling system that allows AI models to execute predefined server-side functions. This enables richer interactions beyond text generation.

### Built-in Tools

The following tools are available by default:

#### `get_current_time`

Returns the current UTC time in ISO 8601 format.

**Usage Example:**

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_time",
        "description": "Get current UTC time"
      }
    }
  ]
}
```

#### `fetch_url`

Fetches content from URLs (supports text and JSON responses).

**Parameters:**

- `url` (string, required) - URL to fetch
- `format` (string, optional) - Response format ("text" or "json")

**Usage Example:**

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "fetch_url",
        "description": "Fetch content from a URL",
        "parameters": {
          "type": "object",
          "properties": {
            "url": { "type": "string", "description": "URL to fetch" },
            "format": { "type": "string", "enum": ["text", "json"] }
          },
          "required": ["url"]
        }
      }
    }
  ]
}
```

#### `hash_string`

Calculates SHA256 or SHA1 hashes of text.

**Parameters:**

- `text` (string, required) - Text to hash
- `algorithm` (string, optional) - Hash algorithm ("sha256" or "sha1", default: "sha256")

**Usage Example:**

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "hash_string",
        "description": "Calculate hash of a string",
        "parameters": {
          "type": "object",
          "properties": {
            "text": { "type": "string", "description": "Text to hash" },
            "algorithm": { "type": "string", "enum": ["sha256", "sha1"] }
          },
          "required": ["text"]
        }
      }
    }
  ]
}
```

#### `calculate_expression`

Safely evaluates mathematical expressions.

**Parameters:**

- `expression` (string, required) - Mathematical expression to evaluate

**Usage Example:**

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "calculate_expression",
        "description": "Safely evaluate mathematical expressions",
        "parameters": {
          "type": "object",
          "properties": {
            "expression": { "type": "string", "description": "Mathematical expression" }
          },
          "required": ["expression"]
        }
      }
    }
  ]
}
```

### Tool Calling in Action

**Complete Request Example:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "GLM-4.5",
    "messages": [{"role": "user", "content": "What time is it and can you calculate 2+2?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_current_time",
          "description": "Get current UTC time"
        }
      },
      {
        "type": "function",
        "function": {
          "name": "calculate_expression",
          "description": "Calculate mathematical expressions",
          "parameters": {
            "type": "object",
            "properties": {
              "expression": {"type": "string"}
            },
            "required": ["expression"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### Adding Custom Tools

You can easily add custom tools by registering them in `src/services/init-tools.ts`:

```typescript
import { registerTool } from "./tool-registry.ts";

registerTool(
  "custom_tool",
  async function (args: { param: string }) {
    return `Processed: ${args.param}`;
  },
  "Custom tool description",
  {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
);
```

### Security Features

- **Whitelist-based registry**: Only registered tools can be executed
- **Input validation**: All tool parameters are validated against schemas
- **Sandboxed execution**: Tools run in a controlled environment
- **Error handling**: Tool failures don't crash the server

For complete documentation, see [Native Tool Calling](./native-tool-calling.md).

## 🎛️ Feature Control Headers

You can control various model features using HTTP headers when making requests to the `/v1/chat/completions` endpoint. These headers override the default model capabilities.

### Available Headers

- `X-Feature-Thinking` — Enable/disable thinking mode (true/false) 💭
- `X-Feature-Web-Search` — Enable/disable web search (true/false) 🔍
- `X-Feature-Auto-Web-Search` — Enable/disable automatic web search (true/false) 🤖
- `X-Feature-Image-Generation` — Enable/disable image generation (true/false) 🎨
- `X-Feature-Title-Generation` — Enable/disable title generation (true/false) 📝
- `X-Feature-Tags-Generation` — Enable/disable tags generation (true/false) 🏷️
- `X-Feature-MCP` — Enable/disable MCP (Model Context Protocol) tools (true/false) 🛠️
- `X-Think-Tags-Mode` — **NEW!** Customize thinking content processing mode per request ✨

### Usage Examples

**Enable thinking mode:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Explain quantum computing"}],"stream":false}'
```

**Disable thinking mode:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: false" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"What is 2+2?"}],"stream":false}'
```

**Enable web search:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Web-Search: true" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"What are the latest news about AI?"}],"stream":false}'
```

**Multiple features at once:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Feature-Web-Search: true" \
  -H "X-Feature-MCP: true" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Research and analyze current AI trends"}],"stream":false}'
```

## 🎉 NEW: Dynamic Think Tags Mode

The `X-Think-Tags-Mode` header allows you to customize how thinking content is processed **per request**, giving you complete control over the model's reasoning display format without restarting the server!

### Available Modes

- `"strip"` - Remove `<details>` tags and show only the final content 🧹
- `"thinking"` - Convert `<details>` tags to `<thinking>` tags 💭
- `"think"` - Convert `<details>` to `<think>` tags
- `"raw"` - Keep the content exactly as-is from the upstream 📄
- `"separate"` - Separate reasoning into `reasoning_content` field (default) 📊

### Usage Examples

**Strip thinking content for clean responses:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: strip" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Explain quantum computing"}],"stream":false}'
```

**Convert to thinking tags for debugging:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: thinking" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Debug this code"}],"stream":true}'
```

**Convert to simple think tags:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: think" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Debug this code"}],"stream":true}'
```

**Get raw content for advanced processing:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: raw" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Analyze this complex problem"}]}'
```

**Separate reasoning for structured data:**

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: separate" \
  -d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Solve step by step"}]}'
```

**Python example with dynamic thinking mode:**

```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key", base_url="http://localhost:9090/v1")

response = client.chat.completions.create(
    model="GLM-4-6-API-V1",
    messages=[{"role": "user", "content": "Explain black holes"}],
    extra_headers={
        "X-Feature-Thinking": "true",
        "X-Think-Tags-Mode": "separate"
    }
)

print("Content:", response.choices[0].message.content)
print("Reasoning:", response.choices[0].message.reasoning_content)
```

### Benefits

- **🔄 Per-Request Control**: Switch between modes without server restart
- **🎯 Use-Case Specific**: Choose the perfect format for your application
- **🐛 Debugging Friendly**: Use "thinking" or "raw" modes to see the model's reasoning
- **🧹 Clean Output**: Use "strip" mode for production-ready responses
- **📊 Structured Data**: Use "separate" mode for educational tools or analytics

## 🔐 Enhanced Security Features

### Dual-Layer HMAC-SHA256 Signature

ZtoApi now uses an advanced signature mechanism for all upstream requests:

- **Base64 Encoding**: Request bodies are Base64 encoded for secure transmission.
- **Dual-Layer HMAC**: Two-stage HMAC-SHA256 process for enhanced security.
- **Configurable Key**: Set `ZAI_SIGNING_SECRET` environment variable to customize the signature key.
- **Automatic Generation**: Signatures are generated automatically for each request.

### Token Pool Management

- **Automatic Token Handling**: Efficient management of API tokens with built-in pooling.
- **Anonymous Access**: Supports token fetching for unauthenticated requests.
- **Rotation and Reuse**: Tokens are rotated and reused to optimize performance and reliability.

These features ensure secure and efficient communication with the Z.ai API without requiring manual intervention.

For configuration details, see [Getting Started](../docs/getting-started.md) and [signature-update-guide.md](../signature-update-guide.md).

For more examples, see [Examples](../docs/examples.md).
