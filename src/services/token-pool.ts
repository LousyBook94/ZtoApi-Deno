/**
 * Token Pool Management System
 * Supports multiple token rotation, automatically switches failed tokens
 */

import { CONFIG, ZAI_TOKEN } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import type { TokenInfo } from "../types/common.ts";

export class TokenPool {
  private tokens: TokenInfo[] = [];
  private currentIndex: number = 0;
  private anonymousToken: string | null = null;
  private anonymousTokenExpiry: number = 0;

  constructor(private getAnonymousTokenFn: () => Promise<string>) {
    this.initializeTokens();
  }

  /**
   * Initialize Token pool
   */
  private initializeTokens(): void {
    // Read multiple tokens from environment variable, separated by commas
    const tokenEnv = Deno.env.get("ZAI_TOKENS");
    if (tokenEnv) {
      const tokenList = tokenEnv.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      this.tokens = tokenList.map((token) => ({
        token,
        isValid: true,
        lastUsed: 0,
        failureCount: 0,
        isAnonymous: false,
      }));
      logger.debug("Token pool initialized, contains %d tokens", this.tokens.length);
    } else if (ZAI_TOKEN) {
      // Compatible with single token configuration
      this.tokens = [{
        token: ZAI_TOKEN,
        isValid: true,
        lastUsed: 0,
        failureCount: 0,
        isAnonymous: false,
      }];
      logger.debug("Using single token configuration");
    } else {
      logger.warn("No token configured, will use anonymous token");
    }
  }

  /**
   * Get next available token
   */
  async getToken(): Promise<string> {
    // If there are configured tokens, try to use them
    if (this.tokens.length > 0) {
      const token = this.getNextValidToken();
      if (token) {
        token.lastUsed = Date.now();
        return token.token;
      }
    }

    // Downgrade to anonymous token
    return await this.getAnonymousToken();
  }

  /**
   * Get next valid configured token
   */
  private getNextValidToken(): TokenInfo | null {
    const startIndex = this.currentIndex;

    do {
      const tokenInfo = this.tokens[this.currentIndex];
      if (tokenInfo.isValid && tokenInfo.failureCount < CONFIG.TOKEN_RETRY_THRESHOLD && !tokenInfo.isAnonymous) {
        return tokenInfo;
      }
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    } while (this.currentIndex !== startIndex);

    return null; // All tokens are unavailable
  }

  /**
   * Switch to next token (called when current token fails)
   */
  switchToNext(): string | null {
    if (this.tokens.length === 0) return null;

    // Mark current token as failed
    const currentToken = this.tokens[this.currentIndex];
    currentToken.failureCount++;
    if (currentToken.failureCount >= CONFIG.TOKEN_RETRY_THRESHOLD) {
      currentToken.isValid = false;
      logger.debug("Token marked as invalid: %s", currentToken.token.substring(0, 20));
    }

    // Switch to next
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    const nextToken = this.tokens[this.currentIndex];

    if (nextToken && nextToken.isValid && !nextToken.isAnonymous) {
      logger.debug("Switch to next token: %s", nextToken.token.substring(0, 20));
      nextToken.lastUsed = Date.now();
      return nextToken.token;
    }

    return null; // All configured tokens are unavailable
  }

  /**
   * Reset token status (after successful call)
   */
  markSuccess(token: string): void {
    const tokenInfo = this.tokens.find((t) => t.token === token);
    if (tokenInfo) {
      tokenInfo.failureCount = 0;
      tokenInfo.isValid = true;
      tokenInfo.lastUsed = Date.now();
    }
  }

  /**
   * Get anonymous token
   */
  private async getAnonymousToken(): Promise<string> {
    const now = Date.now();

    // Check if cache is valid
    if (this.anonymousToken && this.anonymousTokenExpiry > now) {
      return this.anonymousToken;
    }

    try {
      this.anonymousToken = await this.getAnonymousTokenFn();
      this.anonymousTokenExpiry = now + CONFIG.ANONYMOUS_TOKEN_TTL_MS;
      logger.debug("Anonymous token obtained and cached");
      return this.anonymousToken;
    } catch (error) {
      logger.error("Failed to obtain anonymous token: %v", error);
      throw error;
    }
  }

  /**
   * Clear anonymous token cache
   */
  clearAnonymousTokenCache(): void {
    this.anonymousToken = null;
    this.anonymousTokenExpiry = 0;
    logger.debug("Anonymous token cache cleared");
  }

  /**
   * Get token pool size
   */
  getPoolSize(): number {
    return this.tokens.length;
  }

  /**
   * Check if it is an anonymous token
   */
  isAnonymousToken(token: string): boolean {
    return this.anonymousToken === token;
  }
}
