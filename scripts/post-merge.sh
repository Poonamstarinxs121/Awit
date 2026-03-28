#!/bin/bash
# post-merge.sh v1.0.0
# Runs automatically after task merges to install dependencies
set -e

echo "[post-merge] Installing server dependencies..."
cd /home/runner/workspace/server && npm install --silent

echo "[post-merge] Installing client dependencies..."
cd /home/runner/workspace/client && npm install --silent

echo "[post-merge] Installing node app dependencies..."
cd /home/runner/workspace/node && npm install --silent

echo "[post-merge] Post-merge setup complete."
