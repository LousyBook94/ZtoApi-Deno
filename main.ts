/**
 * ZtoApi - OpenAI-compatible API proxy server
 *
 * Overview:
 * - Provides an OpenAI-compatible API interface for Z.ai's GLM-4.5 models
 * - Supports streaming and non-streaming responses
 * - Includes a real-time monitoring Dashboard
 * - Supports automatic anonymous token fetching
 * - Intelligently handles model "thinking" content display
 * - Complete request statistics and error handling
 *
 * @author ZtoApi Team
 * @version 2.0.0
 * @since 2024
 *
 * This is the main entry point. The server is now fully modularized.
 * See src/ directory for all module implementations.
 */

import { main } from "./src/server/router.ts";

// Start server
if (import.meta.main) {
  main();
}
