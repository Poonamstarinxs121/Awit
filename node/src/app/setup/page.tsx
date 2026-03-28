'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'welcome', title: 'Welcome', required: false },
  { id: 'hub', title: 'Hub Connection', required: true },
  { id: 'password', title: 'Admin Password', required: true },
  { id: 'identity', title: 'Node Identity', required: true },
  { id: 'llm', title: 'LLM API', required: false },
  { id: 'messaging', title: 'Messaging', required: false },
  { id: 'launch', title: 'Launch', required: false },
];

interface WizardData {
  standalone: boolean;
  hubUrl: string;
  hubApiKey: string;
  nodeId: string;
  hubTestStatus: 'idle' | 'testing' | 'success' | 'error';
  hubTestMessage: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  nodeName: string;
  nodeDescription: string;
  llmProvider: string;
  openaiKey: string;
  anthropicKey: string;
  ollamaUrl: string;
  telegramToken: string;
  discordWebhook: string;
}

const initialData: WizardData = {
  standalone: false,
  hubUrl: '',
  hubApiKey: '',
  nodeId: '',
  hubTestStatus: 'idle',
  hubTestMessage: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  nodeName: '',
  nodeDescription: '',
  llmProvider: '',
  openaiKey: '',
  anthropicKey: '',
  ollamaUrl: '',
  telegramToken: '',
  discordWebhook: '',
};

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--negative)' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'var(--warning)' };
  if (score <= 3) return { level: 3, label: 'Good', color: '#3B82F6' };
  return { level: 4, label: 'Strong', color: 'var(--positive)' };
}

export default function SetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [saving, setSaving] = useState(false);
  const [launchItems, setLaunchItems] = useState<{ label: string; status: 'pending' | 'saving' | 'done' | 'error' }[]>([]);
  const [launchError, setLaunchError] = useState('');

  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => {
        if (d.setupComplete) {
          router.replace('/login');
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('setup_wizard_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step !== undefined) setCurrentStep(parsed.step);
        if (parsed.data) setData(prev => ({
          ...prev, ...parsed.data,
          hubTestStatus: 'idle' as const, hubTestMessage: '',
        }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (currentStep < STEPS.length - 1) {
      const persistedData = {
        standalone: data.standalone,
        hubUrl: data.hubUrl,
        nodeId: data.nodeId,
        hubTestStatus: data.hubTestStatus,
        nodeName: data.nodeName,
        nodeDescription: data.nodeDescription,
        llmProvider: data.llmProvider,
        ollamaUrl: data.ollamaUrl,
        discordWebhook: data.discordWebhook,
      };
      localStorage.setItem('setup_wizard_state', JSON.stringify({ step: currentStep, data: persistedData }));
    }
  }, [currentStep, data]);

  const update = useCallback((fields: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...fields }));
  }, []);

  const canProceed = (): boolean => {
    const step = STEPS[currentStep];
    if (step.id === 'hub') {
      if (data.standalone) return true;
      return data.hubTestStatus === 'success';
    }
    if (step.id === 'password') {
      return data.adminPassword.length >= 6 && data.adminPassword === data.adminPasswordConfirm;
    }
    if (step.id === 'identity') {
      return data.nodeName.trim().length > 0;
    }
    return true;
  };

  const testHubConnection = async () => {
    update({ hubTestStatus: 'testing', hubTestMessage: '' });
    try {
      const res = await fetch('/api/setup/test-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubUrl: data.hubUrl, apiKey: data.hubApiKey, nodeId: data.nodeId }),
      });
      const result = await res.json();
      if (result.success) {
        update({ hubTestStatus: 'success', hubTestMessage: 'Connected successfully!' });
      } else {
        update({ hubTestStatus: 'error', hubTestMessage: result.error || 'Connection failed' });
      }
    } catch {
      update({ hubTestStatus: 'error', hubTestMessage: 'Could not reach server' });
    }
  };

  const handleLaunch = async () => {
    setSaving(true);
    setLaunchError('');

    const items: { label: string; status: 'pending' | 'saving' | 'done' | 'error' }[] = [];
    if (!data.standalone) items.push({ label: 'Hub connection', status: 'pending' });
    items.push({ label: 'Admin password', status: 'pending' });
    items.push({ label: 'Node identity', status: 'pending' });
    if (data.llmProvider) items.push({ label: `LLM provider (${data.llmProvider})`, status: 'pending' });
    if (data.telegramToken) items.push({ label: 'Telegram notifications', status: 'pending' });
    if (data.discordWebhook) items.push({ label: 'Discord notifications', status: 'pending' });
    items.push({ label: 'Write configuration', status: 'pending' });
    items.push({ label: 'Finalize setup', status: 'pending' });
    setLaunchItems([...items]);

    for (let i = 0; i < items.length - 1; i++) {
      items[i].status = 'saving';
      setLaunchItems([...items]);
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      items[i].status = 'done';
      setLaunchItems([...items]);
    }

    const lastIdx = items.length - 1;
    items[lastIdx].status = 'saving';
    setLaunchItems([...items]);

    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standalone: data.standalone,
          hubUrl: data.hubUrl || undefined,
          hubApiKey: data.hubApiKey || undefined,
          nodeId: data.nodeId || undefined,
          adminPassword: data.adminPassword,
          nodeName: data.nodeName,
          nodeDescription: data.nodeDescription || undefined,
          llmProvider: data.llmProvider || undefined,
          openaiKey: data.openaiKey || undefined,
          anthropicKey: data.anthropicKey || undefined,
          ollamaUrl: data.ollamaUrl || undefined,
          telegramToken: data.telegramToken || undefined,
          discordWebhook: data.discordWebhook || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        items[lastIdx].status = 'done';
        setLaunchItems([...items]);
        await fetch('/api/setup/status');
        localStorage.removeItem('setup_wizard_state');
        await new Promise(r => setTimeout(r, 1000));
        router.push('/login');
      } else {
        items[lastIdx].status = 'error';
        setLaunchItems([...items]);
        setLaunchError(result.error || 'Failed to save configuration');
        setSaving(false);
      }
    } catch {
      items[lastIdx].status = 'error';
      setLaunchItems([...items]);
      setLaunchError('Failed to connect to server');
      setSaving(false);
    }
  };

  const next = () => {
    if (currentStep === STEPS.length - 2) {
      setCurrentStep(currentStep + 1);
      handleLaunch();
    } else {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
    }
  };

  const prev = () => setCurrentStep(Math.max(currentStep - 1, 0));

  const isOptionalStep = STEPS[currentStep]?.required === false && currentStep > 0 && currentStep < STEPS.length - 1;
  const passwordStrength = getPasswordStrength(data.adminPassword);
  const passwordsMatch = data.adminPasswordConfirm.length === 0 || data.adminPassword === data.adminPasswordConfirm;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--background)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 28px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 2 }}>🦑</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Step {currentStep + 1} of {STEPS.length}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentStep ? 24 : 8,
                  height: 4,
                  borderRadius: 2,
                  background: i < currentStep ? 'var(--positive)' : i === currentStep ? 'var(--accent)' : 'var(--border)',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ padding: '24px 28px', minHeight: 320 }}>
          {STEPS[currentStep].id === 'welcome' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
                Welcome to SquidJob Node
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                This wizard will help you configure your node so it&apos;s ready to go. We&apos;ll walk through:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: '🌐', label: 'Hub Connection', desc: 'Connect to a central Hub or run standalone' },
                  { icon: '🔐', label: 'Admin Password', desc: 'Secure your node dashboard' },
                  { icon: '🏷️', label: 'Node Identity', desc: 'Give your node a name' },
                  { icon: '🤖', label: 'LLM API Keys', desc: 'Configure AI model providers (optional)' },
                  { icon: '💬', label: 'Notifications', desc: 'Set up Telegram or Discord alerts (optional)' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    background: 'var(--background)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {STEPS[currentStep].id === 'hub' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                Hub Connection
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Connect this node to a SquidJob Hub for centralized management, or run in standalone mode.
              </p>

              <div style={{
                display: 'flex', gap: 8, marginBottom: 20,
              }}>
                <button
                  onClick={() => update({ standalone: false })}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${data.standalone ? 'var(--border)' : 'var(--accent)'}`,
                    background: data.standalone ? 'transparent' : 'var(--accent-soft)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  🌐 Connect to Hub
                </button>
                <button
                  onClick={() => update({ standalone: true, hubTestStatus: 'idle' })}
                  style={{
                    flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${!data.standalone ? 'var(--border)' : 'var(--accent)'}`,
                    background: !data.standalone ? 'transparent' : 'var(--accent-soft)',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  💻 Standalone Mode
                </button>
              </div>

              {!data.standalone ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{
                    padding: '10px 14px', background: 'rgba(59,130,246,0.06)',
                    border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8,
                    fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
                  }}>
                    Go to <strong>Hub → Fleet → Register Node</strong> to get your Hub URL, Node ID, and API Key.
                  </div>
                  <InputField label="Hub URL" placeholder="https://your-hub.onrender.com"
                    value={data.hubUrl} onChange={v => update({ hubUrl: v, hubTestStatus: 'idle' })} />
                  <InputField label="Node ID" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono
                    value={data.nodeId} onChange={v => update({ nodeId: v, hubTestStatus: 'idle' })} />
                  <InputField label="Node API Key" placeholder="sqn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono type="password"
                    value={data.hubApiKey} onChange={v => update({ hubApiKey: v, hubTestStatus: 'idle' })} />

                  <button
                    onClick={testHubConnection}
                    disabled={!data.hubUrl || !data.hubApiKey || !data.nodeId || data.hubTestStatus === 'testing'}
                    style={{
                      padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--border)', background: 'var(--background)',
                      color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                      opacity: (!data.hubUrl || !data.hubApiKey || !data.nodeId) ? 0.5 : 1,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {data.hubTestStatus === 'testing' ? '⏳ Testing...' : '🔌 Test Connection'}
                  </button>

                  {data.hubTestStatus === 'success' && (
                    <StatusBanner type="success" message={data.hubTestMessage} />
                  )}
                  {data.hubTestStatus === 'error' && (
                    <StatusBanner type="error" message={data.hubTestMessage} />
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '16px', background: 'var(--background)', borderRadius: 8,
                  border: '1px solid var(--border)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>💻</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Standalone Mode</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    The node will run independently without connecting to a Hub.
                    You can connect later from Settings.
                  </div>
                </div>
              )}
            </div>
          )}

          {STEPS[currentStep].id === 'password' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                Admin Password
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Set a password to protect your node&apos;s web dashboard.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InputField label="Password" type="password" placeholder="Enter password (min 6 characters)"
                  value={data.adminPassword} onChange={v => update({ adminPassword: v })} />

                {data.adminPassword && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -4 }}>
                    <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: i <= passwordStrength.level ? passwordStrength.color : 'var(--border)',
                          transition: 'background 0.2s',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: passwordStrength.color, fontWeight: 500 }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}

                <InputField label="Confirm Password" type="password" placeholder="Re-enter password"
                  value={data.adminPasswordConfirm} onChange={v => update({ adminPasswordConfirm: v })} />

                {!passwordsMatch && (
                  <StatusBanner type="error" message="Passwords do not match" />
                )}
              </div>
            </div>
          )}

          {STEPS[currentStep].id === 'identity' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                Node Identity
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Give your node a friendly name so you can identify it in the Hub.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InputField label="Node Name" placeholder="e.g. Mac Studio, Office Server"
                  value={data.nodeName} onChange={v => update({ nodeName: v })} />
                <InputField label="Description (optional)" placeholder="e.g. Main workstation in the office"
                  value={data.nodeDescription} onChange={v => update({ nodeDescription: v })} />
              </div>
            </div>
          )}

          {STEPS[currentStep].id === 'llm' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                LLM API Configuration
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.6 }}>
                Configure a local LLM provider for this node. Skip if your Hub handles LLM routing.
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, fontStyle: 'italic' }}>
                This step is optional — you can configure this later in Settings.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { id: 'openai', label: 'OpenAI', icon: '🟢' },
                  { id: 'anthropic', label: 'Anthropic', icon: '🟣' },
                  { id: 'ollama', label: 'Ollama (Local)', icon: '🦙' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => update({ llmProvider: data.llmProvider === p.id ? '' : p.id })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${data.llmProvider === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: data.llmProvider === p.id ? 'var(--accent-soft)' : 'var(--background)',
                      color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                      fontFamily: 'var(--font-body)', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>

              {data.llmProvider === 'openai' && (
                <InputField label="OpenAI API Key" type="password" placeholder="sk-..."
                  value={data.openaiKey} onChange={v => update({ openaiKey: v })} mono />
              )}
              {data.llmProvider === 'anthropic' && (
                <InputField label="Anthropic API Key" type="password" placeholder="sk-ant-..."
                  value={data.anthropicKey} onChange={v => update({ anthropicKey: v })} mono />
              )}
              {data.llmProvider === 'ollama' && (
                <InputField label="Ollama URL" placeholder="http://localhost:11434"
                  value={data.ollamaUrl} onChange={v => update({ ollamaUrl: v })} mono />
              )}
            </div>
          )}

          {STEPS[currentStep].id === 'messaging' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                Messaging Notifications
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.6 }}>
                Set up optional notification channels for agent activity.
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, fontStyle: 'italic' }}>
                This step is optional — you can configure this later in Settings.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>📱</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Telegram</span>
                  </div>
                  <InputField label="Bot Token" placeholder="123456:ABC-DEF..." mono
                    value={data.telegramToken} onChange={v => update({ telegramToken: v })} />
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>🎮</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Discord</span>
                  </div>
                  <InputField label="Webhook URL" placeholder="https://discord.com/api/webhooks/..." mono
                    value={data.discordWebhook} onChange={v => update({ discordWebhook: v })} />
                </div>
              </div>
            </div>
          )}

          {STEPS[currentStep].id === 'launch' && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                Launching Your Node
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Saving your configuration and preparing everything...
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {launchItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    background: 'var(--background)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>
                      {item.status === 'pending' && '⏸️'}
                      {item.status === 'saving' && <Spinner />}
                      {item.status === 'done' && '✅'}
                      {item.status === 'error' && '❌'}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 500,
                      color: item.status === 'done' ? 'var(--positive)' :
                             item.status === 'error' ? 'var(--negative)' :
                             item.status === 'saving' ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {launchError && (
                <div style={{ marginTop: 16 }}>
                  <StatusBanner type="error" message={launchError} />
                  <button
                    onClick={handleLaunch}
                    style={{
                      marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 8,
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {currentStep < STEPS.length - 1 && (
          <div style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <button
              onClick={prev}
              disabled={currentStep === 0}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 13, fontWeight: 500, cursor: currentStep === 0 ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Back
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              {isOptionalStep && (
                <button
                  onClick={next}
                  style={{
                    padding: '8px 20px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={next}
                disabled={!canProceed() || saving}
                style={{
                  padding: '8px 24px', borderRadius: 8,
                  border: 'none', background: canProceed() ? 'var(--accent)' : 'var(--border)',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: canProceed() ? 'pointer' : 'default',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {currentStep === STEPS.length - 2 ? 'Launch' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text', mono }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px',
          background: 'var(--background)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-primary)',
          fontSize: 13, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          outline: 'none',
        }}
      />
    </div>
  );
}

function StatusBanner({ type, message }: { type: 'success' | 'error'; message: string }) {
  const isErr = type === 'error';
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8,
      background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
      fontSize: 12, color: isErr ? 'var(--negative)' : 'var(--positive)',
      fontWeight: 500,
    }}>
      {isErr ? '✗ ' : '✓ '}{message}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
    }} />
  );
}
