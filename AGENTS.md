# AGENTS.md - ZtoApi Development Guide

This file provides essential information for agents working on the ZtoApi codebase. It includes build/lint/test commands, code style guidelines, and an overview of the project's structure and design.

## Build, Lint, and Test Commands

### Running the Application

- **Start the server**: `deno run --allow-net --allow-env --allow-read main.ts`
- **Development mode (with watch)**: `deno run --allow-net --allow-env --allow-read --watch main.ts`
- **Test Anthropic integration**: `deno run --allow-net test_anthropic.ts`

### Testing

- **Run all tests**: `deno test --allow-net --allow-env --allow-read`
- **Run a single test file**: `deno test main_test.ts` (or specify any test file)
- **Test native tool calling**: `deno test native_tool_calling_test.ts`
- **Check TypeScript types**: `deno check main.ts anthropic.ts`

### Linting and Code Quality

- **Lint the code**: `deno lint`
- **Format code**: `deno fmt` (Deno's built-in formatter)

### Notes

- All commands require network, environment, and read permissions as the app interacts with external APIs and reads configuration.
- For running a single test, use `deno test <file_path>` where `<file_path>` is the path to the specific test file (e.g., `main_test.ts`).

## Code Style Guidelines

### Language and Framework

- **Language**: TypeScript with strict mode enabled (`"strict": true` in `deno.json`).
- **Runtime**: Deno (no Node.js dependencies).
- **Style**: Follow Deno's conventions and use TypeScript best practices.

### Formatting and Structure

- **Indentation**: Use 2 spaces (Deno default).
- **Line endings**: Unix-style (LF).
- **File encoding**: UTF-8.
- **Semicolons**: Optional, but consistent (prefer no semicolons where possible).
- **Quotes**: Use double quotes for strings.

### Naming Conventions

- **Variables and functions**: camelCase (e.g., `debugLog`, `getModelConfig`).
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_MODEL`, `THINK_TAGS_MODE`).
- **Classes and interfaces**: PascalCase (e.g., `AnthropicMessagesRequest`, `ModelConfig`).
- **Files**: kebab-case for multi-word files (e.g., `main.ts`, `anthropic.ts`).

### Comments and Documentation

- **JSDoc comments**: Required for all public functions, interfaces, and complex logic. Include `@param`, `@returns`, and descriptions.
- **Inline comments**: Use `//` for single-line comments. Avoid excessive comments; code should be self-explanatory.
- **Block comments**: Use `/* */` for multi-line comments if needed.

### Imports

- **Standard library**: Import from `https://deno.land/std@<version>/` (e.g., `import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";`).
- **Local modules**: Use relative paths (e.g., `import { convertAnthropicToOpenAI } from "./anthropic.ts";`).
- **NPM packages**: Use `npm:` prefix (e.g., `"gpt-tokenizer": "npm:gpt-tokenizer@^3.0.1"` in `deno.json`).
- **Group imports**: Standard library first, then local, then NPM.

### Types and Interfaces

- **Explicit types**: Always use TypeScript types. Avoid `any` unless necessary.
- **Interface definitions**: Define interfaces for API requests/responses and complex objects.
- **Union types**: Use for optional or variant types (e.g., `string | Array<{ type: string; text?: string; }>`).
- **Generics**: Use for reusable types (e.g., `Record<string, unknown>`).

### Error Handling

- **Try-catch blocks**: Wrap async operations and API calls in try-catch.
- **Custom errors**: Throw descriptive errors with context.
- **Logging**: Use `debugLog` function for debug messages (controlled by `DEBUG_MODE` env var). Use `console.log` for important logs.
- **Graceful degradation**: Handle failures without crashing the server.

### Functions and Methods

- **Async/await**: Prefer over promises for async code.
- **Arrow functions**: Use for simple functions; traditional functions for methods.
- **Parameters**: Use descriptive names and provide defaults where appropriate.
- **Return types**: Explicitly declare return types for functions.

### Security and Best Practices

- **No secrets in code**: Use environment variables for API keys and sensitive data.
- **Input validation**: Validate API inputs and sanitize where possible.
- **CORS**: Properly configure CORS headers for cross-origin requests.
- **Environment checks**: Use `Deno.env.get()` for configuration.
- **Tool security**: Only registered tools can be executed; sandboxed execution environment; parameter validation.

### Example Code Style

```typescript
/**
 * Example function demonstrating style guidelines
 * @param input The input string to process
 * @returns Processed string
 */
function processInput(input: string): string {
  if (!input) {
    throw new Error("Input cannot be empty");
  }

  const result = input.trim().toLowerCase();
  debugLog("Processed input: %s", result);

  return result;
}
```

## Native Tool Calling System

### Overview

ZtoApi includes a comprehensive native tool calling system that allows AI models to execute predefined server-side functions. This enables richer interactions beyond text generation.

### Architecture

- **Tool Registry** (`src/services/tool-registry.ts`): Central registry managing all available tools
- **Built-in Tools** (`src/services/init-tools.ts`): Default tools (time, URL fetching, hashing, math)
- **Tool Processor** (`src/services/tool-processor.ts`): Detection and execution of tool calls
- **Validation** (`src/utils/validation.ts`): Tool request validation and security checks

### Supported Tools

1. **get_current_time**: Returns current UTC time
2. **fetch_url**: Fetches content from URLs (text/JSON)
3. **hash_string**: Calculates SHA256/SHA1 hashes
4. **calculate_expression**: Safely evaluates math expressions

### Tool Call Detection

The system detects tool calls in multiple formats:
- JSON: `{"name": "tool_name", "arguments": {...}}`
- XML: `<function_calls><invoke name="tool_name">...</invoke></function_calls>`
- Simple: `function_call: tool_name()`

### Adding Custom Tools

Register new tools in `src/services/init-tools.ts`:

```typescript
registerTool(
  "tool_name",
  async function(args: { param: string }) {
    return `Processed: ${args.param}`;
  },
  "Tool description",
  {
    type: "object",
    properties: { param: { type: "string" } },
    required: ["param"],
  },
);
```

### Security Features

- Whitelist-based tool registry
- Input validation and sanitization
- Sandboxed execution environment
- Error handling without server crashes

## Project Structure and Design

### Overview

ZtoApi is a Deno-based API proxy server that provides OpenAI and Anthropic Claude-compatible interfaces to Z.ai's GLM models. It supports streaming and non-streaming responses, includes a real-time monitoring dashboard, and handles multimodal content (text, images, videos, documents, audio).

### Architecture

- **Runtime**: Deno native HTTP server.
- **API Compatibility**: Dual support for OpenAI (`/v1/`) and Anthropic (`/anthropic/v1/`) endpoints.
- **Upstream**: Proxies requests to Z.ai's API (`https://chat.z.ai/api/chat/completions`).
- **Authentication**: API key validation with optional anonymous token fetching.
- **Streaming**: Server-Sent Events (SSE) for real-time responses.
- **UI**: Built-in web dashboard for monitoring (`/dashboard`).
- **Tool Calling**: Native tool execution with registry-based management and validation.

### Key Components

- **main.ts**: Core server logic, request handling, routing, and upstream communication.
- **anthropic.ts**: Anthropic API conversion utilities, model mappings, and token counting.
- **Tool Services** (`src/services/`):
  - `tool-registry.ts`: Central registry for managing native tools
  - `init-tools.ts`: Built-in tools (get_current_time, fetch_url, hash_string, calculate_expression)
  - `tool-processor.ts`: Tool call detection and execution
- **UI files** (`ui/`): HTML/CSS/JS for the dashboard and documentation.
- **Tests** (`*_test.ts`): Unit tests for core functions, including `native_tool_calling_test.ts`.
- **Configuration**: `deno.json` for tasks and imports; environment variables for runtime config.

### Design Patterns

- **Modular interfaces**: Separate interfaces for OpenAI and Anthropic requests/responses.
- **Conversion layers**: Functions to convert between API formats (e.g., `convertAnthropicToOpenAI`).
- **Tool processing**: Detection and execution of tool calls in multiple formats (JSON, XML, simple).
- **Configuration-driven**: Model configs and feature flags via constants and env vars.
- **Error propagation**: Centralized error handling with detailed logging.
- **State management**: Global stats and live request tracking for the dashboard.
- **Tool registry**: Whitelist-based system for managing and executing native tools.

### Supported Models

- **GLM-4.5** (`0727-360B-API`): Text-based, supports thinking and MCP.
- **GLM-4.6** (`GLM-4-6-API-V1`): Advanced text model with vision and MCP.
- **GLM-4.5V** (`glm-4.5v`): Multimodal model supporting images, videos, etc.

### Key Features

- **Thinking content modes**: `strip`, `thinking`, `think`, `raw`, `separate` for handling model reasoning.
- **Multimodal support**: Process images, videos, documents, and audio in requests.
- **Native tool calling**: AI can execute server-side functions (get_current_time, fetch_url, hash_string, calculate_expression).
- **Real-time stats**: Track requests, response times, and errors via global state.
- **Anonymous tokens**: Automatic fetching for unauthenticated requests.
- **Signature generation**: Custom HMAC-based signing for upstream requests.

### Deployment

- **Deno Deploy**: Cloud deployment with environment variables.
- **Self-hosted**: Run locally with Deno runtime.
- **Docker**: Use `Dockerfile` for containerized deployment.

### Maintenance Notes

- Update this file whenever system or design changes occur (e.g., new endpoints, config options, or architectural shifts).
- Ensure all new code adheres to the style guidelines above.
- Run tests and linting before commits to maintain code quality.
- When adding new tools, update `src/services/init-tools.ts` and test with `native_tool_calling_test.ts`.
- Tool registry is initialized automatically on server startup via `src/server/router.ts`.
