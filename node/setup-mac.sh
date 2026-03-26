#!/bin/bash

set -e

# SquidJob Node Setup Script for macOS
# This script sets up the Node app on a Mac and optionally installs it as a launchd service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_HOME="$SCRIPT_DIR"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
LOG_DIR="$HOME/Library/Logs/squidjob-node"
SERVICE_NAME="com.squidjob.node"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SquidJob Node Setup for macOS                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "  Install from: https://nodejs.org/ (v18+)"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js${NC} $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm${NC} $NPM_VERSION"

# Check if .env exists
ENV_FILE="$NODE_HOME/.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}ℹ .env file already exists${NC}"
    read -p "Overwrite existing .env? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Using existing .env. Skipping configuration."
        SKIP_CONFIG=true
    fi
fi

echo ""

# Configuration prompts (unless skipping)
if [ "$SKIP_CONFIG" != "true" ]; then
    echo -e "${BLUE}Configure Node App${NC}"
    echo "Press Enter to use default values shown in [brackets]"
    echo ""

    # Hub URL
    read -p "Hub URL [https://squidjob-hub.onrender.com]: " HUB_URL
    HUB_URL="${HUB_URL:-https://squidjob-hub.onrender.com}"

    # Node ID
    read -p "Node ID (from Hub registration) [mac-studio-1]: " NODE_ID
    NODE_ID="${NODE_ID:-mac-studio-1}"

    # API Key
    read -p "API Key (from Hub registration) [squidjob-api-key]: " API_KEY
    API_KEY="${API_KEY:-squidjob-api-key}"

    # Node Name
    read -p "Node Name (friendly name) [mac-studio]: " NODE_NAME
    NODE_NAME="${NODE_NAME:-mac-studio}"

    # Admin Password
    read -sp "Admin Password (for local dashboard) [changeme]: " ADMIN_PASSWORD
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
    echo ""

    # Install as service?
    echo ""
    read -p "Install as macOS service (auto-start on boot)? (y/n) [y]: " INSTALL_SERVICE
    INSTALL_SERVICE="${INSTALL_SERVICE:-y}"

    # Write .env file
    cat > "$ENV_FILE" << EOF
# SquidJob Node Configuration
# Generated: $(date)

OPENCLAW_DIR=$OPENCLAW_DIR
NODE_NAME=$NODE_NAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

NODE_HUB_URL=$HUB_URL
NODE_HUB_API_KEY=$API_KEY
NODE_ID=$NODE_ID
EOF

    echo ""
    echo -e "${GREEN}✓ Created .env file${NC}"
    cat "$ENV_FILE"
fi

echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$NODE_HOME"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""

# Install as macOS service (optional)
if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]] || [ "$INSTALL_SERVICE" = "true" ]; then
    echo -e "${BLUE}Setting up macOS service...${NC}"

    # Create log directory
    mkdir -p "$LOG_DIR"

    # Create plist content
    cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/env</string>
        <string>node</string>
        <string>$NODE_HOME/node_modules/.bin/next</string>
        <string>start</string>
        <string>-H</string>
        <string>0.0.0.0</string>
        <string>-p</string>
        <string>3200</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$NODE_HOME</string>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/output.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/error.log</string>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF

    # Load the service
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"

    echo -e "${GREEN}✓ Service installed: $SERVICE_NAME${NC}"
    echo ""
    echo "Service commands:"
    echo "  Start:   launchctl start $SERVICE_NAME"
    echo "  Stop:    launchctl stop $SERVICE_NAME"
    echo "  Status:  launchctl list | grep $SERVICE_NAME"
    echo "  Logs:    tail -f $LOG_DIR/output.log"
    echo ""
    echo -e "${GREEN}✓ Node app started and will auto-start on Mac boot${NC}"
else
    echo -e "${YELLOW}Skipping service installation${NC}"
    echo ""
    echo "To start the Node app manually, run:"
    echo "  cd $NODE_HOME"
    echo "  npm run dev"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Open local dashboard:  http://localhost:3200"
echo "  2. Open Hub (cloud):      $HUB_URL"
echo "  3. Go to Fleet → your machine should appear as 'online'"
echo ""
echo "For offline testing:"
echo "  • Disconnect from WiFi"
echo "  • Run a task or generate activity"
echo "  • Check SQLite: sqlite3 ~/.openclaw/squidjob-node.db"
echo "  • Reconnect: data auto-syncs within 5 minutes"
echo ""
