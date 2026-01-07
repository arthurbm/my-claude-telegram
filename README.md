# Claude Code Telegram Notifier

Get Telegram notifications when Claude Code needs your approval. Respond with interactive buttons or free-text replies from anywhere.

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Supported Platforms](#supported-platforms)
- [CLI Reference](#cli-reference)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Development](#development)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [License](#license)

## Features

- **Interactive Notifications** - Receive rich messages with action buttons
- **One-tap Responses** - Approve, Deny, Skip, or Reply with a single tap
- **Free-text Replies** - Send custom text responses back to Claude
- **Zero Dependencies** - Uses only Bun's native APIs
- **Easy Setup** - Interactive wizard configures everything in minutes
- **Git Context** - Shows project name and current branch in notifications
- **Cross-Platform** - Pre-built binaries for Linux, macOS, and Windows

## How It Works

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Claude Code │────▶│   Hook      │────▶│   Telegram   │
│  needs input │     │  (notify.ts)│     │   Bot API    │
└──────────────┘     └─────────────┘     └──────────────┘
                            │                    │
                            │    ┌───────────────┘
                            │    │ You respond
                            ▼    ▼
                     ┌─────────────┐
                     │ Exit code   │
                     │ 0 = approve │
                     │ 2 = deny    │
                     └─────────────┘
```

When Claude Code requests permission for an action, you'll receive a Telegram message like this:

```
Claude Code

Project: my-app (main)
Tool: Bash
Event: permission prompt

rm -rf node_modules && npm install

[Approve] [Deny]
[Skip]    [Reply]
```

## Installation

### Option 1: npm/bun (recommended)

Requires [Bun](https://bun.sh) or [Node.js](https://nodejs.org).

```bash
# Install globally
bun add -g @arthurbm/claude-telegram
# or
npm install -g @arthurbm/claude-telegram

# Run setup wizard
claude-telegram --setup

# Test the connection
claude-telegram --test
```

### Option 2: Standalone binary (via curl)

No runtime dependencies required.

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/arthurbm/my-claude-telegram/main/install.sh | bash

# Run setup wizard
claude-telegram --setup

# Test the connection
claude-telegram --test
```

### Option 3: From source

```bash
# Clone the repository
git clone https://github.com/arthurbm/my-claude-telegram.git
cd my-claude-telegram
bun install

# Run setup wizard
bun run setup.ts

# Test the connection
bun run src/notify.ts --test
```

### Create a Telegram Bot

Before running setup, create a bot:

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g., "Claude Code Notifier")
4. Choose a username (must end in `bot`, e.g., `my_claude_bot`)
5. Save the token (looks like `123456789:ABCdefGHI...`)

The setup wizard will guide you through the rest.

## Supported Platforms

| Platform | Architecture | Binary |
|----------|--------------|--------|
| Linux | x64 | `claude-telegram-linux-x64` |
| Linux | ARM64 | `claude-telegram-linux-arm64` |
| macOS | x64 (Intel) | `claude-telegram-macos-x64` |
| macOS | ARM64 (Apple Silicon) | `claude-telegram-macos-arm64` |
| Windows | x64 | `claude-telegram-windows-x64.exe` |

## CLI Reference

```bash
claude-telegram [options]
```

| Option | Description |
|--------|-------------|
| `--setup` | Run the interactive setup wizard |
| `--test` | Send a test notification to verify setup |
| `--uninstall` | Remove binary, config, and hooks |
| `--version` | Show version number |
| `--help` | Show help message |

**Examples:**

```bash
claude-telegram --setup      # Configure your Telegram bot
claude-telegram --test       # Send a test notification
claude-telegram              # Normal mode (called by Claude Code hooks)
```

## Usage

### Button Actions

| Button | Action | Exit Code |
|--------|--------|-----------|
| **Approve** | Allow the action | 0 |
| **Deny** | Block the action | 2 |
| **Skip** | Continue without feedback | 0 |
| **Reply** | Send a text response | 0 |

### Text Responses

1. Click **Reply** on the notification
2. Type your message (or `/cancel` to abort)
3. Your response is sent to Claude Code as context

## Configuration

### Config File

Location: `~/.claude-telegram/config.json`

```json
{
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chatId": "987654321",
  "timeout": 3600
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `botToken` | Your Telegram bot token | Required |
| `chatId` | Your Telegram chat ID | Required |
| `timeout` | Response timeout in seconds | 3600 (1 hour) |

### Claude Code Hooks

The setup wizard automatically configures hooks in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "claude-telegram",
            "timeout": 3600
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "claude-telegram --event=stop",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## Architecture

```
src/
├── notify.ts         # CLI entry point, handles hook input/output
├── telegram.ts       # Telegram Bot API client with polling
├── config.ts         # Configuration management
├── setup-wizard.ts   # Embedded setup wizard for compiled binary
└── types.ts          # TypeScript type definitions

scripts/
├── build.ts          # Multi-platform build script
└── release.ts        # Release preparation script

setup.ts              # Interactive setup wizard (dev mode)
install.sh            # curl installer
uninstall.sh          # curl uninstaller
```

### Modules

| File | Purpose |
|------|---------|
| `notify.ts` | Parses Claude Code hook input, formats messages, returns exit codes |
| `telegram.ts` | Sends messages, manages buttons, polls for responses |
| `config.ts` | Loads/saves config from `~/.claude-telegram/config.json` |
| `types.ts` | TypeScript interfaces for Claude hooks and Telegram API |
| `setup-wizard.ts` | Setup functions embedded in compiled binary |

## Development

### Prerequisites

- Bun 1.0+
- TypeScript 5+

### Scripts

```bash
bun install              # Install dependencies
bun test                 # Run test suite (25 tests)
bun x ultracite fix      # Format and lint code
bun x ultracite check    # Check for issues
```

### Build Scripts

```bash
bun run build            # Build for all platforms
bun run build:current    # Build for current platform only
bun run release          # Generate checksums for release
```

### Output

Build artifacts are placed in `dist/`:

```
dist/
├── claude-telegram-linux-x64
├── claude-telegram-linux-arm64
├── claude-telegram-macos-x64
├── claude-telegram-macos-arm64
├── claude-telegram-windows-x64.exe
└── checksums.txt
```

### Code Quality

This project uses [Ultracite](https://github.com/haydenbleasel/ultracite) with Biome for linting and formatting. Pre-commit hooks ensure code quality.

### Running Tests

```bash
bun test
```

Tests cover:
- Configuration loading/saving
- Telegram client API calls
- Message formatting and HTML escaping
- Notification context parsing

### Creating a Release

```bash
# 1. Update version in package.json
# 2. Commit changes
git add . && git commit -m "Release v1.0.1"

# 3. Create and push tag
git tag v1.0.1
git push origin v1.0.1

# GitHub Actions will automatically:
# - Build for all platforms
# - Generate checksums
# - Create GitHub release
# - Publish to npm
```

## Uninstallation

### If installed via npm/bun

```bash
bun remove -g @arthurbm/claude-telegram
# or
npm uninstall -g @arthurbm/claude-telegram
```

### If installed via curl

```bash
claude-telegram --uninstall
# or
curl -fsSL https://raw.githubusercontent.com/arthurbm/my-claude-telegram/main/uninstall.sh | bash
```

This removes:
- The binary from `/usr/local/bin/`
- Config directory `~/.claude-telegram/`
- Hooks from `~/.claude/settings.json`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Config not found" | Run `claude-telegram --setup` |
| "Invalid token format" | Check token format from @BotFather (should contain `:`) |
| Can't detect Chat ID | Send a message to your bot first, then retry |
| No notifications received | Run `claude-telegram --test` to verify setup |
| Hooks not triggering | Check `~/.claude/settings.json` syntax |
| Timeout before response | Increase `timeout` in config (default: 3600s) |

## Security

- **No external dependencies** in production - smaller attack surface
- **Token stored locally** in `~/.claude-telegram/config.json`
- **Timeout protection** - denies by default if no response
- **HTML sanitization** - escapes special characters in messages

## License

MIT

---

Built with [Bun](https://bun.sh) and the [Telegram Bot API](https://core.telegram.org/bots/api).
