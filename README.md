# Claude Code Telegram Notifier

Get Telegram notifications when Claude Code needs your approval. Respond with interactive buttons or free-text replies from anywhere.

## Features

- **Interactive Notifications** - Receive rich messages with action buttons
- **One-tap Responses** - Approve, Deny, Skip, or Reply with a single tap
- **Free-text Replies** - Send custom text responses back to Claude
- **Zero Dependencies** - Uses only Bun's native APIs
- **Easy Setup** - Interactive wizard configures everything in minutes
- **Git Context** - Shows project name and current branch in notifications

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

## Quick Start

**Prerequisites:** [Bun](https://bun.sh) 1.0+ and a Telegram account

```bash
# 1. Clone and install
git clone <repo-url>
cd my-claude-telegram
bun install

# 2. Run the setup wizard
bun run setup.ts

# 3. Test the connection
bun run src/notify.ts --test
```

## Installation

### Step 1: Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g., "Claude Code Notifier")
4. Choose a username (must end in `bot`, e.g., `my_claude_bot`)
5. Save the token (looks like `123456789:ABCdefGHI...`)

### Step 2: Run Setup

```bash
bun run setup.ts
```

The wizard will:
1. Ask for your bot token
2. Detect your Chat ID automatically (send a message to your bot first)
3. Test the connection
4. Install hooks in Claude Code (optional)

### Step 3: Verify

```bash
bun run src/notify.ts --test
```

You should receive a test message in Telegram.

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

### Available Commands

```bash
# Run setup wizard
bun run setup.ts

# Test Telegram connection
bun run src/notify.ts --test

# Run linter
bun x ultracite check

# Fix lint issues
bun x ultracite fix

# Run tests
bun test
```

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

The setup wizard can automatically configure hooks in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "bun run /path/to/src/notify.ts",
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
            "command": "bun run /path/to/src/notify.ts --event=stop",
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
├── notify.ts      # CLI entry point, handles hook input/output
├── telegram.ts    # Telegram Bot API client with polling
├── config.ts      # Configuration management
└── types.ts       # TypeScript type definitions

setup.ts           # Interactive setup wizard
```

### Modules

| File | Purpose |
|------|---------|
| `notify.ts` | Parses Claude Code hook input, formats messages, returns exit codes |
| `telegram.ts` | Sends messages, manages buttons, polls for responses |
| `config.ts` | Loads/saves config from `~/.claude-telegram/config.json` |
| `types.ts` | TypeScript interfaces for Claude hooks and Telegram API |
| `setup.ts` | Interactive wizard for first-time configuration |

## Development

### Prerequisites

- Bun 1.0+
- TypeScript 5+

### Scripts

```bash
bun install          # Install dependencies
bun test             # Run test suite (25 tests)
bun x ultracite fix  # Format and lint code
bun x ultracite check # Check for issues
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

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Config not found" | Run `bun run setup.ts` |
| "Invalid token format" | Check token format from @BotFather (should contain `:`) |
| Can't detect Chat ID | Send a message to your bot first, then retry |
| No notifications received | Run `bun run src/notify.ts --test` to verify setup |
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
