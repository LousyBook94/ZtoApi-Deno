# 🔬 Advanced

Technical implementation details and advanced configuration.

## 🧠 Thinking Content Processing

When thinking mode is enabled (`X-Feature-Thinking: true`), the server processes the model's reasoning content according to the specified mode. You have **two ways** to control this!

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
const THINK_TAGS_MODE = "separate"; // options: "strip", "thinking", "think", "raw", "separate"
```

**Note**: The `X-Think-Tags-Mode` header always overrides the server default!

### Available Modes

1. **`"strip"`** - Removes all thinking tags and shows only the clean final answer
2. **`"thinking"`** - Converts `<details>` tags to `<thinking>` tags
3. **`"think"`** - Converts `<details>` tags to `<think>` tags
4. **`"raw"`** - Preserves original `<details>` tags as-is
5. **`"separate"`** - Extracts reasoning into a separate `reasoning_content` field

### Use Case Recommendations

- **🧹 Production Apps**: Use `"strip"` for clean, user-friendly responses
- **🐛 Debugging**: Use `"thinking"` or `"raw"` to see the model's reasoning process
- **📚 Educational Tools**: Use `"separate"` to display reasoning and answers separately
- **🔍 Advanced Processing**: Use `"raw"` for custom parsing and analysis

## 🤝 Contributing

Want to help make ZtoApi even better? We'd love your help!

- Open issues and pull requests on the project repository

## 📜 License

This project is released under the MIT License. See LICENSE for details.

## 🙏 Acknowledgments

Special thanks to the amazing open-source community! This project was inspired by and includes code adapted from:

- **[claude-proxy](https://github.com/simpx/claude-proxy)** by [simpx](https://github.com/simpx) - Claude API proxy implementation patterns and Anthropic API structure. Their excellent work provided the foundation for our Claude API compatibility layer!

## 🌟 Key Contributors

**🚀 MASSIVE THANKS TO THE HEROES WHO SAVED THIS PROJECT:**

- **🏆 [@sarices (ZhengWeiDong)](https://github.com/sarices) - THE ABSOLUTE LEGEND**
  - **🎯 SINGLE-HANDEDLY FIXED Z.ai upstream authentication** - WITHOUT HIM THIS PROJECT WOULD BE BROKEN!
  - **⚡ IMPLEMENTED Base64 encoding signature algorithm** - Critical fix that restored ALL API functionality
  - **🛠️ RESOLVED the dreaded "502 Bad Gateway" errors** - Both OpenAI AND Anthropic endpoints now work flawlessly
  - **💡 PR**: [feat(api): update signature algorithm to align with upstream](https://github.com/roseforyou/ZtoApi/pull/6)
  - **🎖️ IMPACT**: This genius-level contribution literally SAVED the entire project!
  - **🏅 HERO STATUS**: ZhengWeiDong (Z.ai upstream fixing) - WE OWE YOU EVERYTHING!

_This man deserves a medal! Without @sarices, none of this would work!_

For more information, see the main [README](../README.md).
