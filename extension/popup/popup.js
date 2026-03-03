let hubUrl = '';
let apiKey = '';
let refreshInterval = null;
let lastSuccessTime = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('refresh-btn').addEventListener('click', fetchData);
  document.getElementById('settings-btn').addEventListener('click', openOptions);
  document.getElementById('retry-btn')?.addEventListener('click', fetchData);
  document.getElementById('open-options')?.addEventListener('click', openOptions);

  const config = await chrome.storage.sync.get(['hubUrl', 'apiKey']);
  hubUrl = config.hubUrl || '';
  apiKey = config.apiKey || '';

  if (!hubUrl || !apiKey) {
    showPanel('unconfigured');
    return;
  }

  showPanel('loading');
  await fetchData();

  refreshInterval = setInterval(fetchData, 30000);
}

function showPanel(name) {
  ['unconfigured', 'error-panel', 'loading', 'content'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === name ? '' : 'none';
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function fetchData() {
  try {
    const res = await fetch(`${hubUrl}/v1/nodes`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const nodes = data.nodes || [];

    lastSuccessTime = new Date();
    renderData(nodes);
    showPanel('content');
    updateStatusDot(nodes);
  } catch (err) {
    document.getElementById('error-msg').textContent = err.message;
    if (lastSuccessTime) {
      document.getElementById('last-success').textContent =
        `Last successful: ${lastSuccessTime.toLocaleTimeString()}`;
    }
    showPanel('error-panel');
    updateStatusDot([]);
  }
}

function updateStatusDot(nodes) {
  const dot = document.getElementById('status-dot');
  if (nodes.length === 0) {
    dot.className = 'status-dot offline';
  } else if (nodes.some(n => n.status === 'degraded')) {
    dot.className = 'status-dot degraded';
  } else if (nodes.every(n => n.status === 'online')) {
    dot.className = 'status-dot online';
  } else {
    dot.className = 'status-dot degraded';
  }
}

function renderData(nodes) {
  const online = nodes.filter(n => n.status === 'online').length;
  const degraded = nodes.filter(n => n.status === 'degraded').length;
  const offline = nodes.filter(n => n.status === 'offline').length;
  const totalAgents = nodes.reduce((s, n) => s + (n.agent_count || 0), 0);

  document.getElementById('online-count').textContent = online;
  document.getElementById('degraded-count').textContent = degraded;
  document.getElementById('offline-count').textContent = offline;
  document.getElementById('agent-total').textContent = totalAgents;

  renderNodes(nodes);
  renderAgents(nodes);
}

function renderNodes(nodes) {
  const container = document.getElementById('nodes-list');
  if (nodes.length === 0) {
    container.innerHTML = '<div style="color:#555;text-align:center;padding:16px;font-size:12px;">No nodes registered</div>';
    return;
  }

  container.innerHTML = nodes.map(node => {
    const info = node.system_info || {};
    const cpu = info.cpu_percent || 0;
    const ram = info.memory_percent || 0;
    const disk = info.disk_percent || 0;
    const heartbeat = node.last_heartbeat ? timeAgo(new Date(node.last_heartbeat)) : 'never';

    return `
      <div class="node-card" data-url="${hubUrl}/fleet" onclick="openHub(this)">
        <div class="node-header">
          <div class="node-name">
            <span class="status-dot ${node.status}"></span>
            ${esc(node.name)}
          </div>
          <div class="node-meta">${node.agent_count || 0} agents</div>
        </div>
        <div class="node-stats">
          <div class="stat-bar">
            <div class="stat-label">CPU ${cpu}%</div>
            <div class="stat-track"><div class="stat-fill cpu" style="width:${cpu}%"></div></div>
          </div>
          <div class="stat-bar">
            <div class="stat-label">RAM ${ram}%</div>
            <div class="stat-track"><div class="stat-fill ram" style="width:${ram}%"></div></div>
          </div>
          <div class="stat-bar">
            <div class="stat-label">DSK ${disk}%</div>
            <div class="stat-track"><div class="stat-fill disk" style="width:${disk}%"></div></div>
          </div>
        </div>
        <div class="node-meta" style="margin-top:4px;">${heartbeat}</div>
      </div>
    `;
  }).join('');
}

function renderAgents(nodes) {
  const container = document.getElementById('agents-list');
  const allAgents = [];

  nodes.forEach(node => {
    if (!node.system_info?.agent_statuses) {
      const heartbeatAgents = node.agent_statuses || [];
      if (Array.isArray(heartbeatAgents)) {
        heartbeatAgents.forEach(a => allAgents.push({ ...a, nodeName: node.name, nodeId: node.id }));
      }
    }
    const agentStatuses = node.system_info?.agent_statuses;
    if (Array.isArray(agentStatuses)) {
      agentStatuses.forEach(a => allAgents.push({ ...a, nodeName: node.name, nodeId: node.id }));
    }
  });

  if (allAgents.length === 0) {
    container.innerHTML = '<div style="color:#555;text-align:center;padding:16px;font-size:12px;">No agents discovered</div>';
    return;
  }

  container.innerHTML = allAgents.map(agent => `
    <div class="agent-item" data-url="${hubUrl}/agents" onclick="openHub(this)">
      <span class="status-dot ${agent.status === 'active' ? 'online' : 'offline'}"></span>
      <span class="agent-name">${esc(agent.name || agent.id)}</span>
      <span class="agent-model">${esc(agent.model || '')}</span>
      <span class="agent-node-badge">${esc(agent.nodeName)}</span>
    </div>
  `).join('');
}

function openHub(el) {
  const url = el.dataset.url;
  if (url) chrome.tabs.create({ url });
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
