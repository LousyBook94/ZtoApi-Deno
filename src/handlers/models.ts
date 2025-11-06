/**
 * Models endpoint handler
 * Returns list of supported models
 */

import { SUPPORTED_MODELS } from "../config/models.ts";
import { setCORSHeaders } from "../utils/helpers.ts";
import type { ModelsResponse } from "../types/common.ts";

/**
 * Handle /v1/models endpoint
 */
export function handleModels(request: Request): Response {
  const headers = new Headers();
  setCORSHeaders(headers);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  const models = SUPPORTED_MODELS.map((model) => ({
    id: model.name,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "z.ai",
  }));

  const response: ModelsResponse = {
    object: "list",
    data: models,
  };

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(response), {
    status: 200,
    headers,
  });
}
