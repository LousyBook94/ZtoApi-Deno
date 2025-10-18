# 🚀 ZtoApi - OpenAI & Anthropic Claude Compatible API Proxy! 🌟

> ✅ **FULLY IMPLEMENTED** - Complete OpenAI AND Anthropic Claude API support with dual endpoints!

![Deno](https://img.shields.io/badge/deno-v1.40+-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

> 🎓 For personal, non-commercial or educational use only. Please use responsibly! 🌈

Hey there! 👋 Welcome to ZtoApi - your ultimate dual-API proxy that brings Z.ai's amazing GLM models to life through BOTH OpenAI AND Anthropic Claude compatible interfaces! ✨ Built with Deno's awesome native HTTP API, it supports streaming/non-streaming responses for both APIs, plus comes with a real-time monitoring dashboard! 😍

## 🎯 **DUAL API SUPPORT** - Use Either Format!

### 🔥 **OpenAI Compatible** → `/v1/` endpoints
### 🎭 **Anthropic Claude Compatible** → `/anthropic/v1/` endpoints

**Use your existing OpenAI OR Claude clients without any changes!** 🚀

## 🌟 Key Features

- 🔄 **OpenAI API fully compatible** — use your existing OpenAI clients seamlessly! 🎯
- 🎭 **Anthropic Claude API fully compatible** — use Claude Desktop, cline, cursor, and any Claude tools! 🤖
- 🌊 **SSE streaming support** for both APIs - real-time token delivery! ✨
- 🧠 **Advanced thinking content processing** with 5 amazing modes
- 📊 **Built-in web Dashboard** with live request stats for both APIs! 🎨
- 🔐 **API key authentication** with optional anonymous token fallback 🛡️
- ⚙️ **Configurable via environment variables** - make it yours! 🎛️
- 🚀 **Deployable on Deno Deploy or self-hosted** - your choice! 🏠

## 🤖 Supported Models

See [Models](./docs/models.md) for a complete list of supported models and their capabilities.

## 🔌 **API Endpoints Overview**

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
- OpenAI: http://localhost:9090/v1 🌐
- Claude: http://localhost:9090/anthropic/v1 🎭

## 🚀 Quick Start

1. **Get a Z.ai API Token**: Visit https://chat.z.ai and get your token
2. **Set Environment Variables**: Configure `ZAI_TOKEN` and other settings
3. **Run Locally**: `deno run --allow-net --allow-env --allow-read main.ts`

For detailed setup instructions, see [Getting Started](./docs/getting-started.md).

## 📚 Detailed Documentation

For comprehensive information, see our detailed documentation:

- [🚀 Getting Started](./docs/getting-started.md) - Setup and first steps
- [🚀 Deployment](./docs/deployment.md) - Cloud and local deployment
- [🔌 API Reference](./docs/api-reference.md) - Complete API documentation
- [🤖 Models](./docs/models.md) - Model capabilities and mappings
- [✨ Features](./docs/features.md) - Advanced features and configuration
- [💻 Examples](./docs/examples.md) - Usage examples with multiple languages
- [🔧 Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions
- [🔬 Advanced](./docs/advanced.md) - Technical implementation details

## 🤝 Contributing

Want to help make ZtoApi even better? We'd love your help! 💪

- Open issues and pull requests on the project repository 🎉

## 📜 License

This project is released under the MIT License. See LICENSE for details. 📄

---

## 🌈 Thanks for reading!

Hope you enjoy using ZtoApi as much as we enjoyed building it! If you have any questions or feedback, don't hesitate to reach out! 🤗✨

Happy coding! (´｡• ᵕ •｡`) 💖

## 🙏 Acknowledgments

Special thanks to the amazing open-source community! This project was inspired by and includes code adapted from:

- **[claude-proxy](https://github.com/simpx/claude-proxy)** by [simpx](https://github.com/simpx) - Claude API proxy implementation patterns and Anthropic API structure. Their excellent work provided the foundation for our Claude API compatibility layer! 🎭✨

## 🌟 Key Contributors

**🚀 MASSIVE THANKS TO THE HEROES WHO SAVED THIS PROJECT:**

- **🏆 [@sarices (ZhengWeiDong)](https://github.com/sarices) - THE ABSOLUTE LEGEND** 🔥🔥🔥
  - **🎯 SINGLE-HANDEDLY FIXED Z.ai upstream authentication** - WITHOUT HIM THIS PROJECT WOULD BE BROKEN!
  - **⚡ IMPLEMENTED Base64 encoding signature algorithm** - Critical fix that restored ALL API functionality
  - **🛠️ RESOLVED the dreaded "502 Bad Gateway" errors** - Both OpenAI AND Anthropic endpoints now work flawlessly  
  - **💡 PR**: [feat(api): update signature algorithm to align with upstream](https://github.com/roseforyou/ZtoApi/pull/6)
  - **🎖️ IMPACT**: This genius-level contribution literally SAVED the entire project! 🙌✨
  - **🏅 HERO STATUS**: ZhengWeiDong (Z.ai upstream fixing) - WE OWE YOU EVERYTHING! 🎉

*This man deserves a medal! Without @sarices, none of this would work! 🏆*
