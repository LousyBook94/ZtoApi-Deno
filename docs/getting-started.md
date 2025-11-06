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
- `DEFAULT_LANGUAGE` — default language for Accept-Language headers and date formatting (default: en-US, examples: zh-CN, fr-FR) 🌍
- `ZAI_SIGNING_SECRET` — custom key for request signature generation (optional, uses secure default if not set) 🔐

## 🔐 New Features and Configuration

### Enhanced Request Signature
ZtoApi now uses an updated dual-layer HMAC-SHA256 signature algorithm with Base64 encoding for enhanced security. Set `ZAI_SIGNING_SECRET` to customize the signature key. For detailed information, see [signature-update-guide.md](../signature-update-guide.md).

### Token Pool Management
The server includes automatic token pool management for handling API tokens efficiently, supporting anonymous access and token rotation. This feature is enabled by default and requires no additional configuration.

### Multimodal Support
Enhanced support for images, videos, documents, and audio in requests. Ensure `ZAI_TOKEN` is set for full multimodal capabilities.

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