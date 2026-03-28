#!/bin/bash
# squidjob-update.sh v1.0.0
# Standalone update script for SquidJob Node app
# Usage: ./scripts/squidjob-update.sh [DOWNLOAD_URL]
# If no DOWNLOAD_URL is given, uses NODE_HUB_URL from .env (downloads from Hub)
#
# What it does:
#   1. Backs up SQLite database
#   2. Pauses hub sync by writing a pause marker
#   3. Downloads new version from Hub (or provided URL)
#   4. Extracts, preserving .env and database
#   5. Runs npm install
#   6. Cleans up and reports success
#
# Run from the squidjob-node root directory.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()    { echo -e "${CYAN}[update]${NC} $1"; }
ok()     { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
fail()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$ENV_FILE" | xargs) 2>/dev/null || true
fi

OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
DB_FILE="$OPENCLAW_DIR/squidjob-node.db"
BACKUP_DIR="$OPENCLAW_DIR/backups"
PAUSE_MARKER="$OPENCLAW_DIR/.services-paused"
TMP_DIR="$OPENCLAW_DIR/update-tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/squidjob-node.db.${TIMESTAMP}.bak"

HUB_URL="${NODE_HUB_URL:-}"
DOWNLOAD_URL="${1:-}"

if [ -z "$DOWNLOAD_URL" ] && [ -n "$HUB_URL" ]; then
  DOWNLOAD_URL="${HUB_URL}/v1/downloads/node"
fi

if [ -z "$DOWNLOAD_URL" ]; then
  fail "No download URL. Provide a URL as argument or set NODE_HUB_URL in .env"
fi

echo ""
echo "  SquidJob Node — Self-Update"
echo "  App dir : $APP_DIR"
echo "  DB      : $DB_FILE"
echo "  Backup  : $BACKUP_DIR"
echo "  From    : $DOWNLOAD_URL"
echo ""

cleanup() {
  if [ -f "$PAUSE_MARKER" ]; then
    rm -f "$PAUSE_MARKER"
    log "Services unpause marker removed."
  fi
  if [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}

rollback_db() {
  warn "Rolling back database..."
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$DB_FILE"
    ok "Database rolled back from backup."
  else
    warn "No backup to rollback to."
  fi
}

trap 'echo ""; warn "Update interrupted. Running cleanup..."; rollback_db; cleanup; exit 1' ERR INT TERM

# ── Step 1: Backup ────────────────────────────────────────────────────────────
log "Step 1/5: Backing up database..."
mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
  cp "$DB_FILE" "$BACKUP_FILE"
  ok "Backed up to: $BACKUP_FILE"
else
  warn "No database file found at $DB_FILE — skipping backup."
fi

# ── Step 2: Pause Services ────────────────────────────────────────────────────
log "Step 2/5: Pausing background services..."
touch "$PAUSE_MARKER"
ok "Pause marker created (hub sync will skip until cleared)."
sleep 1

# ── Step 3: Download ──────────────────────────────────────────────────────────
log "Step 3/5: Downloading new version..."
mkdir -p "$TMP_DIR"
ZIP_FILE="$TMP_DIR/squidjob-node.zip"

if command -v curl &> /dev/null; then
  curl -fsSL -o "$ZIP_FILE" "$DOWNLOAD_URL" || fail "Download failed from $DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
  wget -q -O "$ZIP_FILE" "$DOWNLOAD_URL" || fail "Download failed from $DOWNLOAD_URL"
else
  fail "Neither curl nor wget found. Install one and retry."
fi

ok "Download complete: $(du -sh "$ZIP_FILE" | cut -f1)"

# ── Step 4: Extract & Install ─────────────────────────────────────────────────
log "Step 4/5: Extracting and installing files..."
EXTRACT_DIR="$TMP_DIR/extracted"
mkdir -p "$EXTRACT_DIR"

unzip -q -o "$ZIP_FILE" -d "$EXTRACT_DIR" || fail "Failed to unzip downloaded package."

SRC_DIR="$EXTRACT_DIR"
if [ -d "$EXTRACT_DIR/node" ]; then
  SRC_DIR="$EXTRACT_DIR/node"
fi
if [ ! -f "$SRC_DIR/package.json" ]; then
  NESTED=$(find "$EXTRACT_DIR" -maxdepth 2 -name "package.json" | head -1)
  if [ -n "$NESTED" ]; then
    SRC_DIR=$(dirname "$NESTED")
  fi
fi

log "Copying files (preserving .env and database)..."
rsync -a \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='squidjob-node.db' \
  "$SRC_DIR/" "$APP_DIR/" 2>/dev/null || \
  (cd "$SRC_DIR" && find . -type f \
    ! -path './.env' \
    ! -path './.env.local' \
    ! -path './node_modules/*' \
    ! -path './.next/*' \
    ! -name 'squidjob-node.db' \
    -exec install -D "{}" "$APP_DIR/{}" \;)

ok "Files copied."

log "Installing dependencies..."
cd "$APP_DIR"
npm install --prefer-offline --silent || fail "npm install failed."
ok "Dependencies installed."

# ── Step 5: Resume Services ───────────────────────────────────────────────────
log "Step 5/5: Resuming services..."
rm -f "$PAUSE_MARKER"
rm -rf "$TMP_DIR"
ok "Services resumed."

# ── Cleanup old backups (keep last 5) ─────────────────────────────────────────
ls -t "$BACKUP_DIR"/*.bak 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

echo ""
echo -e "  ${GREEN}Update complete!${NC}"
echo "  The node app files have been updated."
echo "  Please restart the app to apply changes:"
echo ""
echo "    npm run dev"
echo "    # or: pm2 restart squidjob-node"
echo ""
