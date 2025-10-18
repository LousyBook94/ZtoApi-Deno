# 🚀 Getting Started

This guide will help you set up ZtoApi and make your first API call.

## 🔑 Getting a Z.ai API Token

1. 🌐 Visit https://chat.z.ai and sign up / log in
2. 🔍 Find your API token in the developer or account settings
3. ⚙️ Set the token as the ZAI_TOKEN environment variable

## ⚙️ Environment Variables

Customize your experience with these settings:

- `DEFAULT_KEY` — API key for clients (default: sk-your-key) 🔑
- `ZAI_TOKEN` — official Z.ai API token (required for multimodal) 🎟️
- `UPSTREAM_URL` — upstream Z.ai endpoint (default: https://chat.z.ai/api/chat/completions) 🔗
- `DEBUG_MODE` — enable debug logs (true/false, default: true) 🐛
- `DEFAULT_STREAM` — default streaming mode (true/false, default: true) 🌊
- `DASHBOARD_ENABLED` — enable dashboard (true/false, default: true) 📊
- `PORT` — server port (default: 9090) 🌐

## 🧪 Quick Local Test

Let's test it out!

**OpenAI API:**
```bash
curl http://localhost:9090/v1/models
```

```bash
curl -X POST http://localhost:9090/v1/chat/completions \
-H "Content-Type: application/json" \
-H "Authorization: Bearer sk-your-local-key" \
-d '{"model":"GLM-4-6-API-V1","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

**Claude API:**
```bash
curl http://localhost:9090/anthropic/v1/models
```

```bash
curl -X POST http://localhost:9090/anthropic/v1/messages \
-H "Content-Type: application/json" \
-H "x-api-key: sk-your-local-key" \
-d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello Claude!"}]}'
```

For more examples, see [Examples](../docs/examples.md).