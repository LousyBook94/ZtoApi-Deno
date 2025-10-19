# Technical Documentation: Z.ai API Request Signature Mechanism Update

**Date**: 2025-10-19 (Updated by opencode)

---

## 1. Background and Objectives

To align with the latest security standards of the upstream Z.ai API, the existing request signature algorithm has been upgraded. This update aims to enhance request security, ensuring data integrity and authenticity during transmission.

The core objective is to update the signature generation logic in the ZtoApi service to use the new dual-layer HMAC-SHA256 algorithm with **Base64 encoding of the request body**.

## 2. Technical Implementation Plan

### 2.1 Core Changes: `generateSignature` Function

The core of this update lies in the logic adjustment of the `generateSignature` function. The new algorithm performs **Base64 encoding** on the user message content `t` when constructing the string to sign, which is the main difference from the old version.

**New Version Function Implementation:**

```typescript
/**
 * Generate Z.ai API Request Signature (New Dual-Layer HMAC Algorithm)
 * @param e "requestId,request_id,timestamp,timestamp,user_id,user_id"
 * @param t Latest User Message (Raw Text)
 * @param timestamp Timestamp (milliseconds)
 * @returns { signature: string, timestamp: string }
 */
async function generateSignature(e: string, t: string, timestamp: number): Promise<{ signature: string, timestamp: string }> {
  const timestampStr = String(timestamp);

   // 1. Base64 Encode Message Content (Core Change)
   const bodyEncoded = new TextEncoder().encode(t);
   const bodyBase64 = btoa(String.fromCharCode(...bodyEncoded));

   // 2. Construct New String to Sign
   const stringToSign = `${e}|${bodyBase64}|${timestampStr}`;

   // 3. Calculate 5-Minute Time Window
   const timeWindow = Math.floor(timestamp / (5 * 60 * 1000));

   // 4. Obtain Signature Key
   const secretEnv = Deno.env.get("ZAI_SIGNING_SECRET");
   let rootKey: Uint8Array;

   if (secretEnv) {
     // Read Key from Environment Variable
     if (/^[0-9a-fA-F]+$/.test(secretEnv) && secretEnv.length % 2 === 0) {
       // HEX Format
       rootKey = new Uint8Array(secretEnv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
     } else {
       // UTF-8 Format
       rootKey = new TextEncoder().encode(secretEnv);
     }
     debugLog("Using environment variable key: %s", secretEnv.substring(0, 10) + "...");
   } else {
     // Using New Default Key (Consistent with Python Version)
     const defaultKeyHex = "6b65792d40404040292929282928283929292d787878782626262525252525";
     rootKey = new Uint8Array(defaultKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
     debugLog("Using default key");
   }

   // 5. First Layer HMAC, Generate Intermediate Key
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

   // 5. Second Layer HMAC, Generate Final Signature
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

   debugLog("New version signature generated successfully: %s", signature);
  return {
    signature,
    timestamp: timestampStr,
  };
}
```

### 2.2 Integration Logic

The integration point for the signature logic is still in the `callUpstreamWithHeaders` function. This function now calls the updated `generateSignature` to ensure all outbound requests use the new signature for verification. Other integration processes (such as parameter preparation, request construction) remain unchanged.

---

## 3. Configuration and Deployment

### 3.1 Environment Variable Configuration

The new signature algorithm supports customizing the signature key via environment variables:

```bash
# Customize Signature Key Using Environment Variable (Recommended)
export ZAI_SIGNING_SECRET="your-secret-key-here"

# Or Use HEX Format Key
export ZAI_SIGNING_SECRET="6b65792d40404040292929282928283929292d787878782626262525252525"
```

### 3.2 Compatibility Notes

- **Backward Compatibility**: The new algorithm is fully compatible with the old version and will not affect existing deployments.
- **Key Format**: Supports HEX and UTF-8 format keys.
- **Default Key**: If `ZAI_SIGNING_SECRET` is not set, a built-in secure key will be used.

## 4. Testing and Verification

### 4.1 Local Testing

Test the new signature algorithm in the local environment:

```bash
# Start Server
deno run --allow-net --allow-env main.ts

# Send Test Request
curl -X POST http://localhost:9090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "0727-360B-API",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

### 4.2 Log Verification

Enable debug mode to view signature generation logs:

```bash
export DEBUG_MODE=true
```

Expected Log Output:
```
Using environment variable key: your-secret-key...
New version signature generated successfully: abc123...
```

## 5. Troubleshooting

### 5.1 Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Signature Verification Failed | Incorrect Key Format | Check if `ZAI_SIGNING_SECRET` is in a valid format |
| Request Rejected | Time Window Out of Sync | Ensure server time is accurate |
| Performance Degradation | Frequent Key Calculation | Use caching mechanisms or optimize key management |

### 5.2 Debugging Tips

- Check the signature generation process in debug logs
- Verify if Base64 encoding is correct
- Confirm time window calculation logic

## 6. Future Maintenance

- Regularly update default key to enhance security
- Monitor performance metrics of the signature algorithm
- Adjust algorithm promptly based on upstream API changes

---

**Update Completed**: The new signature mechanism has been integrated into ZtoApi v2.0, ensuring full compatibility with the upstream Z.ai API.

For general configuration and usage, see [Getting Started](../docs/getting-started.md) and [Features](../docs/features.md).