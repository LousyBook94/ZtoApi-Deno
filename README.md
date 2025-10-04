# ZtoApi - OpenAI-compatible API proxy server

![Deno](https://img.shields.io/badge/deno-v1.40+-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> ✅ **FIXED!** The output when thinking is enabled has been fixed, and a new "separate" tag mode has been added to separate the thinking from the final answer into a `reasoning_content` field at the same level as `content`. The regex patterns have been updated to properly handle multiline content, and support for the `edit_content` field has been implemented.

ZtoApi is a high-performance OpenAI-compatible API proxy that exposes Z.ai's GLM-4.5 and GLM-4.5V models via a standard OpenAI-style interface. Implemented with Deno's native HTTP API, it supports streaming and non-streaming responses and includes a real-time monitoring dashboard.

## Key Features

- OpenAI API compatible — use existing OpenAI clients without changes
- SSE streaming support for real-time token delivery
- **Advanced thinking content processing** with 4 different modes:
  - `"strip"` - Remove thinking tags, show only clean content
  - `"think"` - Convert `<details>` to `<thinking>` tags
  - `"raw"` - Keep original `<details>` tags as-is
  - `"separate"` - Extract thinking into separate `reasoning_content` field
- Built-in web Dashboard with live request stats
- API key authentication and optional anonymous token fallback
- Configurable via environment variables
- Deployable on Deno Deploy or self-hosted

## Supported Models

- 0727-360B-API — GLM-4.5 (text, code, tools)
- glm-4.5v — GLM-4.5V (full multimodal: image, video, document, audio)

## Model Capabilities

GLM-4.5 (0727-360B-API)
- Thinking/chain-of-thought display
- MCP tool calls
- Code generation
- No multimodal support

GLM-4.5V (glm-4.5v)
- Thinking display
- Image/video/document/audio understanding
- No MCP tool calls

> Important: Multimodal features require a valid Z.ai API token. Anonymous tokens do not support multimedia.

## Getting a Z.ai API Token

1. Visit https://chat.z.ai and sign up / log in.
2. Find your API token in the developer or account settings.
3. Set the token as the ZAI_TOKEN environment variable.

## Deployment

### Deno Deploy

- Push your repository containing main.ts to GitHub.
- Create a new project on Deno Deploy and connect the repo.
- Set environment variables (DEFAULT_KEY, ZAI_TOKEN, DEBUG_MODE, etc).

### Self-hosted / Local

Prerequisites: Install Deno.

Start locally:
deno run --allow-net --allow-env main.ts

Default port: 9090 (override with PORT env var)

### Optional: Compile or Docker

deno compile --allow-net --allow-env --output ztoapi main.ts

Dockerfile example:
FROM denoland/deno:1.40.0
WORKDIR /app
COPY main.ts .
EXPOSE 9090
CMD ["deno", "run", "--allow-net", "--allow-env", "main.ts"]

Build and run:
docker build -t ztoapi .
docker run -p 9090:9090 -e DEFAULT_KEY="sk-your-key" ztoapi

## Quick Local Test

curl http://localhost:9090/v1/models

curl -X POST http://localhost:9090/v1/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer sk-your-local-key" \
-d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Hello"}],"stream":false}'

## Environment Variables

- DEFAULT_KEY — API key for clients (default: sk-your-key)
- ZAI_TOKEN — official Z.ai API token (required for multimodal)
- UPSTREAM_URL — upstream Z.ai endpoint (default: https://chat.z.ai/api/chat/completions)
- DEBUG_MODE — enable debug logs (true/false, default: true)
- DEFAULT_STREAM — default streaming mode (true/false, default: true)
- DASHBOARD_ENABLED — enable dashboard (true/false, default: true)
- PORT — server port (default: 9090)

## API Endpoints

- GET / — homepage
- GET /v1/models — list available models
- POST /v1/chat/completions — main chat endpoint (OpenAI-compatible)
- GET /docs — API documentation page
- GET /dashboard — monitoring dashboard (if enabled)

Base path: http://localhost:9090/v1

## Feature Control Headers

You can control various model features using HTTP headers when making requests to the `/v1/chat/completions` endpoint. These headers override the default model capabilities.

### Available Headers

- `X-Feature-Thinking` — Enable/disable thinking mode (true/false)
- `X-Feature-Web-Search` — Enable/disable web search (true/false)
- `X-Feature-Auto-Web-Search` — Enable/disable automatic web search (true/false)
- `X-Feature-Image-Generation` — Enable/disable image generation (true/false)
- `X-Feature-Title-Generation` — Enable/disable title generation (true/false)
- `X-Feature-Tags-Generation` — Enable/disable tags generation (true/false)
- `X-Feature-MCP` — Enable/disable MCP (Model Context Protocol) tools (true/false)
- `X-Think-Tags-Mode` — **NEW!** Customize thinking content processing mode per request

### Usage Examples

Enable thinking mode:
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Explain quantum computing"}],"stream":false}'
```

Disable thinking mode:
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: false" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"What is 2+2?"}],"stream":false}'
```

Enable web search:
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Web-Search: true" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"What are the latest news about AI?"}],"stream":false}'
```

Multiple features at once:
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Feature-Web-Search: true" \
  -H "X-Feature-MCP: true" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Research and analyze current AI trends"}],"stream":false}'
```

### 🎉 NEW: Dynamic Think Tags Mode

The `X-Think-Tags-Mode` header allows you to customize how thinking content is processed **per request**, giving you complete control over the model's reasoning display format without restarting the server!

#### Available Modes

- `"strip"` - Remove `<details>` tags and show only the final content
- `"think"` - Convert `<details>` tags to `<thinking>` tags
- `"raw"` - Keep the content exactly as-is from the upstream
- `"separate"` - Separate reasoning into `reasoning_content` field (default)

#### Usage Examples

**Strip thinking content for clean responses:**
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: strip" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Explain quantum computing"}],"stream":false}'
```

**Convert to thinking tags for debugging:**
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: think" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Debug this code"}],"stream":true}'
```

**Get raw content for advanced processing:**
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: raw" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Analyze this complex problem"}]}'
```

**Separate reasoning for structured data:**
```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Feature-Thinking: true" \
  -H "X-Think-Tags-Mode: separate" \
  -d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Solve step by step"}]}'
```

**Python example with dynamic thinking mode:**
```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key", base_url="http://localhost:9090/v1")

response = client.chat.completions.create(
    model="0727-360B-API",
    messages=[{"role": "user", "content": "Explain black holes"}],
    extra_headers={
        "X-Feature-Thinking": "true",
        "X-Think-Tags-Mode": "separate"  # Get reasoning and content separately!
    }
)

print("Content:", response.choices[0].message.content)
print("Reasoning:", response.choices[0].message.reasoning_content)
```

#### Benefits

- **🔄 Per-Request Control**: Switch between modes without server restart
- **🎯 Use-Case Specific**: Choose the perfect format for your application
- **🐛 Debugging Friendly**: Use "think" or "raw" modes to see the model's reasoning
- **🧹 Clean Output**: Use "strip" mode for production-ready responses
- **📊 Structured Data**: Use "separate" mode for educational tools or analytics

Python example with headers:
```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key", base_url="http://localhost:9090/v1")

response = client.chat.completions.create(
    model="0727-360B-API",
    messages=[{"role": "user", "content": "Explain black holes"}],
    extra_headers={
        "X-Feature-Thinking": "true",
        "X-Feature-Web-Search": "false"
    }
)

print(response.choices[0].message.content)
```

### Header Value Format

All feature headers accept the following values (case-insensitive):
- `"true"` or `"1"` or `"yes"` — Enable the feature
- `"false"` or `"0"` or `"no"` — Disable the feature
- If not specified, the feature uses the model's default capability

Note: Some features are model-dependent. For example, MCP tools are only available on models that support them, and web search requires a valid Z.ai API token.

## Thinking Content Processing

When thinking mode is enabled (`X-Feature-Thinking: true`), the server processes the model's reasoning content according to the specified mode. You have **two ways** to control this:

### 🎯 Method 1: Per-Request Control (Recommended!)

Use the `X-Think-Tags-Mode` header to customize thinking content processing **per request**:

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "X-Think-Tags-Mode: separate" \
  # ... other headers and request body
```

### ⚙️ Method 2: Server Default Configuration

Set the default mode by modifying the `THINK_TAGS_MODE` constant in `main.ts`:

```typescript
const THINK_TAGS_MODE = "separate"; // options: "strip", "think", "raw", "separate"
```

**Note**: The `X-Think-Tags-Mode` header always overrides the server default!

### Available Modes

1. **`"strip"`** - Removes all thinking tags and shows only the clean final answer
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "The answer is 8. Here's how I calculated it: 5 + 3 = 8"
       }
     }]
   }
   ```

2. **`"think"`** - Converts `<details>` tags to `<thinking>` tags for better readability
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "<thinking>Let me solve this step by step: 5 + 3...</thinking>\n\nThe answer is 8."
       }
     }]
   }
   ```

3. **`"raw"`** - Preserves original `<details>` tags as-is
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "<details>Let me solve this step by step: 5 + 3...</details>\n\nThe answer is 8."
       }
     }]
   }
   ```

4. **`"separate"`** - Extracts reasoning into a separate `reasoning_content` field
   ```json
   {
     "choices": [{
       "message": {
         "role": "assistant",
         "content": "The answer is 8.",
         "reasoning_content": "Let me solve this step by step: 5 + 3 = 8. This is basic addition..."
       }
     }]
   }
   ```

### Use Case Recommendations

- **🧹 Production Apps**: Use `"strip"` for clean, user-friendly responses
- **🐛 Debugging**: Use `"think"` or `"raw"` to see the model's reasoning process
- **📚 Educational Tools**: Use `"separate"` to display reasoning and answers separately
- **🔍 Advanced Processing**: Use `"raw"` for custom parsing and analysis

The `"separate"` mode is particularly useful for applications that want to display reasoning and final answers separately, such as educational tools or debugging interfaces.

## Examples

Python (non-streaming)
from openai import OpenAI
client = OpenAI(api_key="your-api-key", base_url="http://localhost:9090/v1")
resp = client.chat.completions.create(model="0727-360B-API", messages=[{"role":"user","content":"Hello"}])
print(resp.choices[0].message.content)

cURL (streaming)
curl -X POST http://localhost:9090/v1/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer your-api-key" \
-d '{"model":"0727-360B-API","messages":[{"role":"user","content":"Write a short poem about spring"}],"stream":true}'

JavaScript (fetch)
async function chat(message, stream=false) {
const response = await fetch('http://localhost:9090/v1/chat/completions', {
method: 'POST',
headers: {'Content-Type':'application/json','Authorization':'Bearer your-api-key'},
body: JSON.stringify({model:'0727-360B-API', messages:[{role:'user', content:message}], stream})
});
if (stream) { /* handle SSE stream */ } else { const data = await response.json(); console.log(data.choices[0].message.content); }
}

## Troubleshooting

- 401 Unauthorized — check Authorization header format: "Authorization: Bearer your-key"
- 502 Bad Gateway — upstream Z.ai error or network issue; check UPSTREAM_URL and ZAI_TOKEN
- Streaming interrupted — network instability; set "stream": false to disable SSE
- Multimodal failures — ensure ZAI_TOKEN is set and media sizes/formats are supported

## Debugging

Enable verbose logs with DEBUG_MODE=true.

deno run --allow-net --allow-env main.ts

## Security tips

- Use a long, random DEFAULT_KEY
- Set DEBUG_MODE=false in production
- Rotate keys regularly

## Contributing

- Open issues and pull requests on the project repository

## License

This project is released under the MIT License. See LICENSE for details.

-- End
