# cc - Claude Code API Provider Switcher

A fast CLI tool for switching between different Claude Code API providers.

## Features

- Quickly switch between multiple Anthropic API keys
- Support subscription mode (no API key required)
- Support custom API endpoints (compatible with third-party services)
- Remember last used provider
- Interactive provider selection
- Launch Claude Code with selected provider

## Installation

Using kly:

```bash
kly link
```

**Note**: The command name `cc` conflicts with the system C compiler. You can either:

1. Use the command with full path after linking
2. Or run directly without linking: `kly run ./src/index.ts`

## Usage

### Add a Provider

Add a new API provider:

```bash
# Interactive mode
cc add

# With API key
cc add --name personal --apiKey sk-ant-... --description "My personal API key"

# Subscription mode (no API key)
cc add --name subscription --apiKey "" --description "Official subscription"

# Custom endpoint (third-party service)
cc add --name custom --apiKey sk-ant-... --baseUrl https://api.example.com/v1 --description "Custom endpoint"
```

### List Providers

List all configured providers:

```bash
# Human-readable format
cc list

# JSON format
cc list --json
```

### Switch Provider and Start Claude Code

Switch to a provider and automatically launch Claude Code:

```bash
# Interactive selection (last used provider shown first)
cc start

# Use specific provider
cc start --provider personal
```

Behavior:

- If you specify `--provider`, that provider will be used directly
- Otherwise, you'll see an interactive selection menu with all providers
- The last used provider appears first in the list (as default choice)

The tool will:

1. Update Claude Code settings with the selected provider
2. Automatically launch Claude Code in the background

### Remove a Provider

Remove a provider:

```bash
# Interactive selection
cc remove

# Direct removal
cc remove --name personal
```

## How It Works

The tool:

1. Stores provider configurations in `~/.cc/providers.json`
2. Updates `~/.claude/settings.json` with the selected provider settings:
   - `env.ANTHROPIC_AUTH_TOKEN` - API key (removed for subscription mode)
   - `env.ANTHROPIC_BASE_URL` - Custom endpoint (optional)
3. Launches Claude Code with the updated configuration

## Provider Modes

### API Key Mode

Use your own Anthropic API key. Charges are billed to your API account.

```bash
cc add --name personal --apiKey sk-ant-xxx
```

### Subscription Mode

Use Claude Code's built-in subscription. No API key required - Claude Code will use its official login flow.

```bash
cc add --name subscription --apiKey ""
```

### Custom Endpoint Mode

Use third-party API services compatible with Anthropic's API format.

```bash
cc add --name custom --apiKey sk-ant-xxx --baseUrl https://api.example.com/v1
```

## Configuration Storage

- **Providers**: `~/.cc/providers.json` - Contains all your API provider configurations
- **Claude Settings**: `~/.claude/settings.json` - Claude Code's configuration file

## Development

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Run directly
bun run start
# or
kly run ./src/index.ts
```

## Inspiration

Inspired by [cc-switch](https://github.com/farion1231/cc-switch).
