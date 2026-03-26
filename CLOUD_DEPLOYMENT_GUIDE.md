# SquidJob Cloud Deployment & Mac Node Setup Guide

Complete step-by-step instructions for deploying the SquidJob Hub to Render.com and setting up Mac machines as local nodes.

---

## PART 1: PREPARE YOUR GITHUB REPOSITORY

### Step 1.1: Ensure Repo is Public on GitHub
```bash
# Push the latest code to GitHub
git add .
git commit -m "Prepare for cloud deployment"
git push origin main
```
**Note:** Your repository must be public or connected to Render for deployment to work.

---

## PART 2: DEPLOY THE HUB TO RENDER.COM

### Step 2.1: Create a Render.com Account
1. Go to [render.com](https://render.com)
2. Sign up (use GitHub login for easier deployment)
3. Accept the terms

### Step 2.2: Create a PostgreSQL Database
1. From the Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in the form:
   - **Name:** `squidjob-db` (suggested)
   - **Database:** `squidjob` (suggested)
   - **User:** `squidjob_user` (suggested)
   - **Region:** Select the region closest to you (e.g., `us-east` if in North America)
   - **Plan:** Free tier is fine for testing; upgrade later if needed
3. Click **"Create Database"**
4. **Wait 2-3 minutes** for the database to initialize
5. Once ready, copy the **Internal Database URL** (e.g., `postgresql://user:pass@localhost/squidjob`) — you'll need this

### Step 2.3: Create a Web Service
1. Click **"New +"** → **"Web Service"**
2. Select your SquidJob GitHub repository
3. Fill in the form:
   - **Name:** `squidjob-hub` (suggested)
   - **Environment:** `Node` (default)
   - **Build Command:** See below
   - **Start Command:** See below
   - **Plan:** Free tier for testing

#### Build Command
```bash
cd client && npm install && npm run build && cd ../server && npm install && npm run build
```

#### Start Command
```bash
cd server && NODE_ENV=production node dist/index.js
```

### Step 2.4: Configure Environment Variables
In the Web Service settings, add these **Environment** variables:

| Key | Value | Description |
|-----|-------|-------------|
| `DATABASE_URL` | Paste the Internal Database URL from Step 2.2 | PostgreSQL connection string |
| `JWT_SECRET` | `squidjob-jwt-secret-$(openssl rand -hex 32)` (or any 32+ char string) | Secret for JWT tokens. Suggested: auto-generate or use `squidjob-prod-jwt-secret-change-me-in-prod` |
| `ENCRYPTION_KEY` | `squidjob-encrypt-key-32-bytes-min!` | Must be exactly 32 bytes. Suggested: keep as shown or use `squidjob-local-encrypt-key-32b!` |
| `NODE_ENV` | `production` | Enable production mode |
| `PORT` | `5000` | (Optional) Server will use 5000 by default in production |

**⚠️ IMPORTANT:** After deployment, change `JWT_SECRET` and `ENCRYPTION_KEY` to strong, unique values and keep them secret.

### Step 2.5: Deploy
1. Click **"Create Web Service"**
2. Render will start the build process automatically
3. **Wait 5-10 minutes** for the deployment to complete
4. Once live, you'll see a green **"Live"** badge and a URL like `https://squidjob-hub.onrender.com`
5. **Test it:** Open the URL in a browser — you should see the SquidJob login page

**Default Credentials (Demo):**
- Email: `admin@squidjob.com`
- Password: `admin123`

### Step 2.6: (Optional) Add a Custom Domain
1. In the Web Service settings, go to **"Custom Domain"**
2. Add your domain (e.g., `squidjob.yourcompany.com`)
3. Update your DNS records as instructed by Render
4. SSL is automatic

---

## PART 3: REGISTER YOUR FIRST MAC MACHINE

### Step 3.1: Get Your Hub URL
From the Render dashboard, copy the deployed URL (e.g., `https://squidjob-hub.onrender.com`)

### Step 3.2: Get Your Mac's Local IP
On your Mac, open Terminal and run:
```bash
ipconfig getifaddr en0
```
**Example output:** `192.168.1.100` (save this)

### Step 3.3: Register the Mac on the Hub
Open Terminal on your Mac and run:
```bash
# Replace these values:
# - HUB_URL: your Render Hub URL (e.g., https://squidjob-hub.onrender.com)
# - ADMIN_EMAIL: admin@squidjob.com (default)
# - ADMIN_PASSWORD: admin123 (default)
# - YOUR_IP: from Step 3.2 (e.g., 192.168.1.100)

HUB_URL="https://squidjob-hub.onrender.com"
ADMIN_EMAIL="admin@squidjob.com"
ADMIN_PASSWORD="admin123"
YOUR_IP="192.168.1.100"

# Step 1: Login and get JWT token
TOKEN=$(curl -s -X POST "$HUB_URL/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
  echo "Login failed. Check credentials."
  exit 1
fi

echo "✓ Logged in. Token: ${TOKEN:0:20}..."

# Step 2: Register this Mac as a node
RESULT=$(curl -s -X POST "$HUB_URL/v1/nodes/register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Mac Studio\",\"url\":\"http://$YOUR_IP:3200\"}")

echo "Registration response:"
echo "$RESULT" | python3 -m json.tool

# Extract and save node_id and api_key
NODE_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('node_id', ''))")
API_KEY=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key', ''))")

echo ""
echo "========================================="
echo "SAVE THESE VALUES (shown only once):"
echo "NODE_ID: $NODE_ID"
echo "API_KEY: $API_KEY"
echo "========================================="
```

**⚠️ CRITICAL:** Copy the `NODE_ID` and `API_KEY` from the output. You'll need them in the next step.

---

## PART 4: SET UP THE NODE APP ON YOUR MAC

### Step 4.1: Download the Node App
Choose one option:

**Option A: Clone from GitHub (recommended)**
```bash
cd ~/Projects
git clone https://github.com/Poonamstarinxs121/Awit.git squidjob
cd squidjob/node
```

**Option B: Download ZIP from Hub (after deployment)**
```bash
# Use the Downloads page in the Hub UI or:
curl -o squidjob-node.zip "https://squidjob-hub.onrender.com/v1/downloads/node"
unzip squidjob-node.zip
cd node
```

### Step 4.2: Run the Setup Script
```bash
# From the ~/Projects/squidjob/node directory

# Make the script executable (if not already)
chmod +x setup-mac.sh

# Run the setup script
./setup-mac.sh
```

**The script will prompt you for:**

1. **Hub URL** (default: `https://squidjob-hub.onrender.com`)
   - Your deployed Render URL (from Step 3.1)
   - Press Enter to accept default or type your custom URL

2. **Node ID** (default: `mac-studio-1`)
   - Paste the `NODE_ID` from Step 3.3
   - Example: `node_123abc...`

3. **API Key** (default: `squidjob-api-key`)
   - Paste the `API_KEY` from Step 3.3
   - Example: `squidjob-key_abc123...`

4. **Node Name** (default: `mac-studio`)
   - Friendly name for this machine (e.g., `mac-studio`, `mac-mini`, `m4-mac`)

5. **Admin Password** (default: `changeme`)
   - Password to access the local Node dashboard at `http://localhost:3200`
   - Change to something secure

6. **Install as macOS service?** (default: `y` for yes)
   - If yes: creates a launchd service that auto-starts the Node app on Mac boot
   - If no: you'll manually start it each time

### Step 4.3: Verify Installation
After the setup script completes:

```bash
# The Node app should start automatically
# If manually started, in the node directory run:
npm run dev

# Open in browser:
# Local dashboard: http://localhost:3200
# Hub (cloud): https://squidjob-hub.onrender.com (go to Fleet → your Mac Studio node should be online)
```

**If installed as a service:**
```bash
# Check status
launchctl list | grep squidjob

# Start manually (if stopped)
launchctl start com.squidjob.node

# Stop
launchctl stop com.squidjob.node

# View logs
tail -f ~/Library/Logs/squidjob-node/output.log
```

---

## PART 5: ADD MORE MAC MACHINES TO THE FLEET

Repeat **PART 3** (registration) and **PART 4** (setup) for each additional Mac:

```bash
# On Mac 2, Mac 3, etc.:
# Step 1: Register on the Hub (get NODE_ID and API_KEY)
# Step 2: Clone/download the node app
# Step 3: Run setup-mac.sh with the new credentials
```

---

## PART 6: VERIFY OFFLINE RESILIENCE

### Step 6.1: Test Offline Sync
1. On your Mac, open Terminal:
   ```bash
   # Open local database to see stored data
   sqlite3 ~/.openclaw/squidjob-node.db
   
   # See what's stored locally
   SELECT * FROM activity;
   SELECT * FROM sessions;
   SELECT * FROM costs;
   ```

2. Disconnect your Mac from the internet (WiFi off or pull ethernet)

3. Run a task on your Mac or generate activity

4. Check local SQLite — data should be there:
   ```bash
   sqlite3 ~/.openclaw/squidjob-node.db "SELECT * FROM activity ORDER BY created_at DESC LIMIT 5;"
   ```

5. Reconnect to the internet

6. The Node app will automatically sync within 5 minutes (telemetry sync interval)

7. Check the Hub — the activity should now appear

**⚠️ Note:** The Hub marks the node as:
- `online` if it receives a heartbeat in the last 60 seconds
- `degraded` if no heartbeat for 90+ seconds
- `offline` if no heartbeat for 3+ minutes

When you go offline, it becomes `degraded` then `offline`, but data is safely stored locally and syncs when back online.

---

## PART 7: MANAGE MAC NODES

### View All Nodes in the Hub
1. Go to `https://squidjob-hub.onrender.com`
2. Click **Fleet** in the left dock
3. See all your registered Mac machines with:
   - Status (online, degraded, offline)
   - CPU / RAM / Disk usage
   - Agent count
   - Last heartbeat time

### View Per-Machine Org Chart
1. Click **Org Chart** in the left dock
2. Use the **Node Selector** tabs at the top:
   - **Hub** — agents defined in the cloud
   - **Mac Studio** — agents discovered from that Mac's OpenClaw
   - **Mac Mini** — agents from that machine
3. See the hierarchy, edit job titles, drag to set manager relationships

### Download Reports
1. In **Fleet Analytics**, see:
   - Cost trends across all machines
   - Per-machine and per-agent breakdowns
   - CPU/RAM/Disk usage trends

---

## PART 8: TROUBLESHOOTING

### Issue: Node Won't Connect to Hub

**Check 1: Verify Network**
```bash
curl -v https://squidjob-hub.onrender.com/health
```
Should return `{"status":"ok"}`

**Check 2: Verify Credentials**
```bash
cat ~/.openclaw/.env
# Should show NODE_HUB_API_KEY and NODE_HUB_URL
```

**Check 3: Check Local Logs**
```bash
# If running as service:
tail -f ~/Library/Logs/squidjob-node/output.log

# If running manually:
npm run dev
# Look for errors in the terminal
```

**Fix: Re-run Setup**
```bash
cd ~/Projects/squidjob/node
rm .env
./setup-mac.sh
```

### Issue: Hub Shows Node as Offline but It's Running

**Likely cause:** Firewall blocking port 3200

**Fix:**
```bash
# Check if Node is listening on 3200
lsof -i :3200

# If not, restart:
npm run dev

# Allow firewall (System Preferences → Security & Privacy → Firewall Options)
# Add Node.js to allowed apps, or temporarily disable firewall for testing
```

### Issue: OpenClaw Agents Not Showing

**Check: OpenClaw Config**
```bash
cat ~/.openclaw/openclaw.json
# Should have agents.list array

# If empty or missing:
# Create a sample file or point OpenClaw to your agents directory
```

### Issue: Data Not Syncing to Hub

**Check: Sync State**
```bash
sqlite3 ~/.openclaw/squidjob-node.db "SELECT * FROM sync_state;"
```

**If `lastTelemetrySyncAt` is old:**
- Wait 5 minutes (telemetry sync interval)
- Or restart the Node app: `npm run dev`
- Check logs for sync errors

---

## PART 9: PERFORMANCE & BEST PRACTICES

### SQLite Maintenance
SQLite needs no server — it just works. However, to keep it healthy:
```bash
# Occasionally vacuum the database (defragment)
sqlite3 ~/.openclaw/squidjob-node.db "VACUUM;"

# Check database size
du -h ~/.openclaw/squidjob-node.db
```

### Backup Local Data (Optional)
```bash
# Backup before updating or reinstalling
cp ~/.openclaw/squidjob-node.db ~/Desktop/squidjob-node-backup-$(date +%Y%m%d).db
```

### Monitor Resource Usage
From the Hub's **Fleet** view, see each Mac's:
- CPU usage (%)
- RAM usage (%)
- Disk usage (%)

If consistently high, consider:
- Closing other apps
- Reducing the number of agents per machine
- Upgrading Mac hardware

### Update the Node App
```bash
cd ~/Projects/squidjob/node
git pull origin main
npm install
npm run dev
# Or restart if running as service: launchctl restart com.squidjob.node
```

---

## PART 10: NEXT STEPS

### Customize Agents
1. In the Hub, go to **Agents**
2. Create or edit agents with:
   - Custom identity (Soul MD)
   - Tools and skills
   - Model configuration (OpenAI, Anthropic, etc.)

### Set Up Org Chart Hierarchy
1. Go to **Org Chart**
2. Drag agents to set reporting relationships
3. Edit job titles, departments, and status per machine

### Monitor Analytics
1. Go to **Fleet Analytics**
2. See cost trends, usage per model, per agent
3. Daily breakdowns for capacity planning

### Install Chrome Extension
1. Download from the Hub's Settings → Downloads
2. Load unpacked in Chrome: `Manage Extensions` → `Load unpacked`
3. Configure Hub URL + API key in the extension's options
4. Get desktop notifications when nodes go offline

---

## SUMMARY: WHAT'S HAPPENING BEHIND THE SCENES

| Component | Where | How Often |
|-----------|-------|-----------|
| **Heartbeat** | Mac → Hub | Every 60 seconds (CPU, RAM, disk, agent statuses) |
| **Telemetry** | Mac → Hub | Every 5 minutes (sessions, costs, activity since last sync) |
| **Polling** | Mac ← Hub | Every 30 seconds (check for task dispatches and messages) |
| **Offline Queue** | SQLite on Mac | Immediate (all data written locally first) |
| **Auto-Sync** | When Mac comes online | Automatic (catches up with buffered data) |

When your Mac is offline:
1. All sessions, costs, and activity are saved to SQLite
2. No data is lost
3. When you come back online, the Node syncs everything to the Hub
4. The Hub knows what happened during the downtime

---

## QUICK REFERENCE: DEFAULT VALUES

| Prompt | Default Value | Example |
|--------|---------------|---------|
| Hub URL | `https://squidjob-hub.onrender.com` | Or your custom domain |
| Node Name | `mac-studio` | `mac-studio`, `mac-mini-1` |
| Admin Password | `changeme` | Recommended: strong password |
| Node Port | `3200` | (auto-configured, do not change) |
| Database | `~/.openclaw/squidjob-node.db` | (auto-created, SQLite) |
| Install Service | `y` (yes) | Auto-start on Mac boot |
| SERVICE NAME | `com.squidjob.node` | (auto-configured) |

---

**You're all set!** Your SquidJob Hub is running in the cloud, and your Macs are connected and syncing. Enjoy orchestrating your AI agents.
