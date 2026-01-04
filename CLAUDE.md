# CLAUDE.md

This file provides guidance to Claude Code when working with this kly app.

## Project Overview

<!-- Describe what this kly app does -->

This is a kly-powered CLI/MCP application built with TypeScript.

## Development Commands

```bash
bun run start              # Run the app directly
kly run ./src/index.ts     # Execute via kly CLI
kly mcp ./src/index.ts     # Start as MCP server for Claude Desktop/Code
```

## kly Core API

### Defining an App

```typescript
import { defineApp, tool } from "kly";
import { z } from "zod";

defineApp({
  name: "my-app",
  version: "0.1.0",
  description: "App description",
  tools: [myTool],
  instructions: "AI instructions for MCP mode",
  permissions: { /* see Permissions section */ }
});
```

### Defining Tools

```typescript
const myTool = tool({
  name: "tool-name",          // CLI subcommand / MCP tool name
  description: "What this tool does",
  inputSchema: z.object({
    param: z.string().describe("Parameter description"),
    optional: z.number().optional().describe("Optional param"),
  }),
  execute: async (args, context) => {
    // args: validated input from schema
    // context: ExecuteContext with mode, models, invokeDir
    return "result";
  }
});
```

### ExecuteContext

```typescript
interface ExecuteContext {
  mode: "cli" | "mcp" | "programmatic";  // Current runtime mode
  models: ModelsContext;                  // LLM models access
  invokeDir?: string;                     // Directory where kly run was invoked
  abortSignal?: AbortSignal;              // Cancellation signal
}
```

## LLM Integration

Access configured LLM models via `context.models`:

```typescript
execute: async (args, context) => {
  // List models (no permission needed)
  const models = context.models.list();
  const current = context.models.getCurrent();

  // Get full config with API key (requires apiKeys permission)
  const config = await context.models.getConfigAsync();
  if (config) {
    // config.provider: "openai" | "anthropic" | "google" | ...
    // config.model: model name (e.g., "gpt-4o-mini")
    // config.apiKey: API key
    // config.baseURL: optional base URL
  }
}
```

**Using with AI SDK:**

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const config = await context.models.getConfigAsync();
const provider = createOpenAI({ apiKey: config.apiKey })(config.model);
const { text } = await generateText({ model: provider, prompt: "Hello" });
```

## MCP Mode

When running as MCP server (`kly mcp ./src/index.ts`):

- All tools are exposed via Model Context Protocol
- `instructions` field guides AI on when/how to use tools
- Compatible with Claude Desktop, Claude Code, and other MCP clients

```typescript
defineApp({
  // ...
  instructions: "Use greet tool when user wants to say hello",
});
```

## Permissions

Declare permissions upfront in `defineApp`:

```typescript
permissions: {
  // API key access for LLM calls
  apiKeys: true,

  // Sandbox configuration
  sandbox: {
    network: {
      allowedDomains: ["api.github.com", "api.example.com"]
    },
    filesystem: {
      allowWrite: ["./output", "/tmp"],
      denyRead: ["/etc/secrets"]
    }
  }
}
```

**Permission notes:**

- `apiKeys: true` automatically allows LLM API domains (openai, anthropic, google, etc.)
- Default: no network, current directory read/write only
- `~/.kly`, `~/.ssh`, `~/.aws`, `~/.gnupg` are always protected

## UI Components (CLI mode only)

```typescript
import { log, input, select, confirm, spinner, output } from "kly/ui";

// Logging
log.info("Processing...");
log.success("Done!");
log.warn("Warning message");
log.step("Step description");

// Output (plain text or JSON)
output("Hello, world!");
output({ data: "value" });  // Auto-formats as JSON

// User input
const name = await input({ message: "Enter your name" });
const choice = await select({
  message: "Select option",
  options: [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" }
  ]
});
const confirmed = await confirm({ message: "Continue?" });

// Loading spinner
const s = spinner();
s.start("Loading...");
// ... do work
s.stop("Complete");
```

## Coding Guidelines

- **Static imports**: Prefer `import { tool } from "kly"` over dynamic imports
- **Use log utility**: Use `log.*` and `output()` instead of `console.*`
- **Single-tool apps**: Execute directly without subcommand selection
- **Multi-tool apps**: Interactive menu or CLI subcommand

## Project Structure

```
my-kly-app/
├── src/
│   ├── index.ts      # Entry: defineApp with tools
│   └── tools/        # Tool definitions
├── package.json
└── CLAUDE.md
```

**package.json for global command:**

```json
{
  "bin": {
    "my-command": "./src/index.ts"
  }
}
```

Install globally: `kly install .` or `kly link`
