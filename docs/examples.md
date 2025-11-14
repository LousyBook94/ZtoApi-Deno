# 💻 Examples

Usage examples for both OpenAI and Anthropic APIs.

## 🔥 **OpenAI API Examples**

### **Python (OpenAI SDK)**

```python
import openai

# Use any OpenAI client - works out of the box!
client = openai.OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:9090/v1"  # Point to ZtoApi
)

# Chat with GLM-4.6 (smartest model)
response = client.chat.completions.create(
    model="GLM-4-6-API-V1",
    messages=[{"role": "user", "content": "Hello! How are you?"}]
)
print(response.choices[0].message.content)

# Multimodal with GLM-4.5V
response = client.chat.completions.create(
    model="glm-4.5v",
    messages=[{
        "role": "user", 
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
    }]
)
```

### **cURL (OpenAI)**

```bash
# Non-streaming
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "GLM-4-6-API-V1",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'

# Streaming
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "GLM-4-6-API-V1", 
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

## 🎭 **Anthropic Claude API Examples**

### **Python (Anthropic SDK)**

```python
import anthropic

# Use official Anthropic client - works seamlessly!
client = anthropic.Anthropic(
    api_key="your-api-key",
    base_url="http://localhost:9090/anthropic/v1"  # Point to ZtoApi
)

# Latest Claude 4.5 Sonnet (REAL model - maps to GLM-4.6)
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",  # 🚀 REAL LATEST MODEL!
    max_tokens=1000,
    messages=[{"role": "user", "content": "Hello Claude 4.5!"}]
)
print(response.content[0].text)

# Latest Claude 4.1 Opus (REAL model - ultimate capability!)
response = client.messages.create(
    model="claude-opus-4-1-20250805",  # 🏆 REAL OPUS 4.1!
    max_tokens=1000,
    messages=[{"role": "user", "content": "Most capable Claude model!"}]
)

# New Claude 3.7 Sonnet (REAL model from Feb 2025)
response = client.messages.create(
    model="claude-3-7-sonnet-20250219",  # ⚡ NEW 3.7!
    max_tokens=1000,
    messages=[{"role": "user", "content": "Hello Claude 3.7!"}]
)

# Direct GLM access via Claude API!
response = client.messages.create(
    model="glm-4.6",  # 🎯 Direct GLM model access!
    max_tokens=1000,
    messages=[{"role": "user", "content": "You're GLM-4.6 via Claude API!"}]
)

# Multimodal with haiku models (map to GLM-4.5V)
response = client.messages.create(
    model="claude-3-5-haiku-20241022",
    max_tokens=1000,
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this image"},
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "..."}}
        ]
    }]
)
```

### **cURL (Anthropic)**

```bash
# Latest Claude 4.5 Sonnet (REAL model!)
curl -X POST http://localhost:9090/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Hello from REAL Claude 4.5!"}]
  }'

# Latest Claude 4.1 Opus (REAL ultimate model!)
curl -X POST http://localhost:9090/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-opus-4-1-20250805", 
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Most capable REAL Claude!"}]
  }'

# Direct GLM access via Anthropic API
curl -X POST http://localhost:9090/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "glm-4.6",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "GLM via Claude API!"}]
  }'

# Token counting with REAL Claude models
curl -X POST http://localhost:9090/anthropic/v1/messages/count_tokens \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [{"role": "user", "content": "Count my tokens!"}]
  }'

# Streaming with latest Claude 3.7
curl -X POST http://localhost:9090/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 1000,
    "stream": true,
    "messages": [{"role": "user", "content": "Stream me a story!"}]
  }'
```

### **JavaScript (Both APIs)**

```javascript
// OpenAI API
const openaiResponse = await fetch("http://localhost:9090/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key",
  },
  body: JSON.stringify({
    model: "GLM-4-6-API-V1",
    messages: [{ role: "user", content: "Hello OpenAI API!" }],
  }),
});

// Anthropic API - Latest REAL Claude 4.5!
const claudeResponse = await fetch("http://localhost:9090/anthropic/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "your-api-key",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5-20250929", // 🚀 REAL Latest model!
    max_tokens: 1000,
    messages: [{ role: "user", content: "Hello REAL Claude 4.5!" }],
  }),
});
```

## 🎯 **Which API Should You Use?**

- **🔥 OpenAI API**: If you have existing OpenAI integrations, ChatGPT clients, or OpenAI-based tools
- **🎭 Anthropic API**: If you use Claude Desktop, cline, cursor, or prefer Anthropic's format
- **🚀 Both work identically** - same GLM models, same performance, same features!
- **💡 Pro tip**: Try both! Some tools work better with different API formats

## 🛠️ **Tool Calling Examples**

### **Python (OpenAI SDK) - Tool Calling**

```python
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:9090/v1"
)

# Basic tool calling
response = client.chat.completions.create(
    model="GLM-4.5",
    messages=[{"role": "user", "content": "What time is it?"}],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_current_time",
                "description": "Get current UTC time"
            }
        }
    ],
    tool_choice="auto"
)

print(response.choices[0].message.content)

# Multiple tools
response = client.chat.completions.create(
    model="GLM-4.5",
    messages=[{"role": "user", "content": "Calculate 2+2 and hash 'hello'"}],
    tools=[
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
        },
        {
            "type": "function",
            "function": {
                "name": "hash_string",
                "description": "Calculate hash of a string",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "algorithm": {"type": "string", "enum": ["sha256", "sha1"]}
                    },
                    "required": ["text"]
                }
            }
        }
    ],
    tool_choice="auto"
)
```

### **cURL - Tool Calling**

```bash
# Time tool example
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "GLM-4.5",
    "messages": [{"role": "user", "content": "What time is it?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_current_time",
          "description": "Get current UTC time"
        }
      }
    ],
    "tool_choice": "auto"
  }'

# URL fetching tool example
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "GLM-4.5",
    "messages": [{"role": "user", "content": "Fetch the latest news from https://news.example.com"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "fetch_url",
          "description": "Fetch content from a URL",
          "parameters": {
            "type": "object",
            "properties": {
              "url": {"type": "string"},
              "format": {"type": "string", "enum": ["text", "json"]}
            },
            "required": ["url"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### **JavaScript - Tool Calling**

```javascript
// Tool calling with fetch
const response = await fetch("http://localhost:9090/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-api-key",
  },
  body: JSON.stringify({
    model: "GLM-4.5",
    messages: [{ role: "user", content: "Calculate 15 * 8" }],
    tools: [
      {
        type: "function",
        function: {
          name: "calculate_expression",
          description: "Calculate mathematical expressions",
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
            required: ["expression"],
          },
        },
      },
    ],
    tool_choice: "auto",
  }),
});

const result = await response.json();
console.log(result.choices[0].message.content);
```

### **Streaming with Tool Calling**

```python
# Streaming tool calls
stream = client.chat.completions.create(
    model="GLM-4.5",
    messages=[{"role": "user", "content": "What time is it and calculate 100/5?"}],
    tools=[
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
    tool_choice="auto",
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.tool_calls:
        print("Tool call:", chunk.choices[0].delta.tool_calls)
    elif chunk.choices[0].delta.content:
        print("Content:", chunk.choices[0].delta.content)
```

For more on features, see [Features](../docs/features.md) and [Native Tool Calling](./native-tool-calling.md).
