let previousNodeStates = {};

chrome.alarms.create('poll-hub', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'poll-hub') return;

  const config = await chrome.storage.sync.get(['hubUrl', 'apiKey', 'notificationsEnabled', 'showBadge']);
  if (!config.hubUrl || !config.apiKey) return;

  const notificationsEnabled = config.notificationsEnabled !== false;
  const showBadge = config.showBadge !== false;

  try {
    const res = await fetch(`${config.hubUrl}/v1/nodes`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });

    if (!res.ok) {
      if (showBadge) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      }
      return;
    }

    const data = await res.json();
    const nodes = data.nodes || [];

    const currentStates = {};
    nodes.forEach(n => { currentStates[n.id] = n.status; });

    if (notificationsEnabled) {
      for (const node of nodes) {
        const prev = previousNodeStates[node.id];
        if (prev && prev === 'online' && node.status === 'offline') {
          chrome.notifications.create(`node-offline-${node.id}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Node Offline',
            message: `${node.name} is now offline`,
            priority: 2,
          });
        } else if (prev && prev === 'online' && node.status === 'degraded') {
          chrome.notifications.create(`node-degraded-${node.id}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Node Degraded',
            message: `${node.name} is experiencing issues`,
            priority: 1,
          });
        }
      }
    }

    previousNodeStates = currentStates;

    if (showBadge) {
      const issues = nodes.filter(n => n.status !== 'online').length;
      if (issues > 0) {
        chrome.action.setBadgeText({ text: String(issues) });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }

    await chrome.storage.local.set({ lastPollTime: Date.now(), nodeStates: currentStates });
  } catch (err) {
    if (showBadge) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    }
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const config = await chrome.storage.sync.get(['hubUrl']);
  if (config.hubUrl) {
    chrome.tabs.create({ url: `${config.hubUrl}/fleet` });
  }
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    notificationsEnabled: true,
    showBadge: true,
    pollInterval: 60,
  });
});
