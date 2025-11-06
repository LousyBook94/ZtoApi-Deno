## ZtoApi Architecture (v2.0.0)

This repo exposes an OpenAI‑compatible API and forwards requests to Z.ai upstream with strict fidelity (headers, query params, body, and signatures).

### Layers

- Entry point: main.ts (HTTP server, routing)
- Config: src/config/
  - constants.ts (CONFIG, env validation)
  - models.ts (supported models, capability detection)
- Services: src/services/
  - token-pool.ts (auth token rotation + anonymous token caching)
  - signature.ts (Z.ai HMAC signature 2‑phase)
  - header-generator.ts (smart browser headers + FE version cache)
  - fingerprint.ts (browser fingerprint params)
  - anonymous-token.ts (guest token fetch + retry)
  - image-processor.ts (download/base64 → upload to Z.ai files API)
  - upstream-caller.ts (final POST to upstream with exact format)
- Types: src/types/ (common, openai, upstream)
- Utils: src/utils/
  - logger.ts (levels, centralized)
  - helpers.ts (CORS, error responses, validation)
  - stats.ts (request metrics + live requests)
  - stream.ts (SSE parsing for streaming/non‑streaming)
- Handlers: src/handlers/
  - models.ts (/v1/models response)

### Data Flow (/v1/chat/completions)

1. main.ts parses request (headers, body, think‑tags mode)
2. TokenPool resolves token (configured or anonymous)
3. ImageProcessor uploads images if present
4. signature.ts builds HMAC signature for e|body|timestamp
5. header-generator.ts produces realistic browser headers (cached FE version)
6. upstream-caller.ts sends POST to Z.ai with query params + headers
7. stream.ts parses SSE and emits OpenAI‑compatible chunks (or collects full)

### Compatibility Guarantees

- Upstream URL, headers and query parameters preserved
- Signature algorithm unchanged
- Response shape conforms to OpenAI format

### Observability

- stats.ts stores aggregate + live request info
- DEBUG_MODE controls logger verbosity

### Security

- .gitignore excludes logs and env files
- No secrets committed; env validation warns on missing tokens

### Run

- Deno: deno task start
- Docker: docker build -t ztoapi . && docker run -p 9090:9090 ztoapi
