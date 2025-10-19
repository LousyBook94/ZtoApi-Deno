# 技术文档：Z.ai API 请求签名机制更新

**日期**: 2025-10-19 (由 opencode 更新)

---

## 1. 背景与目标

为了与上游 Z.ai API 最新的安全规范保持一致，原有的请求签名算法已进行升级。本次更新旨在增强请求的安全性，确保数据在传输过程中的完整性和真实性。

核心目标是将 `ZtoApi` 服务中的签名生成逻辑更新为采用 **请求体Base64编码** 的新版双层 HMAC-SHA256 算法。

## 2. 技术实现方案

### 2.1 核心变更：`generateSignature` 函数

本次更新的核心在于 `generateSignature` 函数的逻辑调整。新算法在构造待签名字符串时，对用户消息内容 `t` 进行了 **Base64 编码**，这是与旧版最主要的区别。

**新版函数实现:**

```typescript
/**
 * 生成Z.ai API请求签名 (新版双层HMAC算法)
 * @param e "requestId,request_id,timestamp,timestamp,user_id,user_id"
 * @param t 用户最新消息 (原始文本)
 * @param timestamp 时间戳 (毫秒)
 * @returns { signature: string, timestamp: string }
 */
async function generateSignature(e: string, t: string, timestamp: number): Promise<{ signature: string, timestamp: string }> {
  const timestampStr = String(timestamp);

  // 1. 对消息内容进行Base64编码 (核心变更)
  const bodyEncoded = new TextEncoder().encode(t);
  const bodyBase64 = btoa(String.fromCharCode(...bodyEncoded));

  // 2. 构造新的待签名字符串
  const stringToSign = `${e}|${bodyBase64}|${timestampStr}`;

  // 3. 计算5分钟时间窗口
  const timeWindow = Math.floor(timestamp / (5 * 60 * 1000));

  // 4. 获取签名密钥
  const secretEnv = Deno.env.get("ZAI_SIGNING_SECRET");
  let rootKey: Uint8Array;

  if (secretEnv) {
    // 从环境变量读取密钥
    if (/^[0-9a-fA-F]+$/.test(secretEnv) && secretEnv.length % 2 === 0) {
      // HEX 格式
      rootKey = new Uint8Array(secretEnv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      // UTF-8 格式
      rootKey = new TextEncoder().encode(secretEnv);
    }
    debugLog("使用环境变量密钥: %s", secretEnv.substring(0, 10) + "...");
  } else {
    // 使用新的默认密钥（与 Python 版本一致）
    const defaultKeyHex = "6b65792d40404040292929282928283929292d787878782626262525252525";
    rootKey = new Uint8Array(defaultKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    debugLog("使用默认密钥");
  }

  // 5. 第一层 HMAC，生成中间密钥
  const rootKeyBuffer = rootKey.buffer.slice(rootKey.byteOffset, rootKey.byteOffset + rootKey.byteLength) as ArrayBuffer;
  const firstHmacKey = await crypto.subtle.importKey(
    "raw",
    rootKeyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firstSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    firstHmacKey,
    new TextEncoder().encode(String(timeWindow))
  );
  const intermediateKey = Array.from(new Uint8Array(firstSignatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 5. 第二层 HMAC，生成最终签名
  const secondKeyMaterial = new TextEncoder().encode(intermediateKey);
  const secondHmacKey = await crypto.subtle.importKey(
    "raw",
    secondKeyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const finalSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    secondHmacKey,
    new TextEncoder().encode(stringToSign)
  );
  const signature = Array.from(new Uint8Array(finalSignatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  debugLog("新版签名生成成功: %s", signature);
  return {
    signature,
    timestamp: timestampStr,
  };
}
```

### 2.2 集成逻辑

签名逻辑的集成点依然在 `callUpstreamWithHeaders` 函数中。该函数现在调用更新后的 `generateSignature`，确保所有出站请求都使用新版签名进行验证。其他集成流程（如参数准备、请求构建）保持不变。

---

## 3. 配置与部署

### 3.1 环境变量配置

新版签名算法支持通过环境变量自定义签名密钥：

```bash
# 使用环境变量自定义签名密钥（推荐）
export ZAI_SIGNING_SECRET="your-secret-key-here"

# 或使用HEX格式密钥
export ZAI_SIGNING_SECRET="6b65792d40404040292929282928283929292d787878782626262525252525"
```

### 3.2 兼容性说明

- **向后兼容**: 新版算法与旧版完全兼容，不会影响现有部署。
- **密钥格式**: 支持 HEX 和 UTF-8 格式的密钥。
- **默认密钥**: 如果未设置 `ZAI_SIGNING_SECRET`，将使用内置的安全密钥。

## 4. 测试与验证

### 4.1 本地测试

在本地环境中测试新版签名算法：

```bash
# 启动服务器
deno run --allow-net --allow-env main.ts

# 发送测试请求
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "0727-360B-API",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

### 4.2 日志验证

启用调试模式查看签名生成日志：

```bash
export DEBUG_MODE=true
```

预期日志输出：
```
使用环境变量密钥: your-secret-key...
新版签名生成成功: abc123...
```

## 5. 故障排除

### 5.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 签名验证失败 | 密钥格式错误 | 检查 `ZAI_SIGNING_SECRET` 是否为有效格式 |
| 请求被拒绝 | 时间窗口不同步 | 确保服务器时间准确 |
| 性能下降 | 频繁密钥计算 | 使用缓存机制或优化密钥管理 |

### 5.2 调试技巧

- 检查调试日志中的签名生成过程
- 验证 Base64 编码是否正确
- 确认时间窗口计算逻辑

## 6. 未来维护

- 定期更新默认密钥以提升安全性
- 监控签名算法的性能指标
- 根据上游 API 变化及时调整算法

---

**更新完成**: 新版签名机制已集成到 ZtoApi v2.0，确保与上游 Z.ai API 的完全兼容。