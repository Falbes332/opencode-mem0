import { CONFIG, MEM0_BASE_URL } from "../config.js";
import { log } from "./logger.js";
import type { ConversationMessage } from "../types/index.js";

const TIMEOUT_MS = 30000;
const MAX_CONVERSATION_CHARS = 100_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.MEM0_API_KEY;
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

interface Mem0Memory {
  id: string;
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export class Mem0Client {
  private baseUrl: string;

  constructor() {
    this.baseUrl = MEM0_BASE_URL;
  }

  private formatConversationMessage(message: ConversationMessage): string {
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content
            .map((part) =>
              part.type === "text"
                ? part.text
                : `[image] ${part.imageUrl.url}`
            )
            .join("\n");

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return `[${message.role}]`;
    }
    return `[${message.role}] ${trimmed}`;
  }

  private formatConversationTranscript(messages: ConversationMessage[]): string {
    return messages
      .map((message, idx) => `${idx + 1}. ${this.formatConversationMessage(message)}`)
      .join("\n");
  }

  async searchMemories(query: string, userId: string) {
    log("searchMemories: start", { userId });
    try {
      const body = {
        query,
        user_id: userId,
        limit: CONFIG.maxMemories,
        threshold: CONFIG.similarityThreshold,
      };
      const response = await withTimeout(
        fetch(`${this.baseUrl}/search`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(body),
        }),
        TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Mem0Memory[] | { results?: Mem0Memory[] };
      const memories: Mem0Memory[] = Array.isArray(data)
        ? data
        : (data.results ?? []);

      const results = memories
        .map((m) => ({
          id: m.id,
          memory: m.memory,
          similarity: m.score ?? 1,
        }));

      log("searchMemories: success", { count: results.length });
      return { success: true as const, results, total: results.length, timing: 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("searchMemories: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, results: [], total: 0, timing: 0 };
    }
  }

  async getProfile(userId: string, query?: string) {
    log("getProfile: start", { userId });
    try {
      const params = new URLSearchParams({
        user_id: userId,
        limit: String(CONFIG.maxProfileItems),
      });
      const response = await withTimeout(
        fetch(`${this.baseUrl}/memories?${params}`, {
          headers: buildHeaders(),
        }),
        TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Mem0Memory[] | { results?: Mem0Memory[] };
      const memories: Mem0Memory[] = Array.isArray(data)
        ? data
        : (data.results ?? []);

      const staticFacts = memories.map((m) => m.memory).filter(Boolean);

      log("getProfile: success", { count: staticFacts.length });
      return {
        success: true as const,
        profile: {
          static: staticFacts,
          dynamic: [] as string[],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("getProfile: error", { error: errorMessage });
      return { success: false as const, error: errorMessage, profile: null };
    }
  }

  async addMemory(
    content: string,
    userId: string,
    metadata?: { type?: string; [key: string]: unknown }
  ) {
    log("addMemory: start", { userId, contentLength: content.length });
    try {
      const body = {
        messages: [{ role: "user", content }],
        user_id: userId,
        ...(metadata ? { metadata } : {}),
      };

      const response = await withTimeout(
        fetch(`${this.baseUrl}/memories`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(body),
        }),
        TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { id?: string; results?: Array<{ id?: string }> };
      const id = data.id ?? data.results?.[0]?.id ?? "";
      log("addMemory: success", { id });
      return { success: true as const, id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("addMemory: error", { error: errorMessage });
      return { success: false as const, error: errorMessage };
    }
  }

  async deleteMemory(memoryId: string) {
    log("deleteMemory: start", { memoryId });
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}/memories/${memoryId}`, {
          method: "DELETE",
          headers: buildHeaders(),
        }),
        TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      log("deleteMemory: success", { memoryId });
      return { success: true as const };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("deleteMemory: error", { memoryId, error: errorMessage });
      return { success: false as const, error: errorMessage };
    }
  }

  async listMemories(userId: string, limit = 20) {
    log("listMemories: start", { userId, limit });
    try {
      const params = new URLSearchParams({
        user_id: userId,
        limit: String(limit),
      });
      const response = await withTimeout(
        fetch(`${this.baseUrl}/memories?${params}`, {
          headers: buildHeaders(),
        }),
        TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as Mem0Memory[] | { results?: Mem0Memory[] };
      const rawMemories: Mem0Memory[] = Array.isArray(data)
        ? data
        : (data.results ?? []);

      const memories = rawMemories.map((m) => ({
        id: m.id,
        summary: m.memory,
        content: m.memory,
        metadata: m.metadata,
        createdAt: m.created_at,
      }));

      log("listMemories: success", { count: memories.length });
      return {
        success: true as const,
        memories,
        pagination: { currentPage: 1, totalItems: memories.length, totalPages: 1 },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("listMemories: error", { error: errorMessage });
      return {
        success: false as const,
        error: errorMessage,
        memories: [],
        pagination: { currentPage: 1, totalItems: 0, totalPages: 0 },
      };
    }
  }

  async ingestConversation(
    conversationId: string,
    messages: ConversationMessage[],
    userIds: string[],
    metadata?: Record<string, string | number | boolean>
  ) {
    log("ingestConversation: start", {
      conversationId,
      messageCount: messages.length,
      userIds,
    });

    if (messages.length === 0) {
      return { success: false as const, error: "No messages to ingest" };
    }

    const uniqueIds = [...new Set(userIds)].filter((id) => id.length > 0);
    if (uniqueIds.length === 0) {
      return { success: false as const, error: "At least one userId is required" };
    }

    const transcript = this.formatConversationTranscript(messages);
    const rawContent = `[Conversation ${conversationId}]\n${transcript}`;
    const content =
      rawContent.length > MAX_CONVERSATION_CHARS
        ? `${rawContent.slice(0, MAX_CONVERSATION_CHARS)}\n...[truncated]`
        : rawContent;

    const ingestMetadata = {
      type: "conversation",
      conversationId,
      messageCount: messages.length,
      ...metadata,
    };

    const savedIds: string[] = [];
    let firstError: string | null = null;

    for (const userId of uniqueIds) {
      const result = await this.addMemory(content, userId, ingestMetadata);
      if (result.success) {
        savedIds.push(result.id);
      } else if (!firstError) {
        firstError = result.error || "Failed to store conversation";
      }
    }

    if (savedIds.length === 0) {
      log("ingestConversation: error", { conversationId, error: firstError });
      return {
        success: false as const,
        error: firstError || "Failed to ingest conversation",
      };
    }

    const status = savedIds.length === uniqueIds.length ? "stored" : "partial";

    log("ingestConversation: success", {
      conversationId,
      status,
      storedCount: savedIds.length,
      requestedCount: uniqueIds.length,
    });

    return {
      success: true as const,
      id: savedIds[0] ?? "",
      conversationId,
      status,
      storedMemoryIds: savedIds,
    };
  }
}

export const supermemoryClient = new Mem0Client();
