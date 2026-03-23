# opencode-mem0 — mem0 self-hosted memory plugin for OpenCode

OpenCode plugin for persistent memory using [mem0](https://mem0.ai) self-hosted Docker backend.

Your agent remembers what you tell it — across sessions, across projects — without sending data to any third-party cloud service.

## Quick Start

### 1. Start mem0 Docker backend

```bash
docker compose up -d
```

This starts the mem0 REST API at `http://localhost:8000`.  
You need an `OPENAI_API_KEY` set in your environment (mem0 uses it for embeddings).

### 2. Set environment variables

```bash
# Required: point the plugin to your mem0 instance (default shown)
export MEM0_BASE_URL=http://localhost:8000

# Optional: set an API key if you configured mem0 with authentication
export MEM0_API_KEY=your-key
```

### 3. Install the plugin

```bash
bunx opencode-mem0@latest install
```

Or add manually to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-mem0"]
}
```

## Configuration

Create `~/.config/opencode/mem0.jsonc`:

```jsonc
{
  // mem0 base URL (can also use MEM0_BASE_URL env var)
  "baseUrl": "http://localhost:8000",

  // API key if mem0 is configured with authentication (can also use MEM0_API_KEY env var)
  "apiKey": "your-key",

  // Min similarity for memory retrieval (0-1)
  "similarityThreshold": 0.6,

  // Max memories injected per request
  "maxMemories": 5,

  // Max project memories listed
  "maxProjectMemories": 10,

  // Max profile facts injected
  "maxProfileItems": 5,

  // Include user profile in context
  "injectProfile": true,

  // Prefix for container tags
  "containerTagPrefix": "opencode",

  // Optional: Set exact user container tag (overrides auto-generated tag)
  "userContainerTag": "my-custom-user-tag",

  // Optional: Set exact project container tag (overrides auto-generated tag)
  "projectContainerTag": "my-project-tag",

  // Extra keyword patterns for memory detection (regex)
  "keywordPatterns": ["log\\s+this", "write\\s+down"],

  // Context usage ratio that triggers compaction (0-1)
  "compactionThreshold": 0.8,
}
```

All fields are optional. Environment variables take precedence over config file values.

## Tool Usage

The `mem0` tool is available to the agent:

| Mode      | Args                         | Description       |
| --------- | ---------------------------- | ----------------- |
| `add`     | `content`, `type?`, `scope?` | Store memory      |
| `search`  | `query`, `scope?`            | Search memories   |
| `profile` | `query?`                     | View user profile |
| `list`    | `scope?`, `limit?`           | List memories     |
| `forget`  | `memoryId`, `scope?`         | Delete memory     |

**Scopes:** `user` (cross-project), `project` (default)

**Types:** `project-config`, `architecture`, `error-solution`, `preference`, `learned-pattern`, `conversation`

## Features

### Context Injection

On first message of a session, the agent receives (invisible to user):

- User profile (recent cross-project memories)
- Project memories (all project knowledge)
- Relevant user memories (semantic search)

### Keyword Detection

Say "remember", "save this", "don't forget" etc. and the agent auto-saves to memory.

```
You: "Remember that this project uses bun"
Agent: [saves to project memory]
```

Add custom triggers via `keywordPatterns` config.

### Preemptive Compaction

When context hits 80% capacity:

1. Triggers OpenCode's summarization
2. Injects project memories into summary context
3. Saves session summary as a memory

This preserves conversation context across compaction events.

### Privacy

```
API key is <private>sk-abc123</private>
```

Content in `<private>` tags is never stored.

## Memory Scoping

| Scope   | user_id                                | Persists     |
| ------- | -------------------------------------- | ------------ |
| User    | `opencode_user_{sha256(git email)}`    | All projects |
| Project | `opencode_project_{sha256(directory)}` | This project |

## Development

```bash
bun install
bun run build
bun run typecheck
```

Local install:

```jsonc
{
  "plugin": ["file:///path/to/opencode-mem0"],
}
```

## Logs

```bash
tail -f ~/.opencode-supermemory.log
```

## License

MIT
