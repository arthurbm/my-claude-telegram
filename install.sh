#!/bin/bash

set -e

REPO="arthurbm/my-claude-telegram"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="claude-telegram"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       Claude Code Telegram Notifier - Installer           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)
        case "$ARCH" in
            x86_64)  PLATFORM="linux-x64" ;;
            aarch64) PLATFORM="linux-arm64" ;;
            arm64)   PLATFORM="linux-arm64" ;;
            *)       echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
        esac
        ;;
    Darwin*)
        case "$ARCH" in
            x86_64)  PLATFORM="macos-x64" ;;
            arm64)   PLATFORM="macos-arm64" ;;
            *)       echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
        esac
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows-x64"
        BINARY_NAME="claude-telegram.exe"
        INSTALL_DIR="$HOME/bin"
        ;;
    *)
        echo -e "${RED}Unsupported operating system: $OS${NC}"
        exit 1
        ;;
esac

DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/claude-telegram-$PLATFORM"

echo "Detected platform: $PLATFORM"
echo "Installing to: $INSTALL_DIR/$BINARY_NAME"
echo ""

# Create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating directory: $INSTALL_DIR"
    sudo mkdir -p "$INSTALL_DIR" 2>/dev/null || mkdir -p "$INSTALL_DIR"
fi

# Download binary
echo "Downloading from: $DOWNLOAD_URL"
if command -v curl &> /dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "/tmp/$BINARY_NAME"
elif command -v wget &> /dev/null; then
    wget -q "$DOWNLOAD_URL" -O "/tmp/$BINARY_NAME"
else
    echo -e "${RED}Error: curl or wget is required${NC}"
    exit 1
fi

# Install binary
echo "Installing binary..."
if [ -w "$INSTALL_DIR" ]; then
    mv "/tmp/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/$BINARY_NAME"
else
    sudo mv "/tmp/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
    sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"
fi

# Verify installation
if command -v claude-telegram &> /dev/null; then
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                 Installation Complete!                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Run the setup wizard to configure your Telegram bot:"
    echo ""
    echo -e "  ${YELLOW}claude-telegram --setup${NC}"
    echo ""
else
    echo -e "${YELLOW}Binary installed to $INSTALL_DIR/$BINARY_NAME${NC}"
    echo ""
    echo "You may need to add $INSTALL_DIR to your PATH:"
    echo ""
    echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
    echo ""
    echo "Then run:"
    echo ""
    echo -e "  ${YELLOW}claude-telegram --setup${NC}"
fi
