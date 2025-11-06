/**
 * Image Processing Service
 * Handles image upload and processing for multimodal requests
 */

import { CONFIG, DEFAULT_LANGUAGE } from "../config/constants.ts";
import { logger } from "../utils/logger.ts";
import { truncateString } from "../utils/helpers.ts";
import type { Message, UploadedFile } from "../types/common.ts";

// Import X_FE_VERSION from header generator
let X_FE_VERSION = CONFIG.DEFAULT_FE_VERSION;

/**
 * Image Processor Class
 */
export class ImageProcessor {
  /**
   * Detect if message contains image content
   */
  static hasImageContent(messages: Message[]): boolean {
    for (const msg of messages) {
      if (msg.role === "user") {
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "image_url" && part.image_url?.url) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Upload image to Z.AI server
   */
  static async uploadImage(imageUrl: string, token: string, chatId: string = ""): Promise<UploadedFile | null> {
    try {
      logger.debug("Start uploading image: %s", truncateString(imageUrl));

      // Process base64 image data
      let imageData: Uint8Array;
      let filename: string;
      let mimeType: string;

      if (imageUrl.startsWith("data:image/")) {
        // Parse base64 image
        const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid base64 image format");
        }

        mimeType = `image/${matches[1]}`;
        filename = `image.${matches[1]}`;
        const base64Data = matches[2];
        imageData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      } else if (imageUrl.startsWith("http")) {
        // Download remote image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const extension = contentType.split("/")[1] || "jpg";
        filename = `image.${extension}`;

        const buffer = await response.arrayBuffer();
        imageData = new Uint8Array(buffer);
        mimeType = contentType;
      } else {
        throw new Error("Unsupported image URL format");
      }

      // Create FormData
      const formData = new FormData();
      const arrayBuffer = imageData.buffer.slice(imageData.byteOffset, imageData.byteOffset + imageData.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: mimeType });
      formData.append("file", blob, filename);

      // Upload to Z.AI
      const uploadResponse = await fetch("https://chat.z.ai/api/v1/files/", {
        method: "POST",
        headers: {
          "Accept": "*/*",
          "Accept-Language": `${DEFAULT_LANGUAGE},en;q=0.9`,
          "Authorization": `Bearer ${token}`,
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Content-Type": "multipart/form-data",
          "DNT": "1",
          "Origin": CONFIG.ORIGIN_BASE,
          "Pragma": "no-cache",
          "Referer": chatId ? `${CONFIG.ORIGIN_BASE}/c/${chatId}` : `${CONFIG.ORIGIN_BASE}/`,
          "Sec-Ch-Ua": '"Microsoft Edge";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
          "X-Fe-Version": X_FE_VERSION,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json() as { id: string; filename?: string; url: string };
      logger.debug("Image upload successful: %s", uploadResult.id);

      // Return file structure
      return {
        id: uploadResult.id,
        filename: uploadResult.filename || filename,
        size: imageData.length,
        type: mimeType,
        url: uploadResult.url || `/api/v1/files/${uploadResult.id}/content`
      };
    } catch (error) {
      logger.error("Image upload failed: %v", error);
      return null;
    }
  }

  /**
   * Process image content in message, return processed message and uploaded file list
   */
  static async processImages(
    messages: Message[],
    token: string,
    isVisionModel: boolean = false,
    chatId: string = ""
  ): Promise<{ processedMessages: Message[], uploadedFiles: UploadedFile[], uploadedFilesMap: Map<string, UploadedFile> }> {
    const processedMessages: Message[] = [];
    const uploadedFiles: UploadedFile[] = [];
    const uploadedFilesMap = new Map<string, UploadedFile>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const processedMsg: Message = { ...msg };

      if (msg.role === "user" && Array.isArray(msg.content)) {
        const newContent: Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }> = [];

        for (const part of msg.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            const imageUrl = part.image_url.url;

            // Upload image with chatId for proper referer
            const uploadedFile = await this.uploadImage(imageUrl, token, chatId);
            if (uploadedFile) {
              if (isVisionModel) {
                // GLM-4.5V: Keep in message, but convert URL format
                const newUrl = `${uploadedFile.id}_${uploadedFile.filename}`;
                newContent.push({
                  type: "image_url",
                  image_url: { url: newUrl }
                });
                uploadedFilesMap.set(imageUrl, uploadedFile);
                logger.debug("GLM-4.5V image URL converted: %s -> %s", truncateString(imageUrl), newUrl);
              } else {
                // Non-vision model: Add to file list, remove from message
                uploadedFiles.push(uploadedFile);
                logger.debug("Image added to file list: %s", uploadedFile.id);
              }
            } else {
              // Upload failed, add error message
              logger.warn("Image upload failed");
              newContent.push({
                type: "text",
                text: "[系统提示: 图片上传失败]"
              });
            }
          } else if (part.type === "text") {
            newContent.push(part);
          }
        }

        // If only text content, convert to string format
        if (newContent.length === 1 && newContent[0].type === "text") {
          processedMsg.content = newContent[0].text || "";
        } else if (newContent.length > 0) {
          processedMsg.content = newContent;
        } else {
          processedMsg.content = "";
        }
      }

      processedMessages.push(processedMsg);
    }

    return {
      processedMessages,
      uploadedFiles,
      uploadedFilesMap
    };
  }

  /**
   * Extract text content of the last user message
   */
  static extractLastUserContent(messages: Message[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") {
        const content = msg.content;
        if (typeof content === "string") {
          return content;
        } else if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "text" && part.text) {
              return part.text;
            }
          }
        }
      }
    }
    return "";
  }
}

