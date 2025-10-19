# 🔌 API Reference

Complete documentation for all ZtoApi endpoints.

## 🌐 API Endpoints Overview

### **OpenAI Compatible Endpoints** 🔥
```
GET  /v1/models                    # List available models
POST /v1/chat/completions          # Chat completions (streaming & non-streaming)
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

For detailed usage examples, see [Features](../docs/features.md) and [Examples](../docs/examples.md).