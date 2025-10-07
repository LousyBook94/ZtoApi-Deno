import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { transformThinking, generateSHA256Hash } from "./main.ts";

Deno.test("transformThinking - strip mode", () => {
    const content = "<details>thinking</details>content";
    const result = transformThinking(content, "strip");
    assertEquals(result, "thinkingcontent");
});

Deno.test("transformThinking - thinking mode", () => {
    const content = "<details>thinking</details>content";
    const result = transformThinking(content, "thinking");
    assertEquals(result, "<thinking>thinking</thinking>content");
});

Deno.test("transformThinking - think mode", () => {
    const content = "<details>thinking</details>content";
    const result = transformThinking(content, "think");
    assertEquals(result, "<think>thinking</think>content");
});

Deno.test("transformThinking - raw mode", () => {
    const content = "<details>thinking</details>content";
    const result = transformThinking(content, "raw");
    assertEquals(result, content);
});

Deno.test("transformThinking - separate mode", () => {
    const content = "<details>thinking</details>content";
    const result = transformThinking(content, "separate");
    assertEquals(result, { reasoning: "thinking", content: "content" });
});

Deno.test("transformThinking - empty content", () => {
    const content = "";
    const resultStrip = transformThinking(content, "strip");
    assertEquals(resultStrip, "");
    const resultSeparate = transformThinking(content, "separate");
    assertEquals(resultSeparate, { reasoning: "", content: "" });
});

Deno.test("transformThinking - no tags", () => {
    const content = "just content";
    const resultStrip = transformThinking(content, "strip");
    assertEquals(resultStrip, "just content");
    const resultSeparate = transformThinking(content, "separate");
    assertEquals(resultSeparate, { reasoning: "", content: "just content" });
});

Deno.test("transformThinking - partial details tag", () => {
    const content = "thinking</details>content";
    const result = transformThinking(content, "think");
    assertEquals(result, "ςthinkingςcontent");
});

Deno.test("generateSHA256Hash - basic functionality", async () => {
    const input = "test data";
    const hash = await generateSHA256Hash(input);
    
    // SHA-256 hash of "test data" should be 64 characters long
    assertEquals(hash.length, 64);
    
    // Should be a valid hex string
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
    
    // Same input should produce same output
    const hash2 = await generateSHA256Hash(input);
    assertEquals(hash, hash2);
});

Deno.test("generateSHA256Hash - different inputs produce different hashes", async () => {
    const input1 = "test data 1";
    const input2 = "test data 2";
    const hash1 = await generateSHA256Hash(input1);
    const hash2 = await generateSHA256Hash(input2);
    
    // Different inputs should produce different hashes
    assertEquals(hash1 !== hash2, true);
});

Deno.test("generateSHA256Hash - JSON object", async () => {
    const obj = { model: "test", messages: [{ role: "user", content: "hello" }] };
    const jsonString = JSON.stringify(obj);
    const hash = await generateSHA256Hash(jsonString);
    
    // Should be 64 characters long
    assertEquals(hash.length, 64);
    
    // Should be a valid hex string
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
});