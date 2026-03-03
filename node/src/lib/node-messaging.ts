import { NODE_CONFIG, isHubConfigured } from '../config/node';
import { insertActivity } from './local-db';
import { getSystemStats } from './system-monitor';
import { discoverAgents } from './openclaw-reader';
import { localSearch } from './local-search';

interface NodeMessage {
  id: string;
  sender_node_id: string;
  sender_node_name: string;
  message_type: string;
  payload: any;
  status: string;
  created_at: string;
}

let pollingStarted = false;

async function fetchInbox(): Promise<NodeMessage[]> {
  try {
    const res = await fetch(
      `${NODE_CONFIG.hubUrl}/v1/nodes/${NODE_CONFIG.nodeId}/messages/inbox?status=pending`,
      {
        headers: {
          'Authorization': `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch (error) {
    console.error('[NodeMessaging] Failed to fetch inbox:', error);
    return [];
  }
}

async function markMessage(messageId: string, status: 'delivered' | 'processed' | 'failed'): Promise<boolean> {
  try {
    const res = await fetch(`${NODE_CONFIG.hubUrl}/v1/node-messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NODE_CONFIG.hubApiKey}`,
      },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (error) {
    console.error('[NodeMessaging] Failed to mark message:', error);
    return false;
  }
}

async function sendReply(targetNodeId: string, messageType: string, payload: any): Promise<boolean> {
  try {
    const res = await fetch(
      `${NODE_CONFIG.hubUrl}/v1/nodes/${NODE_CONFIG.nodeId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NODE_CONFIG.hubApiKey}`,
        },
        body: JSON.stringify({
          target_node_id: targetNodeId,
          message_type: messageType,
          payload,
        }),
      }
    );
    return res.ok;
  } catch (error) {
    console.error('[NodeMessaging] Failed to send reply:', error);
    return false;
  }
}

async function handleAgentRequest(message: NodeMessage): Promise<void> {
  const { agent_id, prompt } = message.payload || {};
  const agents = discoverAgents();
  const agent = agents.find(a => a.id === agent_id || a.name === agent_id);

  if (!agent) {
    await sendReply(message.sender_node_id, 'custom', {
      reply_to: message.id,
      error: `Agent '${agent_id}' not found on this node`,
    });
    await markMessage(message.id, 'processed');
    return;
  }

  insertActivity({
    agent_id: agent.id,
    event_type: 'agent_request_received',
    description: `Remote agent request from ${message.sender_node_name}: ${prompt || 'no prompt'}`,
    metadata: JSON.stringify({ sender_node_id: message.sender_node_id }),
  });

  await sendReply(message.sender_node_id, 'custom', {
    reply_to: message.id,
    agent_id: agent.id,
    agent_name: agent.name,
    status: agent.status,
    message: `Agent '${agent.name}' is available on this node`,
  });
  await markMessage(message.id, 'processed');
}

async function handleSearchRequest(message: NodeMessage): Promise<void> {
  const { query } = message.payload || {};
  if (!query) {
    await markMessage(message.id, 'failed');
    return;
  }

  const searchResults = localSearch(query);

  await sendReply(message.sender_node_id, 'custom', {
    reply_to: message.id,
    search_results: searchResults.results,
    node_name: NODE_CONFIG.nodeName,
  });
  await markMessage(message.id, 'processed');
}

async function handleStatusRequest(message: NodeMessage): Promise<void> {
  const stats = getSystemStats();
  const agents = discoverAgents();

  await sendReply(message.sender_node_id, 'custom', {
    reply_to: message.id,
    node_name: NODE_CONFIG.nodeName,
    stats,
    agent_count: agents.length,
    agents: agents.map(a => ({ id: a.id, name: a.name, status: a.status })),
  });
  await markMessage(message.id, 'processed');
}

async function handleCustomMessage(message: NodeMessage): Promise<void> {
  insertActivity({
    agent_id: 'system',
    event_type: 'custom_message_received',
    description: `Custom message from ${message.sender_node_name}`,
    metadata: JSON.stringify(message.payload),
  });
  await markMessage(message.id, 'delivered');
}

async function processMessage(message: NodeMessage): Promise<void> {
  try {
    await markMessage(message.id, 'delivered');

    switch (message.message_type) {
      case 'agent_request':
        await handleAgentRequest(message);
        break;
      case 'search_request':
        await handleSearchRequest(message);
        break;
      case 'status_request':
        await handleStatusRequest(message);
        break;
      case 'custom':
        await handleCustomMessage(message);
        break;
      default:
        console.warn('[NodeMessaging] Unknown message type:', message.message_type);
        await markMessage(message.id, 'failed');
    }
  } catch (error) {
    console.error('[NodeMessaging] Error processing message:', message.id, error);
    await markMessage(message.id, 'failed');
  }
}

async function pollAndProcess(): Promise<void> {
  const messages = await fetchInbox();
  for (const message of messages) {
    await processMessage(message);
  }
}

export function startNodeMessaging(): void {
  if (!isHubConfigured()) {
    console.log('[NodeMessaging] Hub not configured — skipping node messaging');
    return;
  }
  if (pollingStarted) return;
  pollingStarted = true;

  console.log('[NodeMessaging] Starting message polling');

  pollAndProcess().catch(err => console.error('[NodeMessaging] Initial poll error:', err));

  setInterval(() => {
    pollAndProcess().catch(err => console.error('[NodeMessaging] Poll error:', err));
  }, 30000);
}
