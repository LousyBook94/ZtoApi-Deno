# 🚀 ZtoApi Quick Reference

## 📦 Module Imports

### Configuration

```typescript
import { CONFIG, DEFAULT_KEY, UPSTREAM_URL } from "./src/config/constants.ts";
import { getModelConfig, SUPPORTED_MODELS } from "./src/config/models.ts";
```

### Services

```typescript
import { TokenPool } from "./src/services/token-pool.ts";
import { generateSignature } from "./src/services/signature.ts";
import { SmartHeaderGenerator } from "./src/services/header-generator.ts";
import { ImageProcessor } from "./src/services/image-processor.ts";
```

### Types

```typescript
import type { Message, Usage } from "./src/types/common.ts";
import type { OpenAIRequest } from "./src/types/openai.ts";
```

### Utilities

```typescript
import { logger } from "./src/utils/logger.ts";
import { setCORSHeaders, truncateString } from "./src/utils/helpers.ts";
import { recordAndTrackRequest } from "./src/utils/stats.ts";
```

## 🔧 Common Tasks

### Logging

```typescript
logger.debug("Debug: %s", value);
logger.info("Info: %s", value);
logger.warn("Warning: %s", value);
logger.error("Error: %s", value);
```

### Get Configuration

```typescript
const port = CONFIG.DEFAULT_PORT;
const retryAttempts = CONFIG.MAX_RETRY_ATTEMPTS;
```

### Get Model Config

```typescript
const config = getModelConfig("glm-4.5v");
console.log(config.capabilities.vision); // true
```

## 🎯 Constants

- `CONFIG.DEFAULT_PORT` - 9090
- `CONFIG.MAX_RETRY_ATTEMPTS` - 3
- `CONFIG.RETRY_DELAY_MS` - 2000
- `CONFIG.ANONYMOUS_TOKEN_TTL_MS` - 3600000 (1 hour)

## 🧪 Development Commands

```bash
deno task dev      # Development with watch
deno task test     # Run tests
deno task lint     # Lint code
deno task fmt      # Format code
deno task check    # Type check
```

## 📁 Directory Structure

```
src/
├── config/         # Configuration (constants, models)
├── services/       # Business logic (7 services)
├── types/          # Type definitions (3 files)
├── utils/          # Utilities (logger, helpers, stats, stream)
└── handlers/       # Request handlers
```

## 🔐 Environment Variables

```bash
PORT=9090
DEBUG_MODE=true
DEFAULT_STREAM=true
ZAI_TOKEN=your-token
ZAI_TOKENS=token1,token2,token3
DEFAULT_KEY=sk-your-key
```

## 📊 What Changed

- ✅ 18 new modules created in `src/`
- ✅ All magic numbers moved to `CONFIG`
- ✅ Centralized logging with `logger`
- ✅ Type-safe throughout
- ✅ Zero duplicate code

## ⚠️ Important

- **Backward Compatible** - All API endpoints unchanged
- **Upstream Compatible** - Request format preserved
- **Zero Breaking Changes** - External behavior identical

---

**Version**: 2.0.0 (Modular Architecture)
