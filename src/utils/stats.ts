/**
 * Request statistics tracking
 */

import type { LiveRequest, RequestStats } from "../types/common.ts";

// Global stats
export let stats: RequestStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  lastRequestTime: new Date(),
  averageResponseTime: 0,
};

// Live requests tracking (last 100)
export let liveRequests: LiveRequest[] = [];

// Tool call statistics
export const toolStats: Record<string, number> = {};
export let totalToolCalls: number = 0;

/**
 * Record request statistics
 */
export function recordRequestStats(startTime: number, _path: string, status: number): void {
  const duration = Date.now() - startTime;

  stats.totalRequests++;
  if (status >= 200 && status < 300) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
  }
  stats.lastRequestTime = new Date();

  // Update average response time
  stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + duration) / stats.totalRequests;
}

/**
 * Add a live request to tracking
 */
export function addLiveRequest(
  method: string,
  path: string,
  status: number,
  duration: number,
  userAgent: string,
  model?: string,
): void {
  const request: LiveRequest = {
    id: Date.now().toString(),
    timestamp: new Date(),
    method,
    path,
    status,
    duration,
    userAgent,
    model,
  };

  liveRequests.push(request);

  // Keep only last 100 requests
  if (liveRequests.length > 100) {
    liveRequests = liveRequests.slice(1);
  }
}

/**
 * Combined stats recording and live request tracking
 */
export function recordAndTrackRequest(
  startTime: number,
  method: string,
  pathname: string,
  status: number,
  userAgent: string,
  model?: string,
): void {
  const duration = Date.now() - startTime;
  recordRequestStats(startTime, pathname, status);
  addLiveRequest(method, pathname, status, duration, userAgent, model);
}

/**
 * Get live requests data as JSON string
 */
export function getLiveRequestsData(): string {
  try {
    if (!Array.isArray(liveRequests)) {
      liveRequests = [];
    }

    const requestData = liveRequests.map((req) => ({
      id: req.id || "",
      method: req.method || "",
      path: req.path || "",
      status: req.status || 0,
      duration: req.duration || 0,
      timestamp: req.timestamp || new Date(),
      user_agent: req.userAgent || "",
    }));

    return JSON.stringify(requestData);
  } catch (_error) {
    return JSON.stringify([]);
  }
}

/**
 * Record tool call statistics
 */
export function recordToolCall(toolName: string, success: boolean): void {
  totalToolCalls++;

  if (!toolStats[toolName]) {
    toolStats[toolName] = 0;
  }

  if (success) {
    toolStats[toolName]++;
  }
}

/**
 * Get tool call statistics
 */
export function getToolStats(): { total: number; byTool: Record<string, number> } {
  return {
    total: totalToolCalls,
    byTool: { ...toolStats },
  };
}

/**
 * Get stats data as JSON string
 */
export function getStatsData(): string {
  try {
    if (!stats) {
      stats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequestTime: new Date(),
        averageResponseTime: 0,
      };
    }

    const statsData = {
      totalRequests: stats.totalRequests || 0,
      successfulRequests: stats.successfulRequests || 0,
      failedRequests: stats.failedRequests || 0,
      averageResponseTime: stats.averageResponseTime || 0,
      toolCalls: getToolStats(),
    };

    return JSON.stringify(statsData);
  } catch (_error) {
    return JSON.stringify({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      toolCalls: { total: 0, byTool: {} },
    });
  }
}
