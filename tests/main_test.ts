import { assertEquals } from "assert";
import { transformThinking } from "../src/utils/stream.ts";

Deno.test("transformThinking - strip mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "strip");
  assertEquals(result, "content");
});

Deno.test("transformThinking - thinking mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "thinking");
  assertEquals(result, "<thinking>thinking</thinking>content");
});

Deno.test("transformThinking - think mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "think");
  assertEquals(result, content); // think mode keeps original
});

Deno.test("transformThinking - raw mode", () => {
  const content = "<think>thinking</think>content";
  const result = transformThinking(content, "raw");
  assertEquals(result, content);
});

Deno.test("transformThinking - separate mode", () => {
  const content = "<think>thinking</think>content";
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

Deno.test("transformThinking - partial think tag", () => {
  const content = "thinking</think>content";
  const result = transformThinking(content, "strip");
  assertEquals(result, "thinking</think>content"); // No opening tag, so nothing to strip
});
