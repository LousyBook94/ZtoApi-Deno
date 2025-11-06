## Migration Guide (v2.0.0)

ZtoApi moved from a single massive main.ts to a modular layout under src/.

### What changed
- All magic numbers moved to CONFIG (src/config/constants.ts)
- Model config and capability detection in src/config/models.ts
- Request logic split into services (signature, headers, images, upstream caller)
- Utilities for CORS, logging, stats, streams
- /v1/models handler extracted to src/handlers/models.ts

### What did not change
- API endpoints and request/response formats
- Upstream call behavior (headers, params, signature)
- Env vars (PORT, DEBUG_MODE, ZAI_TOKEN, ZAI_TOKENS, DEFAULT_KEY, etc.)

### Where things went
- Token rotation: src/services/token-pool.ts
- Anonymous token: src/services/anonymous-token.ts
- Signature: src/services/signature.ts
- Browser headers: src/services/header-generator.ts
- Fingerprint params: src/services/fingerprint.ts
- Image upload: src/services/image-processor.ts
- Upstream call: src/services/upstream-caller.ts
- SSE handling: src/utils/stream.ts
- Stats/live requests: src/utils/stats.ts
- Common helpers: src/utils/helpers.ts

### Import examples
```
import { CONFIG } from "./src/config/constants.ts";
import { getModelConfig } from "./src/config/models.ts";
import { TokenPool } from "./src/services/token-pool.ts";
import { generateSignature } from "./src/services/signature.ts";
import { SmartHeaderGenerator } from "./src/services/header-generator.ts";
```

### Local run
```
deno task dev     # dev
PORT=9090 deno task start
```

### Docker run
```
docker build -t ztoapi .
docker run -p 9090:9090 --env PORT=9090 ztoapi
```

### Testing (manual)
```
# Models
curl -s http://localhost:9090/v1/models | jq

# Non-streaming completion
curl -s http://localhost:9090/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "Content-Type: application/json" \
  -d '{"model":"GLM-4.5","messages":[{"role":"user","content":"Say hello"}],"stream":false}' | jq

# Streaming completion
curl -N http://localhost:9090/v1/chat/completions \
  -H "Authorization: Bearer sk-test" \
  -H "Content-Type: application/json" \
  -d '{"model":"GLM-4.5","messages":[{"role":"user","content":"Say hello"}],"stream":true}'
```

### Tips
- Set DEBUG_MODE=false in prod
- Provide ZAI_TOKEN or ZAI_TOKENS for authenticated upstream
- DEFAULT_KEY controls client API-key for your users

