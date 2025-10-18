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
const openaiResponse = await fetch('http://localhost:9090/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    model: 'GLM-4-6-API-V1',
    messages: [{role: 'user', content: 'Hello OpenAI API!'}]
  })
});

// Anthropic API - Latest REAL Claude 4.5!
const claudeResponse = await fetch('http://localhost:9090/anthropic/v1/messages', {
  method: 'POST', 
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',  // 🚀 REAL Latest model!
    max_tokens: 1000,
    messages: [{role: 'user', content: 'Hello REAL Claude 4.5!'}]
  })
});
```

## 🎯 **Which API Should You Use?**

- **🔥 OpenAI API**: If you have existing OpenAI integrations, ChatGPT clients, or OpenAI-based tools
- **🎭 Anthropic API**: If you use Claude Desktop, cline, cursor, or prefer Anthropic's format
- **🚀 Both work identically** - same GLM models, same performance, same features!
- **💡 Pro tip**: Try both! Some tools work better with different API formats

For more on features, see [Features](../docs/features.md).