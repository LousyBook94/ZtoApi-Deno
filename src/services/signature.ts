/**
 * Z.ai API request signature generation
 * CRITICAL: This must match the Python implementation exactly to ensure upstream compatibility
 */

import { CONFIG } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";

/**
 * Generate Z.ai API request signature
 * @param e "requestId,request_id,timestamp,timestamp,user_id,user_id"
 * @param t User's latest message
 * @param timestamp Timestamp (milliseconds)
 * @returns { signature: string, timestamp: string }
 */
export async function generateSignature(
  e: string,
  t: string,
  timestamp: number
): Promise<{ signature: string; timestamp: string }> {
  const timestampStr = String(timestamp);

  // 1. Base64 encode the message content
  const bodyEncoded = new TextEncoder().encode(t);
  const bodyBase64 = btoa(String.fromCharCode(...bodyEncoded));

  // 2. Construct the string to sign
  const stringToSign = `${e}|${bodyBase64}|${timestampStr}`;

  // 3. Calculate 5-minute time window
  const timeWindow = Math.floor(timestamp / (5 * 60 * 1000));

  // 4. Get signing key
  const secretEnv = Deno.env.get("ZAI_SIGNING_SECRET");
  let rootKey: Uint8Array;

  if (secretEnv) {
    // Read key from environment variable
    if (/^[0-9a-fA-F]+$/.test(secretEnv) && secretEnv.length % 2 === 0) {
      // HEX format
      rootKey = new Uint8Array(secretEnv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    } else {
      // UTF-8 format
      rootKey = new TextEncoder().encode(secretEnv);
    }
    logger.debug("Using environment variable key: %s", secretEnv.substring(0, 10) + "...");
  } else {
    // Use default key
    rootKey = new TextEncoder().encode(CONFIG.DEFAULT_SIGNING_KEY);
    logger.debug("Using default signing key");
  }

  // 5. First layer HMAC, generate intermediate key
  const firstHmacKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(rootKey),
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

  // 6. Second layer HMAC, generate final signature
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

  logger.debug("Signature generated successfully: %s", signature);
  return {
    signature,
    timestamp: timestampStr,
  };
}

