import { CONFIG } from "../config.js";

interface ProfileData {
  static: unknown[];
  dynamic: unknown[];
}

interface ProfileResponseMinimal {
  profile?: ProfileData | null;
}

interface MemoryResultMinimal {
  similarity?: number;
  memory?: string;
  chunk?: string;
}

interface MemoriesResponseMinimal {
  results?: MemoryResultMinimal[];
}

function extractFactText(fact: unknown): string {
  if (typeof fact === "string") return fact;
  if (fact != null && typeof fact === "object") {
    const content = (fact as { content?: string }).content;
    if (typeof content === "string") return content;
    return JSON.stringify(fact);
  }
  return String(fact ?? "");
}

export function formatContextForPrompt(
  profile: ProfileResponseMinimal | null,
  userMemories: MemoriesResponseMinimal,
  projectMemories: MemoriesResponseMinimal
): string {
  const parts: string[] = ["[mem0]"];

  if (CONFIG.injectProfile && profile?.profile) {
    const { static: staticFacts, dynamic: dynamicFacts } = profile.profile;

    if (staticFacts.length > 0) {
      parts.push("\nUser Profile:");
      staticFacts.slice(0, CONFIG.maxProfileItems).forEach((fact) => {
        const text = extractFactText(fact);
        parts.push(`- ${text}`);
      });
    }

    if (dynamicFacts.length > 0) {
      parts.push("\nRecent Context:");
      dynamicFacts.slice(0, CONFIG.maxProfileItems).forEach((fact) => {
        const text = extractFactText(fact);
        parts.push(`- ${text}`);
      });
    }
  }

  const projectResults = projectMemories.results || [];
  if (projectResults.length > 0) {
    parts.push("\nProject Knowledge:");
    projectResults.forEach((mem) => {
      const similarity = Math.round((mem.similarity ?? 0) * 100);
      const content = mem.memory || mem.chunk || "";
      parts.push(`- [${similarity}%] ${content}`);
    });
  }

  const userResults = userMemories.results || [];
  if (userResults.length > 0) {
    parts.push("\nRelevant Memories:");
    userResults.forEach((mem) => {
      const similarity = Math.round((mem.similarity ?? 0) * 100);
      const content = mem.memory || mem.chunk || "";
      parts.push(`- [${similarity}%] ${content}`);
    });
  }

  if (parts.length === 1) {
    return "";
  }

  return parts.join("\n");
}
