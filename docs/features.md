# ✨ Features

Advanced features and configuration options for ZtoApi.

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

For more examples, see [Examples](../docs/examples.md).