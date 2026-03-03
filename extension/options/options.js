document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.sync.get([
    'hubUrl', 'apiKey', 'notificationsEnabled', 'showBadge', 'pollInterval'
  ]);

  document.getElementById('hubUrl').value = config.hubUrl || '';
  document.getElementById('apiKey').value = config.apiKey || '';
  document.getElementById('notifications').checked = config.notificationsEnabled !== false;
  document.getElementById('badge').checked = config.showBadge !== false;

  const pollSelect = document.getElementById('pollInterval');
  if (config.pollInterval) {
    pollSelect.value = String(config.pollInterval);
  }

  document.getElementById('save').addEventListener('click', async () => {
    const hubUrl = document.getElementById('hubUrl').value.trim().replace(/\/+$/, '');
    const apiKey = document.getElementById('apiKey').value.trim();
    const notificationsEnabled = document.getElementById('notifications').checked;
    const showBadge = document.getElementById('badge').checked;
    const pollInterval = parseFloat(document.getElementById('pollInterval').value);

    if (!hubUrl) {
      showStatus('Hub URL is required', 'error');
      return;
    }

    if (!apiKey) {
      showStatus('API Key is required', 'error');
      return;
    }

    try {
      const res = await fetch(`${hubUrl}/v1/nodes`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        showStatus(`Connection failed: HTTP ${res.status}`, 'error');
        return;
      }
    } catch (err) {
      showStatus(`Cannot reach Hub: ${err.message}`, 'error');
      return;
    }

    await chrome.storage.sync.set({
      hubUrl,
      apiKey,
      notificationsEnabled,
      showBadge,
      pollInterval,
    });

    chrome.alarms.clear('poll-hub');
    chrome.alarms.create('poll-hub', { periodInMinutes: pollInterval });

    showStatus('Settings saved successfully', 'success');
  });
});

function showStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = `status ${type}`;
  setTimeout(() => { el.textContent = ''; }, 4000);
}
