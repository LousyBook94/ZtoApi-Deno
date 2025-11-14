# 🤖 Models

Overview of supported models and their capabilities.

## 🔥 **OpenAI-Compatible API** → `/v1/` endpoints

**Base URL**: `http://localhost:9090/v1`

| Model ID         | GLM Model | Capabilities                           | Description                   |
| ---------------- | --------- | -------------------------------------- | ----------------------------- |
| `0727-360B-API`  | GLM-4.5   | Text, Code, Native Tools, MCP          | Balanced performance model 📝 |
| `GLM-4-6-API-V1` | GLM-4.6   | Text, Code, Native Tools, MCP          | **🧠✨ Smartest model!**      |
| `glm-4.5v`       | GLM-4.5V  | Multimodal (Image, Video, Audio, Docs) | 🎥🖼️🎵 Full multimodal        |

## 🎭 **Anthropic Claude-Compatible API** → `/anthropic/v1/` endpoints

**Base URL**: `http://localhost:9090/anthropic/v1`

**ALL real Claude models + direct GLM access supported!**

### 🚀 **Latest Claude 4.x Models** (2025 - Most Advanced!)

| Claude Model                 | → GLM Model      | Date     | Description                        |
| ---------------------------- | ---------------- | -------- | ---------------------------------- |
| `claude-sonnet-4-5-20250929` | `GLM-4-6-API-V1` | Sep 2025 | **🚀 LATEST! Sonnet 4.5**          |
| `claude-opus-4-1-20250805`   | `GLM-4-6-API-V1` | Aug 2025 | **🏆 LATEST! Opus 4.1 - Ultimate** |
| `claude-opus-4-20250514`     | `GLM-4-6-API-V1` | May 2025 | **🏆 Opus 4.0**                    |
| `claude-sonnet-4-20250514`   | `GLM-4-6-API-V1` | May 2025 | **🎯 Sonnet 4.0**                  |

### ⚡ **Claude 3.x Models** (Current & Previous Gen)

| Claude Model                 | → GLM Model      | Date     | Description                      |
| ---------------------------- | ---------------- | -------- | -------------------------------- |
| `claude-3-7-sonnet-20250219` | `GLM-4-6-API-V1` | Feb 2025 | **⚡ NEW! Claude 3.7 Sonnet**    |
| `claude-3-5-haiku-20241022`  | `glm-4.5v`       | Oct 2024 | **🚀 Latest Haiku - Multimodal** |
| `claude-3-5-sonnet-20241022` | `GLM-4-6-API-V1` | Oct 2024 | Claude 3.5 Sonnet (Oct)          |
| `claude-3-5-sonnet-20240620` | `GLM-4-6-API-V1` | Jun 2024 | Claude 3.5 Sonnet (June)         |
| `claude-3-haiku-20240307`    | `glm-4.5v`       | Mar 2024 | Claude 3 Haiku - Fast            |
| `claude-3-sonnet-20240229`   | `0727-360B-API`  | Feb 2024 | Claude 3 Sonnet - Balanced       |
| `claude-3-opus-20240229`     | `GLM-4-6-API-V1` | Feb 2024 | Claude 3 Opus - Powerful         |

### 🔗 **Generic Model Names** (Auto-Latest)

| Claude Model        | → GLM Model      | Description               |
| ------------------- | ---------------- | ------------------------- |
| `claude-4.5-sonnet` | `GLM-4-6-API-V1` | Latest Sonnet 4.5         |
| `claude-4.1-opus`   | `GLM-4-6-API-V1` | Latest Opus 4.1           |
| `claude-4-opus`     | `GLM-4-6-API-V1` | Latest Opus 4.x           |
| `claude-4-sonnet`   | `GLM-4-6-API-V1` | Latest Sonnet 4.x         |
| `claude-3.7-sonnet` | `GLM-4-6-API-V1` | Claude 3.7 generic        |
| `claude-3-haiku`    | `glm-4.5v`       | Latest haiku (multimodal) |
| `claude-3-sonnet`   | `GLM-4-6-API-V1` | Latest 3.x sonnet         |
| `claude-3-opus`     | `GLM-4-6-API-V1` | Claude 3 opus             |

### 🎯 **Direct GLM Model Access** (Via Claude API!)

**Use GLM models directly through the Anthropic API format:**

| GLM Model Name         | → GLM Model      | Description                               |
| ---------------------- | ---------------- | ----------------------------------------- |
| `glm-4.6`              | `GLM-4-6-API-V1` | **🧠 Smartest GLM model direct access**   |
| `glm-4.5`              | `0727-360B-API`  | **📝 Balanced GLM model direct access**   |
| `glm-4.5v`             | `glm-4.5v`       | **🎥 Multimodal GLM model direct access** |
| `glm4.6` / `glm_4.6`   | `GLM-4-6-API-V1` | Alternative naming variants               |
| `glm4.5` / `glm_4.5`   | `0727-360B-API`  | Alternative naming variants               |
| `glm4.5v` / `glm_4.5v` | `glm-4.5v`       | Alternative naming variants               |

**🎉 30+ supported model names! All REAL Claude models + direct GLM access!**

## 🎯 Model Capabilities

### GLM-4.5 (0727-360B-API) 🧠

- Thinking/chain-of-thought display 💭
- MCP tool calls 🛠️
- **Native tool calling support** 🛠️
- Code generation 💻
- No multimodal support 🚫

### GLM-4.6 (GLM-4-6-API-V1) 🌟 **NEW!**

- **Super smart and intelligent!** 🧠✨
- Thinking/chain-of-thought display 💭
- MCP tool calls 🛠️
- **Native tool calling support** 🛠️
- Code generation 💻
- **All the amazing features of GLM-4.5 but even smarter!** 🚀
- No multimodal support 🚫
- **Huge context window (195K tokens!)** 📚

### GLM-4.5V (glm-4.5v) 🌈

- Thinking display 💭
- Image/video/document/audio understanding 🎥🖼️🎵
- No MCP tool calls 🚫
- **Limited native tool calling support** (basic tools available) 🛠️

> 💡 **Important**: Multimodal features require a valid Z.ai API token. Anonymous tokens don't support multimedia.

> 🌟 **Pro tip**: GLM-4.6 is the smartest model with the largest context window! Perfect for complex tasks!

## 🛠️ Tool Calling Support by Model

### Native Tool Calling

ZtoApi provides native tool calling that works across all models:

- **GLM-4.5 & GLM-4.6**: Full native tool calling support with all built-in tools
- **GLM-4.5V**: Basic tool calling support (time, hash, calculate, fetch)
- **All Claude models**: Full tool calling support via OpenAI-compatible interface

### Built-in Tools Available

- `get_current_time` - Current UTC time
- `fetch_url` - Fetch web content
- `hash_string` - Calculate SHA256/SHA1 hashes
- `calculate_expression` - Safe math evaluation

### MCP Tool Support

- **GLM-4.5 & GLM-4.6**: Full MCP (Model Context Protocol) tool support
- **GLM-4.5V**: No MCP support
- **Claude models**: MCP support varies by model version

For complete tool calling documentation, see [Native Tool Calling](./native-tool-calling.md).

For more on features, see [Features](../docs/features.md).
