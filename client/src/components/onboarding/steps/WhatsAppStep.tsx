import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { apiPost } from '../../../api/client';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export function WhatsAppStep({ onNext, onSkip }: Props) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  async function handleConnect() {
    if (!accountSid || !authToken || !whatsappNumber) {
      setError('All fields are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiPost('/v1/whatsapp/connect', {
        account_sid: accountSid,
        auth_token: authToken,
        whatsapp_number: whatsappNumber,
      });
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect WhatsApp');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary">Connect WhatsApp</h1>
        <p className="text-text-secondary mt-2">Set up WhatsApp messaging via Twilio</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-sm space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Requires a Twilio account.</span> You'll need your Account SID, Auth Token, and a WhatsApp-enabled number from Twilio.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">Twilio Account SID</label>
            <input
              type="text"
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accountSid}
              onChange={(e) => { setAccountSid(e.target.value); setError(''); }}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">Auth Token</label>
            <input
              type="password"
              placeholder="Your Twilio auth token"
              value={authToken}
              onChange={(e) => { setAuthToken(e.target.value); setError(''); }}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary">WhatsApp Number</label>
            <input
              type="text"
              placeholder="+14155238886"
              value={whatsappNumber}
              onChange={(e) => { setWhatsappNumber(e.target.value); setError(''); }}
              className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors font-mono text-sm"
            />
          </div>
        </div>

        {connected && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <span className="text-sm text-green-800 font-medium">WhatsApp connected successfully!</span>
          </div>
        )}

        {error && (
          <div className="bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] rounded-lg px-4 py-3 text-sm text-[var(--negative)]">
            {error}
          </div>
        )}

        {!connected && (
          <button
            onClick={handleConnect}
            disabled={!accountSid || !authToken || !whatsappNumber || saving}
            className="w-full py-3 bg-[var(--surface-elevated)] border border-[var(--border)] hover:bg-brand-accent/10 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Connecting...' : 'Connect WhatsApp'}
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-4 bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--surface-elevated)] text-text-secondary font-medium rounded-full transition-colors"
        >
          Skip for Now
        </button>
        <button
          onClick={onNext}
          disabled={!connected}
          className="flex-1 py-4 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
