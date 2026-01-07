#!/bin/bash

set -e

INSTALL_DIR="/usr/local/bin"
BINARY_NAME="claude-telegram"
CONFIG_DIR="$HOME/.claude-telegram"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      Claude Code Telegram Notifier - Uninstaller          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Remove binary
if [ -f "$INSTALL_DIR/$BINARY_NAME" ]; then
    echo "Removing binary: $INSTALL_DIR/$BINARY_NAME"
    if [ -w "$INSTALL_DIR" ]; then
        rm -f "$INSTALL_DIR/$BINARY_NAME"
    else
        sudo rm -f "$INSTALL_DIR/$BINARY_NAME"
    fi
    echo -e "${GREEN}  ✓ Binary removed${NC}"
else
    echo -e "${YELLOW}  Binary not found at $INSTALL_DIR/$BINARY_NAME${NC}"
fi

# Remove config directory
if [ -d "$CONFIG_DIR" ]; then
    echo "Removing config: $CONFIG_DIR"
    rm -rf "$CONFIG_DIR"
    echo -e "${GREEN}  ✓ Config removed${NC}"
else
    echo -e "${YELLOW}  Config directory not found${NC}"
fi

# Remove hooks from Claude Code settings
if [ -f "$CLAUDE_SETTINGS" ]; then
    echo "Removing hooks from: $CLAUDE_SETTINGS"

    # Use a simple approach - create a backup and modify
    if command -v jq &> /dev/null; then
        # If jq is available, use it for proper JSON manipulation
        jq 'del(.hooks.Notification) | del(.hooks.Stop)' "$CLAUDE_SETTINGS" > "$CLAUDE_SETTINGS.tmp"
        mv "$CLAUDE_SETTINGS.tmp" "$CLAUDE_SETTINGS"
        echo -e "${GREEN}  ✓ Hooks removed${NC}"
    else
        echo -e "${YELLOW}  jq not found - please manually remove hooks from $CLAUDE_SETTINGS${NC}"
    fi
fi

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                  Uninstall Complete!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if installed via npm
if command -v npm &> /dev/null && npm list -g @arthurbm/claude-telegram &> /dev/null; then
    echo -e "${YELLOW}Note: Also run this to remove the npm package:${NC}"
    echo ""
    echo "  npm uninstall -g @arthurbm/claude-telegram"
    echo ""
fi
