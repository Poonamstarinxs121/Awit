import { useState, useEffect } from 'react';
import { X, Mail, ChevronDown, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HelpTopic {
  id: string;
  title: string;
  emoji: string;
  section: 'SETUP GUIDE' | 'USING YOUR SQUAD' | 'COMMON';
  content: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'welcome', title: 'Welcome', emoji: '👋', section: 'SETUP GUIDE',
    content: `<h2>Welcome to SquidJob</h2><p>SquidJob is your AI-powered Mission Control — a platform that turns independent AI agents into a coordinated squad working for you 24/7.</p><h3>Your Setup</h3><table class="help-table"><thead><tr><th>Component</th><th>What It Does</th></tr></thead><tbody><tr><td>Telegram Bot</td><td>Your primary interface to message agents</td></tr><tr><td>Lead Agent (Oracle)</td><td>Coordinates the squad, delegates tasks</td></tr><tr><td>Specialist Agents</td><td>Content, research, design, analytics, and more</td></tr><tr><td>Dashboard</td><td>Mission Control for monitoring and managing</td></tr></tbody></table><h3>How It Works</h3><ol><li><strong>You message your bot</strong> — Give tasks, ask questions, share context</li><li><strong>Oracle coordinates</strong> — Routes work to the right specialist agents</li><li><strong>Agents collaborate</strong> — They share information and build on each other's work</li><li><strong>You review output</strong> — Check deliverables, give feedback, approve results</li></ol>`
  },
  {
    id: 'before-you-start', title: 'Before You Start', emoji: '📋', section: 'SETUP GUIDE',
    content: `<h2>Before You Start</h2><p>Make sure you have the following ready before setting up SquidJob:</p><h3>Prerequisites</h3><ul><li><strong>Claude Subscription</strong> — Claude Pro ($20/mo) or Max ($100/mo) at <a href="https://claude.ai" target="_blank">claude.ai</a></li><li><strong>Telegram Account</strong> — Free, available on all platforms</li><li><strong>Terminal Access</strong> — For running the setup token command</li><li><strong>Node.js Installed</strong> — Version 18 or higher (for the npx command)</li></ul><p>The entire setup takes about 5 minutes. Once connected, your squad runs autonomously.</p>`
  },
  {
    id: 'create-bot', title: 'Create Your Bot', emoji: '🤖', section: 'SETUP GUIDE',
    content: `<h2>Create Your Telegram Bot</h2><p>Creating a Telegram bot is free and takes about 60 seconds.</p><h3>Steps</h3><ol><li>Open Telegram and search for <code>@BotFather</code></li><li>Send <code>/newbot</code> to start the creation process</li><li>Choose a display name (e.g., "My AI Squad")</li><li>Choose a username ending in <code>_bot</code> (e.g., "myaisquad_bot")</li><li>BotFather will give you a token — copy it</li></ol><h3>Important Notes</h3><ul><li>The token looks like: <code>123456789:ABCdefGHIjklMNOpqrSTUvwxYZ</code></li><li>Keep your token secret — it gives full control of your bot</li><li>You can create multiple bots if needed</li></ul>`
  },
  {
    id: 'connect-claude', title: 'Connect Claude', emoji: '🧠', section: 'SETUP GUIDE',
    content: `<h2>Connect Claude</h2><p>SquidJob uses your Claude subscription to power AI agents. This keeps your data private and costs predictable.</p><h3>Get a Setup Token</h3><ol><li>Make sure you have Claude Pro ($20/mo) or Max ($100/mo)</li><li>Open your terminal</li><li>Run: <code>npx @anthropic-ai/claude-code setup-token</code></li><li>Your browser will open — click "Approve" to authorize</li><li>Copy the token from your terminal</li></ol><h3>Why Setup Token?</h3><p>The setup token uses your existing Claude subscription quota instead of per-API billing. This is significantly cheaper for heavy AI usage — a flat $20-100/mo vs potentially hundreds in API costs.</p>`
  },
  {
    id: 'provisioning', title: 'Provisioning', emoji: '🚀', section: 'SETUP GUIDE',
    content: `<h2>Provisioning</h2><p>After you click "Launch My Mission Control," the system sets up your dedicated AI environment.</p><h3>What Happens</h3><p>The provisioning process runs 11 steps in about 2 minutes:</p><ol><li><strong>Provisioning HQ</strong> — Creating your workspace</li><li><strong>Preparing environment</strong> — Setting up configuration</li><li><strong>Installing AI systems</strong> — Deploying orchestration</li><li><strong>Connecting Claude</strong> — Authenticating your subscription</li><li><strong>Linking Telegram</strong> — Connecting your bot</li><li><strong>Starting AI gateway</strong> — Bringing agents online</li><li><strong>Installing plugins</strong> — Memory, tracking, and more</li><li><strong>Configuring Mission Control</strong> — Setting up your dashboard</li><li><strong>Finalizing setup</strong> — Security hardening</li><li><strong>Creating checkpoint</strong> — Saving state for recovery</li><li><strong>Final activation</strong> — Launching your squad!</li></ol><h3>Troubleshooting</h3><p>If provisioning fails, try refreshing the page and running setup again. Your token and bot configuration are saved.</p>`
  },
  {
    id: 'talk-to-lead', title: 'Talk to Your Lead', emoji: '💬', section: 'SETUP GUIDE',
    content: `<h2>Talk to Your Lead Agent</h2><p>After setup, your first conversation with Oracle (the Lead Agent) is important. It helps Oracle understand your business and goals.</p><h3>Sample Onboarding Conversation</h3><ul><li><strong>You:</strong> "Hi! I run a digital marketing agency."</li><li><strong>Oracle:</strong> "Welcome! I'll coordinate your AI squad. Tell me more about your clients and services."</li><li><strong>You:</strong> "We do content marketing, SEO, and social media for SaaS companies."</li><li><strong>Oracle:</strong> "Perfect. I'll set up the Content Writer and SEO Analyst as your primary agents."</li></ul><h3>Tips</h3><table class="help-table"><thead><tr><th>Do</th><th>Don't</th></tr></thead><tbody><tr><td>Share your business context</td><td>Give vague instructions</td></tr><tr><td>Describe your typical projects</td><td>Expect perfection immediately</td></tr><tr><td>Mention your preferences</td><td>Skip the onboarding conversation</td></tr></tbody></table>`
  },
  {
    id: 'quick-start', title: 'Quick Start', emoji: '⚡', section: 'USING YOUR SQUAD',
    content: `<h2>Quick Start Guide</h2><p>Get productive in 5 steps:</p><ol><li><strong>Message your bot</strong> — Open Telegram and send your first message to your bot</li><li><strong>Give a task</strong> — "Write a blog post about AI in marketing" or "Research competitor pricing"</li><li><strong>Check progress</strong> — Visit the Dashboard to see task status and agent activity</li><li><strong>Give feedback</strong> — Review deliverables and provide comments directly in the task</li><li><strong>Daily check-in</strong> — Read your daily standup to see what your squad accomplished</li></ol><p>That's it! Your squad handles the rest autonomously.</p>`
  },
  {
    id: 'your-squad', title: 'Your Squad', emoji: '👥', section: 'USING YOUR SQUAD',
    content: `<h2>Your Squad</h2><h3>Lead Agent: Oracle</h3><p>Oracle is your primary point of contact. It receives your messages, understands context, and delegates work to specialist agents.</p><h3>Specialist Agents</h3><table class="help-table"><thead><tr><th>Agent</th><th>Role</th><th>Speciality</th></tr></thead><tbody><tr><td>Strategist</td><td>Planning</td><td>Strategy, roadmaps, competitive analysis</td></tr><tr><td>Scribe</td><td>Content</td><td>Writing, editing, blog posts, copy</td></tr><tr><td>Forge</td><td>Engineering</td><td>Technical implementation, code review</td></tr><tr><td>Detective</td><td>Research</td><td>Data analysis, market research</td></tr><tr><td>Architect</td><td>Design</td><td>UI/UX, wireframes, design systems</td></tr><tr><td>Scout</td><td>Discovery</td><td>Trend spotting, opportunities</td></tr><tr><td>Courier</td><td>Delivery</td><td>Report generation, deliverable packaging</td></tr><tr><td>Herald</td><td>Communication</td><td>Notifications, summaries, updates</td></tr><tr><td>Librarian</td><td>Knowledge</td><td>Documentation, memory management</td></tr></tbody></table><h3>How They Collaborate</h3><p>Agents can message each other, share context through the memory graph, and hand off tasks. Oracle orchestrates this automatically based on your requests.</p>`
  },
  {
    id: 'communication-tips', title: 'Communication Tips', emoji: '🗣️', section: 'USING YOUR SQUAD',
    content: `<h2>Communication Tips</h2><h3>Be Specific</h3><p>Instead of "write something about marketing," try "write a 1500-word blog post about email marketing best practices for B2B SaaS companies, targeting marketing managers."</p><h3>Share Context</h3><p>Give your agents background information. The more context they have, the better their output.</p><h3>Set Priorities</h3><p>Tell agents what's urgent vs. what can wait. Use priority levels (High, Medium, Low) when creating tasks.</p><h3>Give Feedback</h3><p>When an agent delivers something, provide specific feedback: "The intro is great, but the conclusion needs more actionable takeaways."</p><h3>Approve or Revise</h3><p>Use the task workflow to approve deliverables or request revisions. This helps agents learn your preferences.</p>`
  },
  {
    id: 'tasks-workflow', title: 'Tasks & Workflow', emoji: '📋', section: 'USING YOUR SQUAD',
    content: `<h2>Tasks & Workflow</h2><h3>Task Statuses</h3><table class="help-table"><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody><tr><td>Inbox</td><td>New task, not yet assigned</td></tr><tr><td>Assigned</td><td>Given to an agent, not started</td></tr><tr><td>In Progress</td><td>Agent is actively working</td></tr><tr><td>Review</td><td>Work complete, needs your review</td></tr><tr><td>Done</td><td>Approved and completed</td></tr></tbody></table><h3>Creating Tasks</h3><p>You can create tasks by messaging your bot, through the Dashboard, or from the Mission Queue (Kanban board).</p><h3>Reviewing Deliverables</h3><p>When a task moves to Review, check the deliverables tab. You can download files, add comments, and either approve (move to Done) or request changes (move back to In Progress).</p>`
  },
  {
    id: 'documents', title: 'Documents', emoji: '📄', section: 'USING YOUR SQUAD',
    content: `<h2>Documents</h2><p>Documents are your squad's shared knowledge base.</p><h3>Document Types</h3><table class="help-table"><thead><tr><th>Type</th><th>Purpose</th><th>Example</th></tr></thead><tbody><tr><td>Deliverable</td><td>Output from tasks</td><td>Blog post, report, design spec</td></tr><tr><td>Brief</td><td>Task requirements</td><td>Project brief, creative brief</td></tr><tr><td>Research</td><td>Analysis & findings</td><td>Competitor analysis, market research</td></tr><tr><td>Protocol</td><td>Processes & workflows</td><td>Content approval process, brand guidelines</td></tr><tr><td>Checklist</td><td>Step-by-step guides</td><td>Launch checklist, QA checklist</td></tr><tr><td>Note</td><td>General documentation</td><td>Meeting notes, ideas, references</td></tr></tbody></table><h3>Standalone vs. Linked</h3><p>Documents can be standalone (not tied to a task) or linked to specific tasks. Linked documents appear in the task's deliverables section.</p><h3>How Agents Use Documents</h3><p>Agents reference documents when working on tasks. The more documentation you create, the better your agents understand your business.</p>`
  },
  {
    id: 'settings', title: 'Settings', emoji: '⚙️', section: 'USING YOUR SQUAD',
    content: `<h2>Settings</h2><h3>Workspace Configuration</h3><p>Manage your API providers, Telegram integration, webhooks, and standup delivery channels from the Settings page.</p><h3>Usage & Costs</h3><p>View your AI usage dashboard showing token consumption, costs per agent, and trends over time.</p><h3>Billing</h3><p>SquidJob uses a Bring Your Own Key (BYOK) model. Your AI costs come from your Claude subscription, not from SquidJob directly.</p><h3>Reset Workspace</h3><p>In the danger zone, you can reset your entire workspace. This deletes all agents, tasks, documents, and memories. Use with caution — this cannot be undone.</p>`
  },
  {
    id: 'skills-marketplace', title: 'Skills Marketplace', emoji: '🏪', section: 'USING YOUR SQUAD',
    content: `<h2>Skills Marketplace</h2><p>The Skills Marketplace is a browsable registry of capabilities you can install into your workspace and enable for individual agents. Think of skills as plug-in modules that extend what your agents can do.</p><h3>How It Works</h3><ol><li><strong>Browse</strong> — Visit the Marketplace to see all available skills organised by category and risk level</li><li><strong>Install</strong> — Click "Install" on any skill to add it to your workspace. This makes it available for all agents in your team.</li><li><strong>Enable per Agent</strong> — Go to an agent's detail page → Skills tab → toggle on the skills you want that specific agent to use</li><li><strong>Automatic Injection</strong> — When an agent runs, all its enabled skills are automatically added to its context so it knows what it can do</li></ol><h3>Searching & Filtering</h3><p>The Marketplace provides powerful filtering to find the right skills:</p><table class="help-table"><thead><tr><th>Filter</th><th>How to Use</th></tr></thead><tbody><tr><td>Search bar</td><td>Type to search across skill names, descriptions, categories, and pack names</td></tr><tr><td>Category dropdown</td><td>Filter by category (research, development, analytics, communication, etc.)</td></tr><tr><td>Risk dropdown</td><td>Filter by risk level (Safe, Moderate, High)</td></tr><tr><td>Column sorting</td><td>Click any column header to sort ascending/descending</td></tr></tbody></table><h3>Understanding Risk Levels</h3><table class="help-table"><thead><tr><th>Risk Level</th><th>Colour</th><th>What It Means</th><th>Examples</th></tr></thead><tbody><tr><td>SAFE</td><td>Green</td><td>No external access, pure text processing and analysis</td><td>Code Review, Data Analysis, Task Planning, Documentation</td></tr><tr><td>MODERATE</td><td>Amber</td><td>May access external services, file I/O, or network</td><td>Web Search, Code Execution, Git Operations, WhatsApp Send</td></tr><tr><td>HIGH</td><td>Red</td><td>System-level access, database operations, or security tools</td><td>Database Query, Security Audit</td></tr></tbody></table><h3>Installing & Uninstalling</h3><p>Installing a skill makes it available to your entire workspace. It does not automatically enable it for any agent — you choose which agents get which skills.</p><ul><li><strong>Install</strong> — Click the red "Install" button in the Action column. The "Installed On" column shows the installation date.</li><li><strong>Uninstall</strong> — Click "Uninstall" to remove a skill from your workspace. This also disables it for all agents that had it enabled.</li></ul><h3>Built-in Skills</h3><p>SquidJob ships with 21 built-in skills across two packs:</p><table class="help-table"><thead><tr><th>Pack</th><th>Skills</th><th>Focus</th></tr></thead><tbody><tr><td>SquidJob Core Skills</td><td>15 skills</td><td>Research, development, analytics, productivity, system tools</td></tr><tr><td>SquidJob Communication Skills</td><td>6 skills</td><td>Slack, Telegram, WhatsApp, email, standups, calendar</td></tr></tbody></table>`
  },
  {
    id: 'skill-packs', title: 'Skill Packs', emoji: '📦', section: 'USING YOUR SQUAD',
    content: `<h2>Skill Packs</h2><p>Skill Packs are curated collections of related skills. They make it easy to organise and manage groups of capabilities.</p><h3>Viewing Packs</h3><p>Visit the Packs page to see all available packs. Each pack card shows:</p><ul><li><strong>Pack name</strong> and description</li><li><strong>Skill count</strong> — total number of skills in the pack</li><li><strong>Installed count</strong> — how many of its skills you've installed</li><li><strong>Source URL</strong> — where the pack comes from (or "Built-in" for default packs)</li><li><strong>Last synced</strong> — when the pack was last refreshed</li></ul><h3>Built-in vs Custom Packs</h3><table class="help-table"><thead><tr><th>Feature</th><th>Built-in Packs</th><th>Custom Packs</th></tr></thead><tbody><tr><td>Source</td><td>Ships with SquidJob</td><td>Created by you</td></tr><tr><td>Deletable</td><td>No (protected)</td><td>Yes</td></tr><tr><td>Editable</td><td>No</td><td>Yes</td></tr><tr><td>Sync</td><td>Automatic with updates</td><td>Manual sync via GitHub URL</td></tr></tbody></table><h3>Creating a Custom Pack</h3><ol><li>Click the <strong>"Add Pack"</strong> button in the top right</li><li>Enter a <strong>Pack Name</strong> (required) — this becomes the pack identifier</li><li>Optionally add a <strong>Source URL</strong> (e.g. a GitHub repository)</li><li>Add a <strong>Description</strong> explaining what the pack provides</li><li>Click <strong>"Create Pack"</strong></li></ol><p>Custom packs start empty. Skills can be added to them in future updates.</p><h3>Pack Actions</h3><table class="help-table"><thead><tr><th>Action</th><th>What It Does</th></tr></thead><tbody><tr><td>Browse</td><td>Opens the Marketplace filtered to show only this pack's skills</td></tr><tr><td>Sync</td><td>Refreshes the pack from its source (placeholder for future GitHub integration)</td></tr><tr><td>Delete</td><td>Removes the pack and all its skills (only available for custom packs)</td></tr></tbody></table><h3>Deleting a Pack</h3><p>Deleting a custom pack permanently removes it and all its skills. Any agents using those skills will lose access to them. You'll be asked to confirm before deletion.</p>`
  },
  {
    id: 'agent-skills', title: 'Agent Skills', emoji: '🔧', section: 'USING YOUR SQUAD',
    content: `<h2>Agent Skills</h2><p>Each agent can have different skills enabled based on their role and responsibilities. The Skills tab on an agent's detail page lets you control exactly which capabilities each agent has.</p><h3>Accessing the Skills Tab</h3><ol><li>Go to <strong>Agents</strong> in the Dock</li><li>Click on an agent to open their detail page</li><li>In the left sidebar, under <strong>AUTOMATE</strong>, click <strong>"Skills"</strong></li></ol><h3>Enabling & Disabling Skills</h3><p>The Skills tab shows all skills that are installed in your workspace. Each skill has a toggle switch:</p><ul><li><strong>Green (on)</strong> — Skill is enabled for this agent. The skill's instructions will be injected into the agent's context.</li><li><strong>Grey (off)</strong> — Skill is not enabled. The agent won't know about this capability.</li></ul><p>Simply click the toggle to enable or disable a skill. Changes take effect on the agent's next conversation turn.</p><h3>Skill Information</h3><p>Each skill row shows:</p><table class="help-table"><thead><tr><th>Element</th><th>Description</th></tr></thead><tbody><tr><td>Name</td><td>The skill's display name</td></tr><tr><td>Risk badge</td><td>SAFE (green), MODERATE (amber), or HIGH (red)</td></tr><tr><td>Category badge</td><td>The skill's functional category (research, development, etc.)</td></tr><tr><td>Description</td><td>What the skill enables the agent to do</td></tr><tr><td>Pack name</td><td>Which pack the skill belongs to</td></tr></tbody></table><h3>No Skills Installed?</h3><p>If no skills are installed in your workspace, you'll see a link to the Marketplace. Click "Browse the Marketplace" to find and install skills first.</p><h3>How Skills Work Behind the Scenes</h3><p>When an agent receives a message, the orchestration engine:</p><ol><li>Loads all enabled skills for that agent</li><li>Appends each skill's instruction text (<code>tools_md</code>) to the agent's system prompt</li><li>The agent then knows about its capabilities and can use them appropriately</li></ol><h3>Best Practices for Agent Skills</h3><table class="help-table"><thead><tr><th>Tip</th><th>Why</th></tr></thead><tbody><tr><td>Match skills to the agent's role</td><td>A Content Writer doesn't need Database Query; a DevOps agent does</td></tr><tr><td>Start with SAFE skills</td><td>Low-risk skills are great for getting started without worry</td></tr><tr><td>Review HIGH-risk skills carefully</td><td>These grant powerful capabilities — only enable when needed</td></tr><tr><td>Don't overload agents</td><td>Too many skills can dilute context. Enable only what's relevant.</td></tr><tr><td>Use Lead agents for broad skills</td><td>Oracle benefits from communication and planning skills</td></tr></tbody></table>`
  },
  {
    id: 'memory-graph', title: 'Memory Graph', emoji: '🧠', section: 'USING YOUR SQUAD',
    content: `<h2>Memory Graph</h2><p>The Memory Graph is a visual map of everything your squad knows.</p><h3>What You'll See</h3><ul><li><strong>Nodes</strong> — Documents, memory entries, and key concepts</li><li><strong>Connections</strong> — Relationships between related information</li><li><strong>Clusters</strong> — Groups of related topics, shown by color</li></ul><h3>Building Better Memory</h3><p>Your agents build memory automatically as they work. You can improve it by:</p><ul><li>Providing detailed context in your messages</li><li>Creating documents with business knowledge</li><li>Giving feedback on deliverables</li><li>Sharing brand guidelines and preferences</li></ul><h3>Memory Over Time</h3><p>The memory graph grows and refines itself as you use SquidJob. After a few weeks, your agents will have deep understanding of your business.</p>`
  },
  {
    id: 'squad-chat', title: 'Squad Chat', emoji: '💬', section: 'USING YOUR SQUAD',
    content: `<h2>Squad Chat</h2><p>Squad Chat is your window into how agents communicate and coordinate.</p><h3>Task Comments vs. Squad Chat</h3><table class="help-table"><thead><tr><th>Feature</th><th>Task Comments</th><th>Squad Chat</th></tr></thead><tbody><tr><td>Scope</td><td>Specific to one task</td><td>General team-wide</td></tr><tr><td>Visibility</td><td>Task participants</td><td>Everyone</td></tr><tr><td>Purpose</td><td>Feedback & discussion</td><td>Coordination & updates</td></tr></tbody></table><h3>Why Watch It</h3><p>Squad Chat shows you how agents are thinking, what they're prioritizing, and how they're collaborating. It's useful for understanding your squad's workflow.</p><h3>Participating</h3><p>You can send messages in Squad Chat to broadcast information to all agents at once, like announcing a new priority or sharing company news.</p>`
  },
  {
    id: 'usage-costs', title: 'Usage & Costs', emoji: '💰', section: 'USING YOUR SQUAD',
    content: `<h2>Usage & Costs</h2><h3>How Billing Works</h3><p>SquidJob uses a Bring Your Own Key (BYOK) model:</p><ul><li><strong>SquidJob Platform</strong> — $99/month for the orchestration platform</li><li><strong>AI Costs</strong> — Covered by your Claude subscription ($20-100/mo)</li></ul><h3>Rate Limits</h3><p>Your Claude subscription has usage limits. Claude Pro allows moderate usage; Claude Max allows heavy usage. If you hit limits, agents will queue work and resume when quota refreshes.</p><h3>Usage Dashboard</h3><p>View token consumption, cost breakdowns, and per-agent usage in Settings → Usage & Costs.</p><h3>Optimization Strategies</h3><table class="help-table"><thead><tr><th>Strategy</th><th>Impact</th></tr></thead><tbody><tr><td>Use heartbeat scheduling</td><td>Reduces unnecessary API calls</td></tr><tr><td>Set clear task descriptions</td><td>Fewer revision cycles</td></tr><tr><td>Pause idle agents</td><td>Stops background token usage</td></tr><tr><td>Use session compaction</td><td>Keeps context windows efficient</td></tr></tbody></table>`
  },
  {
    id: 'pause-control', title: 'Pause & Control', emoji: '⏸️', section: 'USING YOUR SQUAD',
    content: `<h2>Pause & Control</h2><h3>Why Pause?</h3><p>Pausing stops agents from making autonomous API calls (heartbeats, cron jobs). This saves your Claude quota when you don't need active AI work.</p><h3>Global vs. Per-Agent</h3><ul><li><strong>Global Pause</strong> — Stops ALL agents at once. Use the pause button in the header.</li><li><strong>Per-Agent Pause</strong> — Stops a specific agent. Use the pause button on the agent's detail page.</li></ul><h3>What Stays Active</h3><p>Even when paused, agents will still respond to direct messages. Oracle (Lead Agent) always responds regardless of pause state.</p><h3>Vacation Mode</h3><p>Going on vacation? Use Global Pause to stop all autonomous work. Your squad will pick up right where they left off when you resume.</p>`
  },
  {
    id: 'heartbeats', title: 'Heartbeats Explained', emoji: '💓', section: 'USING YOUR SQUAD',
    content: `<h2>Heartbeats Explained</h2><h3>What Are Heartbeats?</h3><p>Heartbeats are periodic check-ins where agents review their tasks, process new information, and take autonomous actions without being prompted.</p><h3>Why Heartbeats?</h3><p>They allow agents to work asynchronously — checking on tasks, processing new data, and proactively completing work without you needing to ask.</p><h3>Staggered Scheduling</h3><p>Heartbeats are staggered so agents don't all fire at once:</p><ul><li>Oracle: Every 30 minutes</li><li>Strategist: Every 45 minutes</li><li>Other agents: Every 60 minutes</li></ul><h3>Async Work Pattern</h3><p>You give a task → Agent receives it → Next heartbeat processes it → You get a notification when complete. No need to wait or check manually.</p><h3>Immediate Responses</h3><p>Direct messages always get immediate responses. Heartbeats handle background/autonomous work.</p>`
  },
  {
    id: 'common-scenarios', title: 'Common Scenarios', emoji: '🎯', section: 'COMMON',
    content: `<h2>Common Scenarios</h2><h3>Urgent Request</h3><p>Message Oracle directly: "URGENT: I need a competitor analysis by end of day." Oracle will prioritize and delegate immediately.</p><h3>Output Not Right</h3><p>Add a comment on the task with specific feedback. Move the task back to "In Progress" and the agent will revise.</p><h3>Going on Vacation</h3><p>Use Global Pause from the header. Your squad stops all autonomous work. Resume when you're back.</p><h3>Need a New Agent</h3><p>Go to Agents → New Agent. Use the SoulCraft wizard to create a custom agent with specific skills and personality.</p><h3>Something Broken</h3><p>Try Restart Gateway first (Settings menu). If issues persist, check the Help Center or contact support.</p><h3>Want to Start Over</h3><p>Use Reset Workspace in Settings → Danger Zone. This resets everything and takes you back to the setup wizard.</p>`
  },
  {
    id: 'best-practices', title: 'Best Practices', emoji: '⭐', section: 'COMMON',
    content: `<h2>Best Practices</h2><h3>Start with One Project</h3><p>Don't try to do everything at once. Start with one project, learn the workflow, then expand.</p><h3>Document Everything</h3><p>Create documents for brand guidelines, processes, and preferences. Better documentation = better AI output.</p><h3>Daily Check-in</h3><p>Spend 5 minutes each morning reading your daily standup. It keeps you informed without micromanaging.</p><h3>Scale Gradually</h3><table class="help-table"><thead><tr><th>Week</th><th>Focus</th></tr></thead><tbody><tr><td>Week 1</td><td>One project, learn the basics</td></tr><tr><td>Week 2</td><td>Add a second project, customize agents</td></tr><tr><td>Week 3</td><td>Set up cron jobs and automation</td></tr><tr><td>Week 4</td><td>Full autonomy, optimize costs</td></tr></tbody></table><h3>Let Them Learn</h3><p>Agents get better over time as they build memory of your preferences. Be patient in the first few days.</p><h3>Trust the Process</h3><table class="help-table"><thead><tr><th>Phase</th><th>What to Expect</th></tr></thead><tbody><tr><td>Days 1-3</td><td>Agents learning your style, some revisions needed</td></tr><tr><td>Days 4-7</td><td>Output quality improves, fewer revisions</td></tr><tr><td>Week 2+</td><td>Agents work autonomously with high accuracy</td></tr></tbody></table>`
  },
  {
    id: 'browser-setup', title: 'Browser Setup', emoji: '🌐', section: 'COMMON',
    content: `<h2>Browser Setup</h2><h3>Web Search vs. Web Browsing</h3><table class="help-table"><thead><tr><th>Capability</th><th>Web Search</th><th>Web Browsing</th></tr></thead><tbody><tr><td>What it does</td><td>Searches the web for information</td><td>Opens and reads specific web pages</td></tr><tr><td>Use case</td><td>Research, fact-checking, trends</td><td>Reading articles, scraping data</td></tr><tr><td>Setup needed</td><td>API key (optional)</td><td>Browser plugin install</td></tr></tbody></table><h3>Installing Browser Tools</h3><p>Browser tools are optional add-ons that give agents the ability to read web pages. Contact support for installation help.</p><h3>Fleet Monitor Extension</h3><p>The SquidJob Fleet Monitor Chrome extension lets you monitor node statuses, agent counts, and system metrics from your browser toolbar. Download it from <a href="/settings">Settings &rarr; Downloads</a> tab.</p><ol><li>Download and unzip the extension</li><li>Open <code>chrome://extensions</code> and enable Developer mode</li><li>Click "Load unpacked" and select the unzipped folder</li><li>Configure your Hub URL and API key in the extension settings</li></ol>`
  },
  {
    id: 'web-search', title: 'Web Search', emoji: '🔍', section: 'COMMON',
    content: `<h2>Web Search</h2><h3>What Agents Can Search</h3><p>With web search enabled, agents can find current information, research competitors, check facts, and stay up-to-date.</p><h3>Adding a Search API Key</h3><p>Go to Settings → API Providers → Add a Brave Search API key for web search capabilities.</p><h3>Pricing</h3><table class="help-table"><thead><tr><th>Plan</th><th>Searches/month</th><th>Cost</th></tr></thead><tbody><tr><td>Free</td><td>2,000</td><td>$0</td></tr><tr><td>Basic</td><td>20,000</td><td>$5/mo</td></tr><tr><td>Pro</td><td>100,000</td><td>$15/mo</td></tr></tbody></table><h3>How Agents Use Search</h3><p>Agents automatically search when they need current information. You can also explicitly ask: "Search for the latest trends in AI marketing."</p>`
  },
  {
    id: 'node-setup', title: 'Node Setup', emoji: '🖥️', section: 'COMMON',
    content: `<h2>Node Setup</h2><p>SquidJob Nodes are local dashboards that run alongside OpenClaw on your machines, providing agent monitoring, file browsing, cost tracking, and Hub synchronization.</p><h3>Getting Started</h3><ol><li>Download the Node app from <a href="/settings">Settings &rarr; Downloads</a></li><li>Unzip and run <code>npm install</code></li><li>Register a new node on the <a href="/fleet">Fleet page</a> to get your Node ID and API key</li><li>Copy <code>.env.example</code> to <code>.env</code> and fill in:<br><code>NODE_HUB_URL</code> — your Hub URL<br><code>NODE_HUB_API_KEY</code> — the API key from registration<br><code>NODE_ID</code> — the node ID from registration</li><li>Run <code>npm run dev</code> to start the Node dashboard on port 3200</li></ol><h3>Requirements</h3><ul><li>Node.js 18 or higher</li><li>npm package manager</li><li>OpenClaw running on the same machine (for agent discovery)</li></ul><h3>Node Features</h3><table class="help-table"><thead><tr><th>Feature</th><th>Description</th></tr></thead><tbody><tr><td>Agent Monitor</td><td>View all discovered agents and their statuses</td></tr><tr><td>File Browser</td><td>Browse and edit files with Monaco editor</td></tr><tr><td>Memory Browser</td><td>Read/edit agent memory files (SOUL, TOOLS, etc.)</td></tr><tr><td>Sessions</td><td>View session history with token counts</td></tr><tr><td>Costs</td><td>Track per-agent costs with daily trend charts</td></tr><tr><td>Cron Manager</td><td>Manage OpenClaw scheduled tasks</td></tr><tr><td>Terminal</td><td>Execute commands on the machine</td></tr><tr><td>Hub Sync</td><td>Automatic telemetry and heartbeat sync</td></tr></tbody></table>`
  },
  {
    id: 'updates-versions', title: 'Updates & Versions', emoji: '🔄', section: 'COMMON',
    content: `<h2>Updates & Versions</h2><h3>System Management</h3><p>SquidJob is continuously updated with new features, bug fixes, and improvements. Updates are applied automatically — no action needed from you.</p><h3>Model Selection</h3><p>SquidJob supports multiple AI providers:</p><ul><li><strong>Anthropic Claude</strong> — Primary provider (recommended)</li><li><strong>OpenAI GPT</strong> — Alternative provider</li><li><strong>Google Gemini</strong> — Budget-friendly option</li><li><strong>Mistral</strong> — European alternative</li><li><strong>Groq</strong> — Fast inference option</li></ul><p>Configure providers in Settings → API Providers. Each agent can be assigned a different model based on their needs.</p>`
  },
  {
    id: 'getting-help', title: 'Getting Help', emoji: '🆘', section: 'COMMON',
    content: `<h2>Getting Help</h2><h3>Support</h3><p>Email us at <a href="mailto:support@squidjob.com">support@squidjob.com</a> for any issues not covered here.</p><h3>Common Issues</h3><table class="help-table"><thead><tr><th>Problem</th><th>Solution</th></tr></thead><tbody><tr><td>Bot not responding</td><td>Check Telegram connection in Settings, verify bot token</td></tr><tr><td>Agent stuck</td><td>Restart the agent from its detail page, or Restart Gateway</td></tr><tr><td>Dashboard won't load</td><td>Clear browser cache, try incognito mode</td></tr><tr><td>Something broke</td><td>Try Restart Gateway first, then contact support</td></tr></tbody></table><h3>Self-Service Troubleshooting</h3><ol><li>Check the agent's status (Active, Idle, Error)</li><li>Review recent activity for error messages</li><li>Try Restart Gateway from Settings</li><li>If needed, Reset Workspace as last resort</li></ol><h3>Feature Requests</h3><p>We'd love to hear your ideas! Send feature requests to <a href="mailto:feedback@squidjob.com">feedback@squidjob.com</a>.</p>`
  },
];

const SECTIONS = [
  { key: 'SETUP GUIDE' as const, label: 'SETUP GUIDE' },
  { key: 'USING YOUR SQUAD' as const, label: 'USING YOUR SQUAD' },
  { key: 'COMMON' as const, label: 'COMMON' },
];

export function HelpCenter() {
  const navigate = useNavigate();
  const [activeTopicId, setActiveTopicId] = useState(HELP_TOPICS[0].id);
  const [isMobile, setIsMobile] = useState(false);
  const [topicListOpen, setTopicListOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler as (e: MediaQueryListEvent) => void);
    return () => mq.removeEventListener('change', handler as (e: MediaQueryListEvent) => void);
  }, []);

  const activeTopic = HELP_TOPICS.find((t) => t.id === activeTopicId) || HELP_TOPICS[0];
  const activeIndex = HELP_TOPICS.findIndex((t) => t.id === activeTopicId);

  const selectTopic = (id: string) => {
    setActiveTopicId(id);
    setTopicListOpen(false);
  };

  const sidebarContent = (
    <>
      <nav className="p-3 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {section.label}
            </p>
            <div className="space-y-0.5 mt-1">
              {HELP_TOPICS.filter((t) => t.section === section.key).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => selectTopic(topic.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                    activeTopicId === topic.id
                      ? 'bg-brand-accent/10 text-brand-accent font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <span className="text-sm">{topic.emoji}</span>
                  <span className="truncate">{topic.title}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-[var(--border)]">
        <a
          href="mailto:support@squidjob.com"
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Mail size={14} />
          Email Support
        </a>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(100vh - 8rem)', gap: isMobile ? '0' : '24px' }}>
      {isMobile ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl mb-3">
          <button
            onClick={() => setTopicListOpen(!topicListOpen)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{activeTopic.emoji}</span>
              <span className="text-sm font-bold text-text-primary">{activeTopic.title}</span>
            </div>
            <ChevronDown size={16} className="text-text-muted" style={{ transform: topicListOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </button>
          {topicListOpen && (
            <div style={{ maxHeight: '50vh', overflowY: 'auto', borderTop: '1px solid var(--border)' }}>
              {sidebarContent}
            </div>
          )}
        </div>
      ) : (
        <aside className="w-[260px] shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-y-auto">
          <div className="px-4 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Help Center</h2>
                <p className="text-[10px] text-text-muted">Everything you need to know</p>
              </div>
            </div>
          </div>
          {sidebarContent}
        </aside>
      )}

      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-y-auto" style={{ minHeight: isMobile ? 'calc(100vh - 14rem)' : undefined }}>
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeTopic.emoji}</span>
            <h1 className="text-lg font-bold text-text-primary">{activeTopic.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">{activeIndex + 1} of {HELP_TOPICS.length}</span>
          </div>
        </div>

        <div
          className="px-4 sm:px-8 py-6 prose prose-sm max-w-none help-content"
          style={{ overflowX: 'auto' }}
          dangerouslySetInnerHTML={{ __html: activeTopic.content }}
        />

        <div className="px-4 sm:px-8 py-4 border-t border-[var(--border)] flex items-center justify-between">
          <button
            onClick={() => {
              if (activeIndex > 0) selectTopic(HELP_TOPICS[activeIndex - 1].id);
            }}
            disabled={activeIndex === 0}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <button
            onClick={() => {
              if (activeIndex < HELP_TOPICS.length - 1) selectTopic(HELP_TOPICS[activeIndex + 1].id);
            }}
            disabled={activeIndex === HELP_TOPICS.length - 1}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
