#!/bin/bash

set -e

# SquidJob Node Setup Script for macOS
# This script sets up the Node app on a Mac and optionally installs it as a launchd service
# Usage:
#   ./setup-mac.sh                   Interactive setup with prompts
#   ./setup-mac.sh --install-service Non-interactive service install (requires .env to exist)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_HOME="$SCRIPT_DIR"
OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
LOG_DIR="$HOME/Library/Logs/squidjob-node"
SERVICE_NAME="com.squidjob.node"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_SERVICE_FLAG=false
for arg in "$@"; do
    case $arg in
        --install-service)
            INSTALL_SERVICE_FLAG=true
            shift
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  SquidJob Node Setup for macOS                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo "  Install from: https://nodejs.org/ (v18+)"
    exit 1
fi
NODE_BIN=$(command -v node)
NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ required (found $NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js${NC} $NODE_VERSION ($NODE_BIN)"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm${NC} $NPM_VERSION"

ENV_FILE="$NODE_HOME/.env"

if [ "$INSTALL_SERVICE_FLAG" = true ]; then
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}✗ .env file not found. Run without --install-service first to configure.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Using existing .env (non-interactive mode)${NC}"
    SKIP_CONFIG=true
    INSTALL_SERVICE="y"
else
    if [ -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}ℹ .env file already exists${NC}"
        read -p "Overwrite existing .env? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Using existing .env. Skipping configuration."
            SKIP_CONFIG=true
        fi
    fi
fi

echo ""

if [ "$SKIP_CONFIG" != "true" ]; then
    echo -e "${BLUE}Configure Node App${NC}"
    echo "Press Enter to use default values shown in [brackets]"
    echo ""

    read -p "Hub URL [https://squidjob-hub.onrender.com]: " HUB_URL
    HUB_URL="${HUB_URL:-https://squidjob-hub.onrender.com}"

    read -p "Node ID (from Hub registration) [mac-studio-1]: " NODE_ID
    NODE_ID="${NODE_ID:-mac-studio-1}"

    read -p "API Key (from Hub registration): " API_KEY
    if [ -z "$API_KEY" ]; then
        echo -e "${RED}✗ API Key is required${NC}"
        exit 1
    fi

    read -p "Node Name (friendly name) [mac-studio]: " NODE_NAME
    NODE_NAME="${NODE_NAME:-mac-studio}"

    read -sp "Admin Password (for local dashboard): " ADMIN_PASSWORD
    if [ -z "$ADMIN_PASSWORD" ]; then
        echo ""
        echo -e "${RED}✗ Admin Password is required${NC}"
        exit 1
    fi
    echo ""

    echo ""
    read -p "Install as macOS service (auto-start on boot)? (y/n) [y]: " INSTALL_SERVICE
    INSTALL_SERVICE="${INSTALL_SERVICE:-y}"

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

    chmod 600 "$ENV_FILE"
    echo ""
    echo -e "${GREEN}✓ Created .env file (permissions restricted)${NC}"
fi

echo ""

echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$NODE_HOME"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""

if [[ "$INSTALL_SERVICE" =~ ^[Yy]$ ]] || [ "$INSTALL_SERVICE" = "true" ] || [ "$INSTALL_SERVICE_FLAG" = true ]; then
    echo -e "${YELLOW}Building production bundle...${NC}"
    cd "$NODE_HOME"
    npm run build
    echo -e "${GREEN}✓ Production build complete${NC}"

    echo ""
    echo -e "${BLUE}Setting up macOS service...${NC}"

    mkdir -p "$LOG_DIR"

    PLIST_TEMPLATE="$NODE_HOME/com.squidjob.node.plist"
    if [ ! -f "$PLIST_TEMPLATE" ]; then
        echo -e "${RED}✗ Plist template not found at $PLIST_TEMPLATE${NC}"
        exit 1
    fi
    sed -e "s|__NODE_HOME__|$NODE_HOME|g" -e "s|__LOG_DIR__|$LOG_DIR|g" -e "s|__NODE_BIN__|$NODE_BIN|g" "$PLIST_TEMPLATE" > "$PLIST_PATH"

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
    echo -e "${BLUE}Starting dev server...${NC}"
    echo "The Node app will start on http://localhost:3200"
    echo "Press Ctrl+C to stop."
    echo ""
    cd "$NODE_HOME"
    npm run dev
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Open local dashboard:  http://localhost:3200"
echo "  2. Open Hub (cloud):      ${HUB_URL:-https://squidjob-hub.onrender.com}"
echo "  3. Go to Fleet → your machine should appear as 'online'"
echo ""
echo "For offline testing:"
echo "  • Disconnect from WiFi"
echo "  • Run a task or generate activity"
echo "  • Check SQLite: sqlite3 ~/.openclaw/squidjob-node.db"
echo "  • Reconnect: data auto-syncs within 5 minutes"
echo ""
